-- ============================================================
-- Migration : get_user_analytics v2
--
-- Étend le RPC pour lire les deux systèmes en parallèle :
--   Ancien : session_entrainement + score_local
--   Nouveau : session + exercice + score_exercice
--
-- Structure de retour JSONB identique à la v1.
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now              TIMESTAMP := NOW();
    v_3_months_ago     TIMESTAMP := NOW() - INTERVAL '3 months';
    v_1_month_ago      TIMESTAMP := NOW() - INTERVAL '1 month';
    v_12_weeks_ago     TIMESTAMP := NOW() - INTERVAL '12 weeks';

    v_score_now               NUMERIC  := 0;
    v_score_3_months_ago      NUMERIC  := 0;
    v_score_progression       NUMERIC  := 0;
    v_total_minutes           NUMERIC  := 0;
    v_total_questions         INTEGER  := 0;

    v_global_minutes          NUMERIC  := 0;
    v_global_questions        INTEGER  := 0;
    v_global_score_progression NUMERIC := 0;

    v_temps_par_mois    JSONB;
    v_score_12_semaines JSONB;
    v_score_composantes JSONB;
    v_feuilles_par_mois JSONB;
    v_feuilles_total    INTEGER := 0;
    v_feuilles_ce_mois  INTEGER := 0;

    v_result JSONB;
BEGIN

    -- ============================================================
    -- MÉTRIQUE 1 : Score actuel (cumul total, les deux systèmes)
    --
    -- Ancien  : score_calcule * 100  → [0, 130]
    -- Nouveau : mécanique  = reussi ? 100 : 0
    --           chaotique  = somme des 13 booléens * 10  → [0, 130]
    -- ============================================================

    SELECT COALESCE(SUM(pts), 0)
    INTO v_score_now
    FROM (
        -- Ancien système
        SELECT sl.score_calcule * 100 AS pts
        FROM score_local sl
        JOIN session_entrainement se ON sl.session_id = se.id
        WHERE se.user_id = p_user_id

        UNION ALL

        -- Nouveau système
        SELECT
            CASE WHEN ex.type = 'mecanique'
                 THEN CASE WHEN sep.reussi THEN 100.0 ELSE 0.0 END
                 ELSE (
                     COALESCE(sep.c1, FALSE)::int + COALESCE(sep.c2, FALSE)::int +
                     COALESCE(sep.c3, FALSE)::int + COALESCE(sep.c4, FALSE)::int +
                     COALESCE(sep.s1, FALSE)::int + COALESCE(sep.s2, FALSE)::int +
                     COALESCE(sep.s3, FALSE)::int + COALESCE(sep.s4, FALSE)::int +
                     COALESCE(sep.r1, FALSE)::int + COALESCE(sep.r2, FALSE)::int +
                     COALESCE(sep.r3, FALSE)::int + COALESCE(sep.r4, FALSE)::int +
                     COALESCE(sep.correction, FALSE)::int
                 ) * 10.0
            END AS pts
        FROM score_exercice sep
        JOIN exercice ex  ON ex.id  = sep.exercice_id
        JOIN session    sn ON sn.id = ex.session_id
        WHERE sn.user_id = p_user_id
    ) all_scores;

    -- Score il y a 3 mois (cumul jusqu'à cette date)
    SELECT COALESCE(SUM(pts), 0)
    INTO v_score_3_months_ago
    FROM (
        SELECT sl.score_calcule * 100 AS pts
        FROM score_local sl
        JOIN session_entrainement se ON sl.session_id = se.id
        WHERE se.user_id    = p_user_id
          AND se.date_session < v_3_months_ago::DATE

        UNION ALL

        SELECT
            CASE WHEN ex.type = 'mecanique'
                 THEN CASE WHEN sep.reussi THEN 100.0 ELSE 0.0 END
                 ELSE (
                     COALESCE(sep.c1, FALSE)::int + COALESCE(sep.c2, FALSE)::int +
                     COALESCE(sep.c3, FALSE)::int + COALESCE(sep.c4, FALSE)::int +
                     COALESCE(sep.s1, FALSE)::int + COALESCE(sep.s2, FALSE)::int +
                     COALESCE(sep.s3, FALSE)::int + COALESCE(sep.s4, FALSE)::int +
                     COALESCE(sep.r1, FALSE)::int + COALESCE(sep.r2, FALSE)::int +
                     COALESCE(sep.r3, FALSE)::int + COALESCE(sep.r4, FALSE)::int +
                     COALESCE(sep.correction, FALSE)::int
                 ) * 10.0
            END AS pts
        FROM score_exercice sep
        JOIN exercice ex  ON ex.id  = sep.exercice_id
        JOIN session    sn ON sn.id = ex.session_id
        WHERE sn.user_id     = p_user_id
          AND sn.date_session < v_3_months_ago::DATE
    ) all_scores_3m;

    v_score_progression := v_score_now - v_score_3_months_ago;

    -- ============================================================
    -- MÉTRIQUE 2 : Minutes de concentration (3 derniers mois)
    --
    -- Ancien  : temps_mecanique + temps_chaotique par session
    -- Nouveau : duree par session
    -- ============================================================

    SELECT COALESCE(SUM(minutes), 0)
    INTO v_total_minutes
    FROM (
        SELECT COALESCE(temps_mecanique, 0) + COALESCE(temps_chaotique, 0) AS minutes
        FROM session_entrainement
        WHERE user_id      = p_user_id
          AND date_session >= v_3_months_ago::DATE

        UNION ALL

        SELECT COALESCE(duree, 0) AS minutes
        FROM session
        WHERE user_id      = p_user_id
          AND date_session >= v_3_months_ago::DATE
    ) all_minutes;

    -- ============================================================
    -- MÉTRIQUE 3 : Questions/exercices travaillés (3 derniers mois)
    -- ============================================================

    SELECT COUNT(*)
    INTO v_total_questions
    FROM (
        SELECT sl.id
        FROM score_local sl
        JOIN session_entrainement se ON sl.session_id = se.id
        WHERE se.user_id     = p_user_id
          AND se.date_session >= v_3_months_ago::DATE

        UNION ALL

        SELECT sep.id
        FROM score_exercice sep
        JOIN exercice ex  ON ex.id  = sep.exercice_id
        JOIN session    sn ON sn.id = ex.session_id
        WHERE sn.user_id     = p_user_id
          AND sn.date_session >= v_3_months_ago::DATE
    ) all_questions;

    -- ============================================================
    -- MÉTRIQUES GLOBALES (tout l'historique)
    -- ============================================================

    SELECT COALESCE(SUM(minutes), 0)
    INTO v_global_minutes
    FROM (
        SELECT COALESCE(temps_mecanique, 0) + COALESCE(temps_chaotique, 0) AS minutes
        FROM session_entrainement
        WHERE user_id = p_user_id

        UNION ALL

        SELECT COALESCE(duree, 0) AS minutes
        FROM session
        WHERE user_id = p_user_id
    ) all_minutes_global;

    SELECT COUNT(*)
    INTO v_global_questions
    FROM (
        SELECT sl.id
        FROM score_local sl
        JOIN session_entrainement se ON sl.session_id = se.id
        WHERE se.user_id = p_user_id

        UNION ALL

        SELECT sep.id
        FROM score_exercice sep
        JOIN exercice ex  ON ex.id  = sep.exercice_id
        JOIN session    sn ON sn.id = ex.session_id
        WHERE sn.user_id = p_user_id
    ) all_questions_global;

    -- Score progression global = cumul total (identique à v_score_now)
    v_global_score_progression := v_score_now;

    -- ============================================================
    -- MÉTRIQUE 4 : Temps de travail par mois (3 derniers mois)
    -- ============================================================

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'mois',                mois_label,
            'annee',               annee,
            'mois_num',            mois_num,
            'total_minutes',       total_minutes,
            'moyenne_par_session', ROUND(moyenne_par_session, 1)
        ) ORDER BY annee, mois_num
    ), '[]'::jsonb)
    INTO v_temps_par_mois
    FROM (
        SELECT
            TO_CHAR(date_session, 'Mon')                AS mois_label,
            EXTRACT(YEAR  FROM date_session)::INTEGER   AS annee,
            EXTRACT(MONTH FROM date_session)::INTEGER   AS mois_num,
            SUM(minutes)                                AS total_minutes,
            AVG(minutes)                                AS moyenne_par_session
        FROM (
            -- Ancien : une ligne par session avec la durée totale
            SELECT date_session,
                   COALESCE(temps_mecanique, 0) + COALESCE(temps_chaotique, 0) AS minutes
            FROM session_entrainement
            WHERE user_id      = p_user_id
              AND date_session >= v_3_months_ago::DATE

            UNION ALL

            -- Nouveau : une ligne par session avec duree
            SELECT date_session,
                   COALESCE(duree, 0) AS minutes
            FROM session
            WHERE user_id      = p_user_id
              AND date_session >= v_3_months_ago::DATE
        ) all_sessions
        GROUP BY
            TO_CHAR(date_session, 'Mon'),
            EXTRACT(YEAR  FROM date_session),
            EXTRACT(MONTH FROM date_session)
    ) sub;

    -- ============================================================
    -- MÉTRIQUE 5 : Score moyen par semaine (12 dernières semaines)
    --
    -- score_norm dans [0, 1.3] pour les deux sources.
    -- score_moyen_pct = score_norm * 100 → [0, 130].
    -- ============================================================

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'semaine',        semaine_num,
            'annee',          annee,
            'debut_semaine',  debut_semaine,
            'score_moyen',    ROUND(score_moyen, 4),
            'score_moyen_pct', ROUND(score_moyen * 100, 1),
            'nb_questions',   nb_questions
        ) ORDER BY annee, semaine_num
    ), '[]'::jsonb)
    INTO v_score_12_semaines
    FROM (
        SELECT
            EXTRACT(WEEK FROM date_session)::INTEGER        AS semaine_num,
            EXTRACT(YEAR FROM date_session)::INTEGER        AS annee,
            DATE_TRUNC('week', date_session)::DATE          AS debut_semaine,
            AVG(score_norm)                                 AS score_moyen,
            COUNT(*)                                        AS nb_questions
        FROM (
            -- Ancien système : score_calcule ∈ [0, 1.3]
            SELECT se.date_session,
                   sl.score_calcule AS score_norm
            FROM score_local sl
            JOIN session_entrainement se ON sl.session_id = se.id
            WHERE se.user_id     = p_user_id
              AND se.date_session >= v_12_weeks_ago::DATE

            UNION ALL

            -- Nouveau système : score normalisé sur [0, 1.3]
            SELECT sn.date_session,
                CASE WHEN ex.type = 'mecanique'
                     THEN CASE WHEN sep.reussi THEN 1.0 ELSE 0.0 END
                     ELSE (
                         COALESCE(sep.c1, FALSE)::int + COALESCE(sep.c2, FALSE)::int +
                         COALESCE(sep.c3, FALSE)::int + COALESCE(sep.c4, FALSE)::int +
                         COALESCE(sep.s1, FALSE)::int + COALESCE(sep.s2, FALSE)::int +
                         COALESCE(sep.s3, FALSE)::int + COALESCE(sep.s4, FALSE)::int +
                         COALESCE(sep.r1, FALSE)::int + COALESCE(sep.r2, FALSE)::int +
                         COALESCE(sep.r3, FALSE)::int + COALESCE(sep.r4, FALSE)::int +
                         COALESCE(sep.correction, FALSE)::int
                     ) / 10.0
                END AS score_norm
            FROM score_exercice sep
            JOIN exercice ex  ON ex.id  = sep.exercice_id
            JOIN session    sn ON sn.id = ex.session_id
            WHERE sn.user_id     = p_user_id
              AND sn.date_session >= v_12_weeks_ago::DATE
        ) all_scores
        GROUP BY
            EXTRACT(WEEK FROM date_session),
            EXTRACT(YEAR FROM date_session),
            DATE_TRUNC('week', date_session)
    ) sub;

    -- ============================================================
    -- MÉTRIQUE 6 : Évolution par composante (dernier mois)
    --
    -- Ancien  : comprehension/savoir/redaction ∈ [0, 100]
    -- Nouveau : chaotique uniquement (mécanique exclu)
    --   comprehension = (c1+c2+c3+c4) / 4.0 * 100
    --   savoir        = (s1+s2+s3+s4) / 4.0 * 100
    --   redaction     = (r1+r2+r3+r4) / 4.0 * 100
    -- ============================================================

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'semaine',           semaine_num,
            'debut_semaine',     debut_semaine,
            'comprehension_moy', ROUND(comprehension_moy, 1),
            'savoir_moy',        ROUND(savoir_moy,        1),
            'redaction_moy',     ROUND(redaction_moy,     1),
            'nb_questions',      nb_questions
        ) ORDER BY annee, semaine_num
    ), '[]'::jsonb)
    INTO v_score_composantes
    FROM (
        SELECT
            EXTRACT(WEEK FROM date_session)::INTEGER AS semaine_num,
            EXTRACT(YEAR FROM date_session)::INTEGER AS annee,
            DATE_TRUNC('week', date_session)::DATE   AS debut_semaine,
            AVG(comprehension)                       AS comprehension_moy,
            AVG(savoir)                              AS savoir_moy,
            AVG(redaction)                           AS redaction_moy,
            COUNT(*)                                 AS nb_questions
        FROM (
            -- Ancien système
            SELECT se.date_session,
                   sl.comprehension,
                   sl.savoir,
                   sl.redaction
            FROM score_local sl
            JOIN session_entrainement se ON sl.session_id = se.id
            WHERE se.user_id     = p_user_id
              AND se.date_session >= v_1_month_ago::DATE

            UNION ALL

            -- Nouveau système : chaotique uniquement
            SELECT sn.date_session,
                   (COALESCE(sep.c1, FALSE)::int + COALESCE(sep.c2, FALSE)::int +
                    COALESCE(sep.c3, FALSE)::int + COALESCE(sep.c4, FALSE)::int
                   ) / 4.0 * 100 AS comprehension,
                   (COALESCE(sep.s1, FALSE)::int + COALESCE(sep.s2, FALSE)::int +
                    COALESCE(sep.s3, FALSE)::int + COALESCE(sep.s4, FALSE)::int
                   ) / 4.0 * 100 AS savoir,
                   (COALESCE(sep.r1, FALSE)::int + COALESCE(sep.r2, FALSE)::int +
                    COALESCE(sep.r3, FALSE)::int + COALESCE(sep.r4, FALSE)::int
                   ) / 4.0 * 100 AS redaction
            FROM score_exercice sep
            JOIN exercice ex  ON ex.id  = sep.exercice_id
            JOIN session    sn ON sn.id = ex.session_id
            WHERE sn.user_id     = p_user_id
              AND sn.date_session >= v_1_month_ago::DATE
              AND ex.type         = 'chaotique'
        ) all_composantes
        GROUP BY
            EXTRACT(WEEK FROM date_session),
            EXTRACT(YEAR FROM date_session),
            DATE_TRUNC('week', date_session)
    ) sub;

    -- ============================================================
    -- MÉTRIQUE 7 : Feuilles validées
    -- Aucun changement — progression_feuille est commune
    -- aux deux systèmes.
    -- ============================================================

    SELECT COUNT(*)
    INTO v_feuilles_total
    FROM progression_feuille
    WHERE user_id = p_user_id
      AND statut  = 'validee';

    SELECT COUNT(*)
    INTO v_feuilles_ce_mois
    FROM progression_feuille
    WHERE user_id   = p_user_id
      AND statut    = 'validee'
      AND validee_at >= DATE_TRUNC('month', v_now);

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'mois',               mois_label,
            'annee',              annee,
            'mois_num',           mois_num,
            'nb_feuilles_validees', nb_feuilles
        ) ORDER BY annee, mois_num
    ), '[]'::jsonb)
    INTO v_feuilles_par_mois
    FROM (
        SELECT
            TO_CHAR(validee_at, 'Mon')                AS mois_label,
            EXTRACT(YEAR  FROM validee_at)::INTEGER   AS annee,
            EXTRACT(MONTH FROM validee_at)::INTEGER   AS mois_num,
            COUNT(*)                                  AS nb_feuilles
        FROM progression_feuille
        WHERE user_id   = p_user_id
          AND statut    = 'validee'
          AND validee_at >= v_3_months_ago
        GROUP BY
            TO_CHAR(validee_at, 'Mon'),
            EXTRACT(YEAR  FROM validee_at),
            EXTRACT(MONTH FROM validee_at)
    ) sub;

    -- ============================================================
    -- CONSTRUCTION DU RÉSULTAT FINAL
    -- Structure identique à la v1.
    -- ============================================================

    v_result := jsonb_build_object(
        'user_id',       p_user_id,
        'generated_at',  v_now,
        'periode_analyse', jsonb_build_object(
            'debut_3_mois',      v_3_months_ago::DATE,
            'debut_1_mois',      v_1_month_ago::DATE,
            'debut_12_semaines', v_12_weeks_ago::DATE,
            'fin',               v_now::DATE
        ),

        'trois_mois', jsonb_build_object(
            'score_progression',    ROUND(v_score_progression,    1),
            'score_actuel',         ROUND(v_score_now,            1),
            'score_il_y_a_3_mois',  ROUND(v_score_3_months_ago,   1),
            'minutes_concentration', v_total_minutes,
            'heures_concentration', ROUND(v_total_minutes / 60.0, 1),
            'questions_travaillees', v_total_questions
        ),

        'global', jsonb_build_object(
            'score_progression',    ROUND(v_global_score_progression, 1),
            'minutes_concentration', v_global_minutes,
            'questions_travaillees', v_global_questions
        ),

        'evolution', jsonb_build_object(
            'temps_par_mois',          v_temps_par_mois,
            'score_12_semaines',       v_score_12_semaines,
            'composantes_dernier_mois', v_score_composantes
        ),

        'feuilles', jsonb_build_object(
            'total_validees',   v_feuilles_total,
            'validees_ce_mois', v_feuilles_ce_mois,
            'par_mois',         v_feuilles_par_mois
        )
    );

    RETURN v_result;
END;
$$;

-- ============================================================
-- Permissions (inchangées)
-- ============================================================

GRANT EXECUTE ON FUNCTION get_user_analytics(UUID) TO authenticated;
