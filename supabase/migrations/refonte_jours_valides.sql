-- ================================================================
-- Migration : Refonte "jours valides"
--
-- BREAKING CHANGE : nouvelle sémantique de validation.
--
-- Avant : "session valide" (meca+chaos dans une même session)
-- Après : "jour valide" = un jour contenant :
--   • AU MOINS 1 session MÉCANIQUE avec
--       temps_mecanique >= duree_min_session
--       ET nb questions >= nb_exercices_mecanique (0 = pas de contrainte)
--   • ET AU MOINS 1 session CHAOTIQUE avec
--       temps_chaotique >= duree_min_session
--       ET nb questions >= nb_exercices_chaotique (0 = pas de contrainte)
--
-- Renommages :
--   objectif_hebdomadaire.nb_sessions_min       → nb_jours_min
--   progression_objectif.nb_sessions_realisees  → nb_jours_valides
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Suppression des données existantes
-- ----------------------------------------------------------------
TRUNCATE TABLE progression_objectif CASCADE;
TRUNCATE TABLE objectif_hebdomadaire CASCADE;


-- ----------------------------------------------------------------
-- 2. Renommage des colonnes
-- ----------------------------------------------------------------

-- objectif_hebdomadaire
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'objectif_hebdomadaire' AND column_name = 'nb_sessions_min'
  ) THEN
    ALTER TABLE objectif_hebdomadaire RENAME COLUMN nb_sessions_min TO nb_jours_min;
  END IF;
END $$;

-- progression_objectif
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progression_objectif' AND column_name = 'nb_sessions_realisees'
  ) THEN
    ALTER TABLE progression_objectif RENAME COLUMN nb_sessions_realisees TO nb_jours_valides;
  END IF;
END $$;


-- ----------------------------------------------------------------
-- 3. Drop des anciennes signatures
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS creer_objectif_hebdomadaire(UUID,UUID,DATE,INTEGER,INTEGER,TEXT,INTEGER,TEXT,TEXT,INTEGER,TEXT);
DROP FUNCTION IF EXISTS calculer_progression_objectif(UUID);
DROP FUNCTION IF EXISTS get_objectifs_membre(UUID,UUID);


-- ================================================================
-- 4. RPC : creer_objectif_hebdomadaire
--    Renommage p_nb_sessions_min → p_nb_jours_min
-- ================================================================
CREATE OR REPLACE FUNCTION creer_objectif_hebdomadaire(
  p_equipe_id              UUID,
  p_membre_user_id         UUID,
  p_date_debut             DATE,
  p_nb_jours_min           INTEGER DEFAULT 3,
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
    nb_jours_min, nb_exercices_mecanique, consignes_mecanique,
    nb_exercices_chaotique, consignes_chaotique, description,
    duree_min_session, validation_mode
  ) VALUES (
    p_equipe_id, p_membre_user_id, auth.uid(), p_date_debut, v_date_fin,
    p_nb_jours_min, p_nb_exercices_mecanique, p_consignes_mecanique,
    p_nb_exercices_chaotique, p_consignes_chaotique, p_description,
    p_duree_min_session, p_validation_mode
  )
  RETURNING id INTO v_objectif_id;

  INSERT INTO progression_objectif (objectif_id, user_id)
  VALUES (v_objectif_id, p_membre_user_id);

  RETURN v_objectif_id;
END;
$$;


-- ================================================================
-- 5. RPC : calculer_progression_objectif  (logique "jours valides")
--
--    Un jour est valide si :
--      • EXISTS session meca (feuille_mecanique_id IS NOT NULL) avec
--          temps_mecanique >= duree_min_session
--          AND (nb_exercices_mecanique = 0
--               OR COUNT(score_local) >= nb_exercices_mecanique)
--      • AND EXISTS session chaos (feuille_chaotique_id IS NOT NULL) avec
--          temps_chaotique >= duree_min_session
--          AND (nb_exercices_chaotique = 0
--               OR COUNT(score_local) >= nb_exercices_chaotique)
--    objectif_atteint = nb_jours_valides >= nb_jours_min
-- ================================================================
CREATE OR REPLACE FUNCTION calculer_progression_objectif(p_objectif_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj             RECORD;
  v_prog            RECORD;
  v_nb_jours_valides INTEGER;
  v_atteint          BOOLEAN;
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
    -- Compter les jours valides dans la période
    SELECT COUNT(DISTINCT j.date_session) INTO v_nb_jours_valides
    FROM (
      SELECT DISTINCT date_session
      FROM session_entrainement
      WHERE user_id      = v_prog.user_id
        AND date_session >= v_obj.date_debut
        AND date_session <= v_obj.date_fin
        AND statut       = 'terminee'
    ) j
    WHERE
      -- Ce jour contient au moins une session meca valide
      EXISTS (
        SELECT 1 FROM session_entrainement se
        WHERE se.user_id               = v_prog.user_id
          AND se.date_session          = j.date_session
          AND se.statut                = 'terminee'
          AND se.feuille_mecanique_id  IS NOT NULL
          AND se.temps_mecanique       >= v_obj.duree_min_session
          AND (
            v_obj.nb_exercices_mecanique = 0
            OR (SELECT COUNT(*) FROM score_local sl WHERE sl.session_id = se.id)
                 >= v_obj.nb_exercices_mecanique
          )
      )
      -- ET ce jour contient au moins une session chaos valide
      AND EXISTS (
        SELECT 1 FROM session_entrainement se
        WHERE se.user_id               = v_prog.user_id
          AND se.date_session          = j.date_session
          AND se.statut                = 'terminee'
          AND se.feuille_chaotique_id  IS NOT NULL
          AND se.temps_chaotique       >= v_obj.duree_min_session
          AND (
            v_obj.nb_exercices_chaotique = 0
            OR (SELECT COUNT(*) FROM score_local sl WHERE sl.session_id = se.id)
                 >= v_obj.nb_exercices_chaotique
          )
      );

    v_atteint := v_nb_jours_valides >= v_obj.nb_jours_min;

    UPDATE progression_objectif
    SET
      nb_jours_valides     = v_nb_jours_valides,
      objectif_atteint     = v_atteint,
      derniere_mise_a_jour = NOW()
    WHERE id = v_prog.id;
  END LOOP;
END;
$$;


-- ================================================================
-- 6. RPC : get_objectifs_membre
--    Retourne les objectifs avec, pour chaque progression,
--    jours[] : détail par jour (meca + chaotique côte à côte)
--
--    Chaque entrée de jours[] :
--      date_jour, meca_session_id, meca_duree, meca_nb_questions,
--      meca_valide, chaos_session_id, chaos_duree, chaos_nb_questions,
--      chaos_valide, jour_valide
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
      oh.nb_jours_min,
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
            COALESCE(p.full_name, 'Inconnu')  AS nom,
            po.nb_jours_valides,
            po.nb_exercices_mecanique_realises,
            po.nb_exercices_chaotique_realises,
            po.objectif_atteint,
            po.derniere_mise_a_jour,
            -- Détail par jour (meca + chaotique côte à côte)
            (
              SELECT COALESCE(json_agg(jour_data ORDER BY (jour_data->>'date_jour') ASC), '[]'::json)
              FROM (
                SELECT jsonb_build_object(
                  'date_jour',           j.date_jour,
                  -- Meilleure session mécanique du jour (la plus longue)
                  'meca_session_id',     meca.id,
                  'meca_duree',          COALESCE(meca.temps_mecanique, 0),
                  'meca_nb_questions',   COALESCE(meca_q.cnt, 0),
                  'meca_valide',         (
                    meca.id IS NOT NULL
                    AND meca.temps_mecanique >= oh.duree_min_session
                    AND (oh.nb_exercices_mecanique = 0
                         OR COALESCE(meca_q.cnt, 0) >= oh.nb_exercices_mecanique)
                  ),
                  -- Meilleure session chaotique du jour (la plus longue)
                  'chaos_session_id',    chaos.id,
                  'chaos_duree',         COALESCE(chaos.temps_chaotique, 0),
                  'chaos_nb_questions',  COALESCE(chaos_q.cnt, 0),
                  'chaos_valide',        (
                    chaos.id IS NOT NULL
                    AND chaos.temps_chaotique >= oh.duree_min_session
                    AND (oh.nb_exercices_chaotique = 0
                         OR COALESCE(chaos_q.cnt, 0) >= oh.nb_exercices_chaotique)
                  ),
                  -- Le jour est valide si meca ET chaos sont tous les deux valides
                  'jour_valide',         (
                    meca.id IS NOT NULL
                    AND meca.temps_mecanique >= oh.duree_min_session
                    AND (oh.nb_exercices_mecanique = 0
                         OR COALESCE(meca_q.cnt, 0) >= oh.nb_exercices_mecanique)
                    AND chaos.id IS NOT NULL
                    AND chaos.temps_chaotique >= oh.duree_min_session
                    AND (oh.nb_exercices_chaotique = 0
                         OR COALESCE(chaos_q.cnt, 0) >= oh.nb_exercices_chaotique)
                  )
                ) AS jour_data

                FROM (
                  -- Tous les jours avec au moins une session terminée dans la période
                  SELECT DISTINCT date_session AS date_jour
                  FROM session_entrainement
                  WHERE user_id      = po.user_id
                    AND date_session >= oh.date_debut
                    AND date_session <= oh.date_fin
                    AND statut       = 'terminee'
                ) j

                -- Meilleure session mécanique du jour
                LEFT JOIN LATERAL (
                  SELECT se.id, se.temps_mecanique
                  FROM session_entrainement se
                  WHERE se.user_id                = po.user_id
                    AND se.date_session           = j.date_jour
                    AND se.statut                 = 'terminee'
                    AND se.feuille_mecanique_id   IS NOT NULL
                  ORDER BY se.temps_mecanique DESC NULLS LAST
                  LIMIT 1
                ) meca ON TRUE

                -- Nb questions de la session mécanique
                LEFT JOIN LATERAL (
                  SELECT COUNT(*)::INTEGER AS cnt
                  FROM score_local sl
                  WHERE sl.session_id = meca.id
                ) meca_q ON meca.id IS NOT NULL

                -- Meilleure session chaotique du jour
                LEFT JOIN LATERAL (
                  SELECT se.id, se.temps_chaotique
                  FROM session_entrainement se
                  WHERE se.user_id                = po.user_id
                    AND se.date_session           = j.date_jour
                    AND se.statut                 = 'terminee'
                    AND se.feuille_chaotique_id   IS NOT NULL
                  ORDER BY se.temps_chaotique DESC NULLS LAST
                  LIMIT 1
                ) chaos ON TRUE

                -- Nb questions de la session chaotique
                LEFT JOIN LATERAL (
                  SELECT COUNT(*)::INTEGER AS cnt
                  FROM score_local sl
                  WHERE sl.session_id = chaos.id
                ) chaos_q ON chaos.id IS NOT NULL

              ) jours_detail
            ) AS jours

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
-- 7. Grants
-- ================================================================
GRANT EXECUTE ON FUNCTION creer_objectif_hebdomadaire   TO authenticated;
GRANT EXECUTE ON FUNCTION calculer_progression_objectif TO authenticated;
GRANT EXECUTE ON FUNCTION get_objectifs_membre          TO authenticated;
