-- ═══════════════════════════════════════════════════════════════════════════
-- FONCTION: get_user_analytics
-- Description: Retourne les analytics complètes pour un utilisateur donné
-- Auteur: Claude
-- Date: 2025-01-30
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    -- Dates de référence
    v_now TIMESTAMP := NOW();
    v_3_months_ago TIMESTAMP := NOW() - INTERVAL '3 months';
    v_1_month_ago TIMESTAMP := NOW() - INTERVAL '1 month';
    v_12_weeks_ago TIMESTAMP := NOW() - INTERVAL '12 weeks';

    -- Variables pour les calculs
    v_score_now NUMERIC := 0;
    v_score_3_months_ago NUMERIC := 0;
    v_score_progression NUMERIC := 0;
    v_total_minutes NUMERIC := 0;
    v_total_questions INTEGER := 0;

    -- Résultats JSON
    v_temps_par_mois JSONB;
    v_score_12_semaines JSONB;
    v_score_composantes JSONB;
    v_feuilles_par_mois JSONB;
    v_feuilles_total INTEGER := 0;
    v_feuilles_ce_mois INTEGER := 0;

    v_result JSONB;
BEGIN
    -- ═══════════════════════════════════════════════════════════════════════
    -- MÉTRIQUE 1: Progression du score global sur 3 mois
    -- Score = somme cumulative de (score_calcule * 100)
    -- ═══════════════════════════════════════════════════════════════════════

    -- Score actuel (cumul total)
    SELECT COALESCE(SUM(sl.score_calcule * 100), 0)
    INTO v_score_now
    FROM score_local sl
    INNER JOIN session_entrainement se ON sl.session_id = se.id
    WHERE se.user_id = p_user_id;

    -- Score il y a 3 mois (cumul jusqu'à cette date)
    SELECT COALESCE(SUM(sl.score_calcule * 100), 0)
    INTO v_score_3_months_ago
    FROM score_local sl
    INNER JOIN session_entrainement se ON sl.session_id = se.id
    WHERE se.user_id = p_user_id
      AND se.date_session < v_3_months_ago::DATE;

    v_score_progression := v_score_now - v_score_3_months_ago;

    -- ═══════════════════════════════════════════════════════════════════════
    -- MÉTRIQUE 2: Minutes de concentration (3 derniers mois)
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT COALESCE(SUM(COALESCE(temps_mecanique, 0) + COALESCE(temps_chaotique, 0)), 0)
    INTO v_total_minutes
    FROM session_entrainement
    WHERE user_id = p_user_id
      AND date_session >= v_3_months_ago::DATE;

    -- ═══════════════════════════════════════════════════════════════════════
    -- MÉTRIQUE 3: Nombre de questions travaillées (3 derniers mois)
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT COUNT(*)
    INTO v_total_questions
    FROM score_local sl
    INNER JOIN session_entrainement se ON sl.session_id = se.id
    WHERE se.user_id = p_user_id
      AND se.date_session >= v_3_months_ago::DATE;

    -- ═══════════════════════════════════════════════════════════════════════
    -- MÉTRIQUE 4: Volume moyen de temps par mois (3 derniers mois)
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'mois', mois_label,
            'annee', annee,
            'mois_num', mois_num,
            'total_minutes', total_minutes,
            'moyenne_par_session', ROUND(moyenne_par_session, 1)
        ) ORDER BY annee, mois_num
    ), '[]'::jsonb)
    INTO v_temps_par_mois
    FROM (
        SELECT
            TO_CHAR(date_session, 'Mon') AS mois_label,
            EXTRACT(YEAR FROM date_session)::INTEGER AS annee,
            EXTRACT(MONTH FROM date_session)::INTEGER AS mois_num,
            SUM(COALESCE(temps_mecanique, 0) + COALESCE(temps_chaotique, 0)) AS total_minutes,
            AVG(COALESCE(temps_mecanique, 0) + COALESCE(temps_chaotique, 0)) AS moyenne_par_session
        FROM session_entrainement
        WHERE user_id = p_user_id
          AND date_session >= v_3_months_ago::DATE
        GROUP BY
            TO_CHAR(date_session, 'Mon'),
            EXTRACT(YEAR FROM date_session),
            EXTRACT(MONTH FROM date_session)
    ) sub;

    -- ═══════════════════════════════════════════════════════════════════════
    -- MÉTRIQUE 5: Évolution du score_calcule sur 12 semaines
    -- Score moyen par semaine (mécanique + chaotique confondus)
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'semaine', semaine_num,
            'annee', annee,
            'debut_semaine', debut_semaine,
            'score_moyen', ROUND(score_moyen, 4),
            'score_moyen_pct', ROUND(score_moyen * 100, 1),
            'nb_questions', nb_questions
        ) ORDER BY annee, semaine_num
    ), '[]'::jsonb)
    INTO v_score_12_semaines
    FROM (
        SELECT
            EXTRACT(WEEK FROM se.date_session)::INTEGER AS semaine_num,
            EXTRACT(YEAR FROM se.date_session)::INTEGER AS annee,
            DATE_TRUNC('week', se.date_session)::DATE AS debut_semaine,
            AVG(sl.score_calcule) AS score_moyen,
            COUNT(*) AS nb_questions
        FROM score_local sl
        INNER JOIN session_entrainement se ON sl.session_id = se.id
        WHERE se.user_id = p_user_id
          AND se.date_session >= v_12_weeks_ago::DATE
        GROUP BY
            EXTRACT(WEEK FROM se.date_session),
            EXTRACT(YEAR FROM se.date_session),
            DATE_TRUNC('week', se.date_session)
    ) sub;

    -- ═══════════════════════════════════════════════════════════════════════
    -- MÉTRIQUE 6: Évolution par composante sur le dernier mois
    -- Moyennes hebdomadaires de Compréhension, Savoir, Rédaction
    -- ═══════════════════════════════════════════════════════════════════════

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'semaine', semaine_num,
            'debut_semaine', debut_semaine,
            'comprehension_moy', ROUND(comprehension_moy, 1),
            'savoir_moy', ROUND(savoir_moy, 1),
            'redaction_moy', ROUND(redaction_moy, 1),
            'nb_questions', nb_questions
        ) ORDER BY annee, semaine_num
    ), '[]'::jsonb)
    INTO v_score_composantes
    FROM (
        SELECT
            EXTRACT(WEEK FROM se.date_session)::INTEGER AS semaine_num,
            EXTRACT(YEAR FROM se.date_session)::INTEGER AS annee,
            DATE_TRUNC('week', se.date_session)::DATE AS debut_semaine,
            AVG(sl.comprehension) AS comprehension_moy,
            AVG(sl.savoir) AS savoir_moy,
            AVG(sl.redaction) AS redaction_moy,
            COUNT(*) AS nb_questions
        FROM score_local sl
        INNER JOIN session_entrainement se ON sl.session_id = se.id
        WHERE se.user_id = p_user_id
          AND se.date_session >= v_1_month_ago::DATE
        GROUP BY
            EXTRACT(WEEK FROM se.date_session),
            EXTRACT(YEAR FROM se.date_session),
            DATE_TRUNC('week', se.date_session)
    ) sub;

    -- ═══════════════════════════════════════════════════════════════════════
    -- MÉTRIQUE 7: Feuilles validées
    -- - Par mois (3 derniers mois)
    -- - Total historique
    -- - Ce mois-ci
    -- ═══════════════════════════════════════════════════════════════════════

    -- Total de feuilles validées (historique complet)
    SELECT COUNT(*)
    INTO v_feuilles_total
    FROM progression_feuille
    WHERE user_id = p_user_id
      AND statut = 'validee';

    -- Feuilles validées ce mois-ci
    SELECT COUNT(*)
    INTO v_feuilles_ce_mois
    FROM progression_feuille
    WHERE user_id = p_user_id
      AND statut = 'validee'
      AND validee_at >= DATE_TRUNC('month', v_now);

    -- Feuilles validées par mois (3 derniers mois)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'mois', mois_label,
            'annee', annee,
            'mois_num', mois_num,
            'nb_feuilles_validees', nb_feuilles
        ) ORDER BY annee, mois_num
    ), '[]'::jsonb)
    INTO v_feuilles_par_mois
    FROM (
        SELECT
            TO_CHAR(validee_at, 'Mon') AS mois_label,
            EXTRACT(YEAR FROM validee_at)::INTEGER AS annee,
            EXTRACT(MONTH FROM validee_at)::INTEGER AS mois_num,
            COUNT(*) AS nb_feuilles
        FROM progression_feuille
        WHERE user_id = p_user_id
          AND statut = 'validee'
          AND validee_at >= v_3_months_ago
        GROUP BY
            TO_CHAR(validee_at, 'Mon'),
            EXTRACT(YEAR FROM validee_at),
            EXTRACT(MONTH FROM validee_at)
    ) sub;

    -- ═══════════════════════════════════════════════════════════════════════
    -- CONSTRUCTION DU RÉSULTAT FINAL
    -- ═══════════════════════════════════════════════════════════════════════

    v_result := jsonb_build_object(
        'user_id', p_user_id,
        'generated_at', v_now,
        'periode_analyse', jsonb_build_object(
            'debut_3_mois', v_3_months_ago::DATE,
            'debut_1_mois', v_1_month_ago::DATE,
            'debut_12_semaines', v_12_weeks_ago::DATE,
            'fin', v_now::DATE
        ),

        -- Métriques sur 3 mois
        'trois_mois', jsonb_build_object(
            'score_progression', ROUND(v_score_progression, 1),
            'score_actuel', ROUND(v_score_now, 1),
            'score_il_y_a_3_mois', ROUND(v_score_3_months_ago, 1),
            'minutes_concentration', v_total_minutes,
            'heures_concentration', ROUND(v_total_minutes / 60.0, 1),
            'questions_travaillees', v_total_questions
        ),

        -- Évolutions temporelles
        'evolution', jsonb_build_object(
            'temps_par_mois', v_temps_par_mois,
            'score_12_semaines', v_score_12_semaines,
            'composantes_dernier_mois', v_score_composantes
        ),

        -- Feuilles validées
        'feuilles', jsonb_build_object(
            'total_validees', v_feuilles_total,
            'validees_ce_mois', v_feuilles_ce_mois,
            'par_mois', v_feuilles_par_mois
        )
    );

    RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTAIRE ET PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION get_user_analytics(UUID) IS
'Retourne les analytics complètes pour un utilisateur:
- Progression du score sur 3 mois (cumul score_calcule * 100)
- Minutes/heures de concentration
- Questions travaillées
- Volume de temps par mois
- Évolution du score sur 12 semaines
- Évolution des composantes (compréhension, savoir, rédaction) sur 1 mois
- Feuilles validées (total + ce mois + par mois)';

-- Autoriser l'exécution pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_user_analytics(UUID) TO authenticated;
