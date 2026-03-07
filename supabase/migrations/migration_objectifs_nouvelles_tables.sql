-- ================================================================
-- Migration : Étendre les RPCs objectifs vers les nouvelles tables
--
-- calculer_progression_objectif et get_objectifs_membre lisent
-- désormais depuis session_entrainement/score_local (archives)
-- ET depuis session/exercice (nouvelles données).
-- ================================================================

DROP FUNCTION IF EXISTS calculer_progression_objectif(UUID);
DROP FUNCTION IF EXISTS get_objectifs_membre(UUID, UUID);


-- ================================================================
-- 1. RPC : calculer_progression_objectif
--
-- Un jour est valide si mécanique ET chaotique sont tous deux
-- validés (depuis l'une ou l'autre source).
-- ================================================================
CREATE OR REPLACE FUNCTION calculer_progression_objectif(p_objectif_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj              RECORD;
  v_prog             RECORD;
  v_nb_jours_valides INTEGER;
  v_atteint          BOOLEAN;
BEGIN
  SELECT * INTO v_obj FROM objectif_hebdomadaire WHERE id = p_objectif_id;

  IF v_obj IS NULL THEN
    RAISE EXCEPTION 'Objectif introuvable : %', p_objectif_id;
  END IF;

  IF v_obj.validation_mode = 'manuel' THEN
    RETURN;
  END IF;

  FOR v_prog IN
    SELECT * FROM progression_objectif WHERE objectif_id = p_objectif_id
  LOOP
    SELECT COUNT(DISTINCT j.date_session) INTO v_nb_jours_valides
    FROM (
      -- Archives
      SELECT DISTINCT date_session
      FROM session_entrainement
      WHERE user_id      = v_prog.user_id
        AND date_session >= v_obj.date_debut
        AND date_session <= v_obj.date_fin
        AND statut       = 'terminee'
      UNION
      -- Nouvelles données
      SELECT DISTINCT date_session
      FROM session
      WHERE user_id      = v_prog.user_id
        AND date_session >= v_obj.date_debut
        AND date_session <= v_obj.date_fin
    ) j
    WHERE
      -- Mécanique valide (archive OU nouvelle session)
      (
        EXISTS (
          SELECT 1 FROM session_entrainement se
          WHERE se.user_id              = v_prog.user_id
            AND se.date_session         = j.date_session
            AND se.statut               = 'terminee'
            AND se.feuille_mecanique_id IS NOT NULL
            AND se.temps_mecanique      >= v_obj.duree_min_session
            AND (
              v_obj.nb_exercices_mecanique = 0
              OR (SELECT COUNT(*) FROM score_local sl WHERE sl.session_id = se.id)
                   >= v_obj.nb_exercices_mecanique
            )
        )
        OR EXISTS (
          SELECT 1 FROM session sn
          WHERE sn.user_id              = v_prog.user_id
            AND sn.date_session         = j.date_session
            AND sn.feuille_mecanique_id IS NOT NULL
            AND sn.duree                >= v_obj.duree_min_session
            AND (
              v_obj.nb_exercices_mecanique = 0
              OR (SELECT COUNT(*) FROM exercice ex
                  WHERE ex.session_id = sn.id AND ex.type = 'mecanique')
                   >= v_obj.nb_exercices_mecanique
            )
        )
      )
      -- ET Chaotique valide (archive OU nouvelle session)
      AND (
        EXISTS (
          SELECT 1 FROM session_entrainement se
          WHERE se.user_id              = v_prog.user_id
            AND se.date_session         = j.date_session
            AND se.statut               = 'terminee'
            AND se.feuille_chaotique_id IS NOT NULL
            AND se.temps_chaotique      >= v_obj.duree_min_session
            AND (
              v_obj.nb_exercices_chaotique = 0
              OR (SELECT COUNT(*) FROM score_local sl WHERE sl.session_id = se.id)
                   >= v_obj.nb_exercices_chaotique
            )
        )
        OR EXISTS (
          SELECT 1 FROM session sn
          WHERE sn.user_id              = v_prog.user_id
            AND sn.date_session         = j.date_session
            AND sn.feuille_chaotique_id IS NOT NULL
            AND sn.duree                >= v_obj.duree_min_session
            AND (
              v_obj.nb_exercices_chaotique = 0
              OR (SELECT COUNT(*) FROM exercice ex
                  WHERE ex.session_id = sn.id AND ex.type = 'chaotique')
                   >= v_obj.nb_exercices_chaotique
            )
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
-- 2. RPC : get_objectifs_membre
--
-- Pour chaque jour, la meilleure session mécanique et chaotique
-- est choisie parmi archives ET nouvelles données.
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
            COALESCE(p.full_name, 'Inconnu') AS nom,
            po.nb_jours_valides,
            po.nb_exercices_mecanique_realises,
            po.nb_exercices_chaotique_realises,
            po.objectif_atteint,
            po.derniere_mise_a_jour,
            (
              SELECT COALESCE(json_agg(jour_data ORDER BY (jour_data->>'date_jour') ASC), '[]'::json)
              FROM (
                SELECT jsonb_build_object(
                  'date_jour',          j.date_jour,
                  'meca_session_id',    meca.id,
                  'meca_duree',         COALESCE(meca.meca_duree, 0),
                  'meca_nb_questions',  COALESCE(meca.meca_nb_q, 0),
                  'meca_valide',        (
                    meca.id IS NOT NULL
                    AND meca.meca_duree >= oh.duree_min_session
                    AND (oh.nb_exercices_mecanique = 0
                         OR COALESCE(meca.meca_nb_q, 0) >= oh.nb_exercices_mecanique)
                  ),
                  'chaos_session_id',   chaos.id,
                  'chaos_duree',        COALESCE(chaos.chaos_duree, 0),
                  'chaos_nb_questions', COALESCE(chaos.chaos_nb_q, 0),
                  'chaos_valide',       (
                    chaos.id IS NOT NULL
                    AND chaos.chaos_duree >= oh.duree_min_session
                    AND (oh.nb_exercices_chaotique = 0
                         OR COALESCE(chaos.chaos_nb_q, 0) >= oh.nb_exercices_chaotique)
                  ),
                  'jour_valide',        (
                    meca.id IS NOT NULL
                    AND meca.meca_duree >= oh.duree_min_session
                    AND (oh.nb_exercices_mecanique = 0
                         OR COALESCE(meca.meca_nb_q, 0) >= oh.nb_exercices_mecanique)
                    AND chaos.id IS NOT NULL
                    AND chaos.chaos_duree >= oh.duree_min_session
                    AND (oh.nb_exercices_chaotique = 0
                         OR COALESCE(chaos.chaos_nb_q, 0) >= oh.nb_exercices_chaotique)
                  )
                ) AS jour_data

                FROM (
                  -- Tous les jours avec une session dans la période (archives + nouvelles)
                  SELECT DISTINCT date_session AS date_jour
                  FROM session_entrainement
                  WHERE user_id      = po.user_id
                    AND date_session >= oh.date_debut
                    AND date_session <= oh.date_fin
                    AND statut       = 'terminee'
                  UNION
                  SELECT DISTINCT date_session AS date_jour
                  FROM session
                  WHERE user_id      = po.user_id
                    AND date_session >= oh.date_debut
                    AND date_session <= oh.date_fin
                ) j

                -- Meilleure session mécanique du jour (archives + nouvelles)
                LEFT JOIN LATERAL (
                  SELECT id, meca_duree, meca_nb_q
                  FROM (
                    SELECT
                      se.id,
                      COALESCE(se.temps_mecanique, 0)         AS meca_duree,
                      (SELECT COUNT(*)::INTEGER FROM score_local sl
                       WHERE sl.session_id = se.id)           AS meca_nb_q
                    FROM session_entrainement se
                    WHERE se.user_id              = po.user_id
                      AND se.date_session         = j.date_jour
                      AND se.statut               = 'terminee'
                      AND se.feuille_mecanique_id IS NOT NULL
                    UNION ALL
                    SELECT
                      sn.id,
                      COALESCE(sn.duree, 0)                   AS meca_duree,
                      (SELECT COUNT(*)::INTEGER FROM exercice ex
                       WHERE ex.session_id = sn.id
                         AND ex.type       = 'mecanique')     AS meca_nb_q
                    FROM session sn
                    WHERE sn.user_id              = po.user_id
                      AND sn.date_session         = j.date_jour
                      AND sn.feuille_mecanique_id IS NOT NULL
                  ) combined_meca
                  ORDER BY meca_duree DESC NULLS LAST
                  LIMIT 1
                ) meca ON TRUE

                -- Meilleure session chaotique du jour (archives + nouvelles)
                LEFT JOIN LATERAL (
                  SELECT id, chaos_duree, chaos_nb_q
                  FROM (
                    SELECT
                      se.id,
                      COALESCE(se.temps_chaotique, 0)         AS chaos_duree,
                      (SELECT COUNT(*)::INTEGER FROM score_local sl
                       WHERE sl.session_id = se.id)           AS chaos_nb_q
                    FROM session_entrainement se
                    WHERE se.user_id              = po.user_id
                      AND se.date_session         = j.date_jour
                      AND se.statut               = 'terminee'
                      AND se.feuille_chaotique_id IS NOT NULL
                    UNION ALL
                    SELECT
                      sn.id,
                      COALESCE(sn.duree, 0)                   AS chaos_duree,
                      (SELECT COUNT(*)::INTEGER FROM exercice ex
                       WHERE ex.session_id = sn.id
                         AND ex.type       = 'chaotique')     AS chaos_nb_q
                    FROM session sn
                    WHERE sn.user_id              = po.user_id
                      AND sn.date_session         = j.date_jour
                      AND sn.feuille_chaotique_id IS NOT NULL
                  ) combined_chaos
                  ORDER BY chaos_duree DESC NULLS LAST
                  LIMIT 1
                ) chaos ON TRUE

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
-- 3. Grants
-- ================================================================
GRANT EXECUTE ON FUNCTION calculer_progression_objectif TO authenticated;
GRANT EXECUTE ON FUNCTION get_objectifs_membre          TO authenticated;
