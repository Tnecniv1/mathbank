-- ================================================================
-- Migration : Refonte du système d'objectifs hebdomadaires
--
-- BREAKING CHANGE : table rase sur objectif_hebdomadaire
--                   et progression_objectif.
--
-- Nouvelles colonnes :
--   duree_min_session  INTEGER  -- durée min par session valide (minutes)
--   validation_mode    TEXT     -- 'auto' | 'manuel'
--   commentaire_manuel TEXT     -- note libre du prof lors d'une clôture manuelle
--
-- Nouvelle logique de validation :
--   Une "session valide" satisfait les 3 critères SIMULTANÉMENT :
--     1. temps_mecanique + temps_chaotique >= duree_min_session
--     2. nb questions meca dans la session   >= nb_exercices_mecanique  (0 = pas de contrainte)
--     3. nb questions chaos dans la session  >= nb_exercices_chaotique  (0 = pas de contrainte)
--   L'objectif est atteint si count(sessions valides) >= nb_sessions_min.
--
--   Mode 'auto'   : calculer_progression_objectif met à jour le statut librement.
--   Mode 'manuel' : le calcul auto ne touche pas au statut ; le prof force.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Suppression des données existantes
-- ----------------------------------------------------------------
TRUNCATE TABLE progression_objectif CASCADE;
TRUNCATE TABLE objectif_hebdomadaire CASCADE;


-- ----------------------------------------------------------------
-- 2. Nouvelles colonnes sur objectif_hebdomadaire
-- ----------------------------------------------------------------
ALTER TABLE objectif_hebdomadaire
  ADD COLUMN IF NOT EXISTS duree_min_session  INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS validation_mode    TEXT    NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS commentaire_manuel TEXT;

-- Contrainte sur validation_mode (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_validation_mode'
  ) THEN
    ALTER TABLE objectif_hebdomadaire
      ADD CONSTRAINT check_validation_mode
      CHECK (validation_mode IN ('auto', 'manuel'));
  END IF;
END $$;


-- ----------------------------------------------------------------
-- 3. Drop des anciennes versions dont la signature change
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS creer_objectif_hebdomadaire(UUID,UUID,DATE,INTEGER,INTEGER,TEXT,INTEGER,TEXT,TEXT);
DROP FUNCTION IF EXISTS cloturer_objectif(UUID,VARCHAR);


-- ================================================================
-- 4. RPC : creer_objectif_hebdomadaire
--    Nouvelle signature : + p_duree_min_session, p_validation_mode
-- ================================================================
CREATE OR REPLACE FUNCTION creer_objectif_hebdomadaire(
  p_equipe_id              UUID,
  p_membre_user_id         UUID,
  p_date_debut             DATE,
  p_nb_sessions_min        INTEGER DEFAULT 1,
  p_nb_exercices_mecanique INTEGER DEFAULT 0,
  p_consignes_mecanique    TEXT    DEFAULT NULL,
  p_nb_exercices_chaotique INTEGER DEFAULT 0,
  p_consignes_chaotique    TEXT    DEFAULT NULL,
  p_description            TEXT    DEFAULT NULL,
  p_duree_min_session      INTEGER DEFAULT 30,
  p_validation_mode        TEXT    DEFAULT 'auto'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_objectif_id UUID;
  v_date_fin    DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM equipe WHERE id = p_equipe_id AND chef_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''êtes pas le chef de cette équipe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM membre_equipe
    WHERE equipe_id = p_equipe_id AND user_id = p_membre_user_id
  ) THEN
    RAISE EXCEPTION 'Ce membre n''appartient pas à cette équipe';
  END IF;

  IF p_validation_mode NOT IN ('auto', 'manuel') THEN
    RAISE EXCEPTION 'Mode de validation invalide (auto | manuel)';
  END IF;

  IF p_duree_min_session <= 0 THEN
    RAISE EXCEPTION 'La durée minimale par session doit être > 0';
  END IF;

  v_date_fin := p_date_debut + INTERVAL '6 days';

  INSERT INTO objectif_hebdomadaire (
    equipe_id, membre_user_id, cree_par, date_debut, date_fin,
    nb_sessions_min, nb_exercices_mecanique, consignes_mecanique,
    nb_exercices_chaotique, consignes_chaotique, description,
    duree_min_session, validation_mode
  ) VALUES (
    p_equipe_id, p_membre_user_id, auth.uid(), p_date_debut, v_date_fin,
    p_nb_sessions_min, p_nb_exercices_mecanique, p_consignes_mecanique,
    p_nb_exercices_chaotique, p_consignes_chaotique, p_description,
    p_duree_min_session, p_validation_mode
  )
  RETURNING id INTO v_objectif_id;

  -- Une seule ligne de progression par objectif (objectif = 1 membre)
  INSERT INTO progression_objectif (objectif_id, user_id)
  VALUES (v_objectif_id, p_membre_user_id);

  RETURN v_objectif_id;
END;
$$;


-- ================================================================
-- 5. RPC : calculer_progression_objectif (nouvelle logique)
--
--    Pour chaque session terminée dans la période :
--      • durée = temps_mecanique + temps_chaotique
--      • nb_meca = COUNT(score_local) si feuille_mecanique_id IS NOT NULL
--      • nb_chaos = COUNT(score_local) si feuille_chaotique_id IS NOT NULL
--      • valide = durée >= duree_min_session
--                 AND (nb_exercices_mecanique = 0 OR nb_meca >= seuil)
--                 AND (nb_exercices_chaotique = 0 OR nb_chaos >= seuil)
--    objectif_atteint = count(sessions valides) >= nb_sessions_min
-- ================================================================
CREATE OR REPLACE FUNCTION calculer_progression_objectif(p_objectif_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj  RECORD;
  v_prog RECORD;
  v_nb_sessions_valides INTEGER;
  v_atteint BOOLEAN;
BEGIN
  SELECT * INTO v_obj FROM objectif_hebdomadaire WHERE id = p_objectif_id;

  IF v_obj IS NULL THEN
    RAISE EXCEPTION 'Objectif introuvable : %', p_objectif_id;
  END IF;

  -- Mode manuel : le prof a la main, on ne touche à rien
  IF v_obj.validation_mode = 'manuel' THEN
    RETURN;
  END IF;

  FOR v_prog IN
    SELECT * FROM progression_objectif WHERE objectif_id = p_objectif_id
  LOOP
    -- Compter les sessions valides dans la période
    SELECT COUNT(*) INTO v_nb_sessions_valides
    FROM (
      SELECT se.id
      FROM session_entrainement se
      WHERE se.user_id      = v_prog.user_id
        AND se.date_session >= v_obj.date_debut
        AND se.date_session <= v_obj.date_fin
        AND se.statut       = 'terminee'
        -- Critère 1 : durée totale
        AND (COALESCE(se.temps_mecanique, 0) + COALESCE(se.temps_chaotique, 0))
              >= v_obj.duree_min_session
        -- Critère 2 : exercices mécaniques (0 = pas de contrainte)
        AND (
          v_obj.nb_exercices_mecanique = 0
          OR (
            se.feuille_mecanique_id IS NOT NULL
            AND (SELECT COUNT(*) FROM score_local sl WHERE sl.session_id = se.id)
                  >= v_obj.nb_exercices_mecanique
          )
        )
        -- Critère 3 : exercices chaotiques (0 = pas de contrainte)
        AND (
          v_obj.nb_exercices_chaotique = 0
          OR (
            se.feuille_chaotique_id IS NOT NULL
            AND (SELECT COUNT(*) FROM score_local sl WHERE sl.session_id = se.id)
                  >= v_obj.nb_exercices_chaotique
          )
        )
    ) AS sessions_valides;

    v_atteint := v_nb_sessions_valides >= v_obj.nb_sessions_min;

    -- nb_sessions_realisees stocke maintenant le nombre de sessions VALIDES
    UPDATE progression_objectif
    SET
      nb_sessions_realisees = v_nb_sessions_valides,
      objectif_atteint      = v_atteint,
      derniere_mise_a_jour  = NOW()
    WHERE id = v_prog.id;
  END LOOP;
END;
$$;


-- ================================================================
-- 6. RPC : get_objectifs_membre
--    Retourne les objectifs avec, pour chaque progression :
--      • les champs existants
--      • sessions[] : détail de chaque session terminée de la semaine
--          session_id, date_session, duree_totale,
--          nb_meca, nb_chaos, est_valide, raison_invalide
-- ================================================================
CREATE OR REPLACE FUNCTION get_objectifs_membre(
  p_equipe_id       UUID,
  p_membre_user_id  UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Vérifier accès : chef ou membre concerné
  IF NOT EXISTS (
    SELECT 1 FROM equipe WHERE id = p_equipe_id AND chef_id = auth.uid()
  ) AND auth.uid() != p_membre_user_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT COALESCE(json_agg(obj_data ORDER BY obj_data.date_debut DESC), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      oh.id,
      oh.equipe_id,
      oh.membre_user_id,
      oh.date_debut,
      oh.date_fin,
      oh.nb_sessions_min,
      oh.nb_exercices_mecanique,
      oh.consignes_mecanique,
      oh.nb_exercices_chaotique,
      oh.consignes_chaotique,
      oh.description,
      oh.statut,
      oh.created_at,
      oh.duree_min_session,
      oh.validation_mode,
      oh.commentaire_manuel,
      (
        SELECT COALESCE(json_agg(prog_obj), '[]'::json)
        FROM (
          SELECT
            po.id,
            po.user_id,
            COALESCE(p.full_name, 'Inconnu')                AS nom,
            po.nb_sessions_realisees,                        -- = sessions valides
            po.nb_exercices_mecanique_realises,
            po.nb_exercices_chaotique_realises,
            po.objectif_atteint,
            po.derniere_mise_a_jour,
            -- Détail des sessions terminées de la semaine
            (
              SELECT COALESCE(json_agg(sess ORDER BY sess.date_session ASC), '[]'::json)
              FROM (
                SELECT
                  se.id                  AS session_id,
                  se.date_session,
                  COALESCE(se.temps_mecanique, 0)
                    + COALESCE(se.temps_chaotique, 0)        AS duree_totale,
                  -- nb questions mécaniques dans la session
                  CASE
                    WHEN se.feuille_mecanique_id IS NOT NULL
                    THEN (SELECT COUNT(*)::INTEGER FROM score_local sl
                          WHERE sl.session_id = se.id)
                    ELSE 0
                  END                                        AS nb_meca,
                  -- nb questions chaotiques dans la session
                  CASE
                    WHEN se.feuille_chaotique_id IS NOT NULL
                    THEN (SELECT COUNT(*)::INTEGER FROM score_local sl
                          WHERE sl.session_id = se.id)
                    ELSE 0
                  END                                        AS nb_chaos,
                  -- La session est-elle valide ?
                  (
                    (COALESCE(se.temps_mecanique, 0) + COALESCE(se.temps_chaotique, 0))
                      >= oh.duree_min_session
                    AND (
                      oh.nb_exercices_mecanique = 0
                      OR (
                        se.feuille_mecanique_id IS NOT NULL
                        AND (SELECT COUNT(*) FROM score_local sl
                             WHERE sl.session_id = se.id)
                            >= oh.nb_exercices_mecanique
                      )
                    )
                    AND (
                      oh.nb_exercices_chaotique = 0
                      OR (
                        se.feuille_chaotique_id IS NOT NULL
                        AND (SELECT COUNT(*) FROM score_local sl
                             WHERE sl.session_id = se.id)
                            >= oh.nb_exercices_chaotique
                      )
                    )
                  )                                          AS est_valide,
                  -- Première raison d'invalidité
                  CASE
                    WHEN (COALESCE(se.temps_mecanique, 0) + COALESCE(se.temps_chaotique, 0))
                           < oh.duree_min_session
                    THEN 'Trop courte ('
                      || (COALESCE(se.temps_mecanique, 0) + COALESCE(se.temps_chaotique, 0))::TEXT
                      || ' min / ' || oh.duree_min_session::TEXT || ' min min.)'

                    WHEN oh.nb_exercices_mecanique > 0 AND (
                      se.feuille_mecanique_id IS NULL
                      OR (SELECT COUNT(*) FROM score_local sl WHERE sl.session_id = se.id)
                           < oh.nb_exercices_mecanique
                    )
                    THEN 'Mécaniques insuffisants ('
                      || CASE
                           WHEN se.feuille_mecanique_id IS NOT NULL
                           THEN (SELECT COUNT(*)::TEXT FROM score_local sl WHERE sl.session_id = se.id)
                           ELSE '0'
                         END
                      || ' / ' || oh.nb_exercices_mecanique::TEXT || ')'

                    WHEN oh.nb_exercices_chaotique > 0 AND (
                      se.feuille_chaotique_id IS NULL
                      OR (SELECT COUNT(*) FROM score_local sl WHERE sl.session_id = se.id)
                           < oh.nb_exercices_chaotique
                    )
                    THEN 'Chaotiques insuffisants ('
                      || CASE
                           WHEN se.feuille_chaotique_id IS NOT NULL
                           THEN (SELECT COUNT(*)::TEXT FROM score_local sl WHERE sl.session_id = se.id)
                           ELSE '0'
                         END
                      || ' / ' || oh.nb_exercices_chaotique::TEXT || ')'

                    ELSE NULL
                  END                                        AS raison_invalide

                FROM session_entrainement se
                WHERE se.user_id      = po.user_id
                  AND se.date_session >= oh.date_debut
                  AND se.date_session <= oh.date_fin
                  AND se.statut       = 'terminee'
              ) sess
            )                                                AS sessions

          FROM progression_objectif po
          LEFT JOIN profiles p ON p.user_id = po.user_id
          WHERE po.objectif_id = oh.id
        ) prog_obj
      ) AS progressions

    FROM objectif_hebdomadaire oh
    WHERE oh.equipe_id      = p_equipe_id
      AND oh.membre_user_id = p_membre_user_id
  ) obj_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;


-- ================================================================
-- 7. RPC : cloturer_objectif
--    Nouvelle signature : + p_commentaire (optionnel)
--    Fonctionne à tout moment (semaine en cours ou expirée)
-- ================================================================
CREATE OR REPLACE FUNCTION cloturer_objectif(
  p_objectif_id UUID,
  p_statut      VARCHAR,
  p_commentaire TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj RECORD;
BEGIN
  IF p_statut NOT IN ('succes', 'echec') THEN
    RAISE EXCEPTION 'Statut invalide. Utilisez "succes" ou "echec"';
  END IF;

  SELECT oh.*
  INTO v_obj
  FROM objectif_hebdomadaire oh
  JOIN equipe e ON e.id = oh.equipe_id
  WHERE oh.id = p_objectif_id AND e.chef_id = auth.uid();

  IF v_obj IS NULL THEN
    RAISE EXCEPTION 'Objectif introuvable ou accès refusé';
  END IF;

  IF v_obj.statut != 'en_cours' THEN
    RAISE EXCEPTION 'Cet objectif est déjà clôturé';
  END IF;

  UPDATE objectif_hebdomadaire
  SET
    statut            = p_statut,
    commentaire_manuel = p_commentaire
  WHERE id = p_objectif_id;
END;
$$;


-- ================================================================
-- 8. RPC : basculer_mode_objectif  [NOUVEAU]
--    Permet au prof de switcher entre 'auto' et 'manuel'.
--    Passage en 'auto' : remet statut = 'en_cours' et recalcule.
--    Passage en 'manuel' : garde le statut actuel, stoppe l'auto-calc.
-- ================================================================
CREATE OR REPLACE FUNCTION basculer_mode_objectif(
  p_objectif_id UUID,
  p_mode        TEXT   -- 'auto' | 'manuel'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj RECORD;
BEGIN
  IF p_mode NOT IN ('auto', 'manuel') THEN
    RAISE EXCEPTION 'Mode invalide. Utilisez "auto" ou "manuel"';
  END IF;

  SELECT oh.*
  INTO v_obj
  FROM objectif_hebdomadaire oh
  JOIN equipe e ON e.id = oh.equipe_id
  WHERE oh.id = p_objectif_id AND e.chef_id = auth.uid();

  IF v_obj IS NULL THEN
    RAISE EXCEPTION 'Objectif introuvable ou accès refusé';
  END IF;

  IF p_mode = 'auto' THEN
    -- Repasser en auto : réinitialiser le statut et recalculer
    UPDATE objectif_hebdomadaire
    SET
      validation_mode    = 'auto',
      statut             = 'en_cours',
      commentaire_manuel = NULL
    WHERE id = p_objectif_id;

    PERFORM calculer_progression_objectif(p_objectif_id);
  ELSE
    -- Passer en manuel : garder statut actuel, stopper l'auto
    UPDATE objectif_hebdomadaire
    SET validation_mode = 'manuel'
    WHERE id = p_objectif_id;
  END IF;
END;
$$;


-- ================================================================
-- 9. RPC : get_objectifs_grid_data  (fix: 'en_cours' pour semaine active)
-- ================================================================
CREATE OR REPLACE FUNCTION get_objectifs_grid_data(
  p_equipe_id      UUID,
  p_membre_user_id UUID,
  p_nb_semaines    INTEGER DEFAULT 16
)
RETURNS TABLE (
  semaine_debut DATE,
  semaine_fin   DATE,
  statut        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH semaines AS (
    SELECT
      (date_trunc('week', CURRENT_DATE - (n || ' weeks')::INTERVAL))::DATE AS debut,
      (date_trunc('week', CURRENT_DATE - (n || ' weeks')::INTERVAL)
        + INTERVAL '6 days')::DATE                                          AS fin
    FROM generate_series(0, p_nb_semaines - 1) AS n
  ),
  objectifs_membre AS (
    SELECT
      oh.date_debut,
      oh.date_fin,
      oh.statut        AS obj_statut,
      po.objectif_atteint
    FROM objectif_hebdomadaire oh
    LEFT JOIN progression_objectif po ON po.objectif_id = oh.id
    WHERE oh.equipe_id      = p_equipe_id
      AND oh.membre_user_id = p_membre_user_id
  )
  SELECT
    s.debut AS semaine_debut,
    s.fin   AS semaine_fin,
    CASE
      WHEN o.date_debut IS NULL        THEN 'non_fixe'
      WHEN o.obj_statut = 'succes'     THEN 'succes'
      WHEN o.obj_statut = 'echec'      THEN 'echec'
      WHEN o.objectif_atteint = TRUE   THEN 'succes'
      WHEN s.fin >= CURRENT_DATE       THEN 'en_cours'   -- semaine encore active
      ELSE                                  'echec'
    END AS statut
  FROM semaines s
  LEFT JOIN objectifs_membre o ON s.debut = o.date_debut
  ORDER BY s.debut ASC;
END;
$$;


-- ================================================================
-- 10. RPC : verifier_objectifs_expires
--     Mise à jour : ignorer les objectifs en mode 'manuel'
-- ================================================================
CREATE OR REPLACE FUNCTION verifier_objectifs_expires(p_equipe_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj        RECORD;
  v_chef_id    UUID;
  v_membre_nom TEXT;
BEGIN
  SELECT chef_id INTO v_chef_id FROM equipe WHERE id = p_equipe_id;
  IF v_chef_id IS NULL THEN RETURN; END IF;

  FOR v_obj IN
    SELECT oh.id, oh.date_debut, oh.date_fin, oh.equipe_id, oh.membre_user_id
    FROM objectif_hebdomadaire oh
    WHERE oh.equipe_id       = p_equipe_id
      AND oh.statut          = 'en_cours'
      AND oh.validation_mode = 'auto'         -- ignorer le mode manuel
      AND oh.date_fin        < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM notification n
        WHERE n.user_id = v_chef_id
          AND n.type    = 'objectif_expire'
          AND (n.metadata->>'objectif_id')::UUID = oh.id
      )
  LOOP
    SELECT full_name INTO v_membre_nom
    FROM profiles WHERE user_id = v_obj.membre_user_id;

    INSERT INTO notification (user_id, type, titre, message, lu, metadata)
    VALUES (
      v_chef_id,
      'objectif_expire',
      'Objectif à clôturer',
      'L''objectif du ' || to_char(v_obj.date_debut, 'DD/MM') ||
        ' au ' || to_char(v_obj.date_fin, 'DD/MM') ||
        ' de ' || COALESCE(v_membre_nom, 'un membre') ||
        ' est terminé. Veuillez le clôturer.',
      false,
      json_build_object(
        'objectif_id',    v_obj.id,
        'equipe_id',      v_obj.equipe_id,
        'membre_user_id', v_obj.membre_user_id
      )
    );
  END LOOP;
END;
$$;


-- ================================================================
-- 11. Grants
-- ================================================================
GRANT EXECUTE ON FUNCTION creer_objectif_hebdomadaire   TO authenticated;
GRANT EXECUTE ON FUNCTION calculer_progression_objectif TO authenticated;
GRANT EXECUTE ON FUNCTION get_objectifs_membre          TO authenticated;
GRANT EXECUTE ON FUNCTION cloturer_objectif             TO authenticated;
GRANT EXECUTE ON FUNCTION basculer_mode_objectif        TO authenticated;
GRANT EXECUTE ON FUNCTION get_objectifs_grid_data       TO authenticated;
GRANT EXECUTE ON FUNCTION verifier_objectifs_expires    TO authenticated;
