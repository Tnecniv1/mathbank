-- ═══════════════════════════════════════════════════════════════════════════
-- VUES: Classement utilisateurs et équipes
-- Description: Calcule les scores globaux pour le classement
-- Score = SUM(score_local.score_calcule * 100)
--
-- IMPORTANT: Les vues partent des sessions/scores, pas des profiles,
-- car certains utilisateurs peuvent avoir des scores sans profil.
-- IMPORTANT: JOIN sur p.user_id (pas p.id) car profiles a une colonne user_id
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- VUE: v_classement_utilisateurs
-- Classement individuel basé sur le score global
-- Basée sur les utilisateurs avec des scores (pas sur profiles)
-- ═══════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS v_classement_utilisateurs;

CREATE OR REPLACE VIEW v_classement_utilisateurs AS
WITH scores_utilisateurs AS (
    SELECT
        se.user_id,
        SUM(sl.score_calcule * 100) AS score_total,
        AVG(sl.score_calcule) AS score_moyen
    FROM score_local sl
    INNER JOIN session_entrainement se ON sl.session_id = se.id
    GROUP BY se.user_id
),
feuilles_validees AS (
    SELECT
        user_id,
        COUNT(*) AS nb_feuilles_validees
    FROM progression_feuille
    WHERE statut = 'validee'
    GROUP BY user_id
)
SELECT
    COALESCE(su.user_id, fv.user_id) AS user_id,
    COALESCE(p.full_name, 'Utilisateur') AS full_name,
    me.equipe_id,
    e.nom AS equipe_nom,
    COALESCE(fv.nb_feuilles_validees, 0) AS nb_feuilles_validees,
    COALESCE(ROUND(su.score_total::numeric, 0), 0) AS score_total,
    COALESCE(ROUND(su.score_moyen::numeric * 100, 1), 0) AS score_moyen
FROM scores_utilisateurs su
FULL OUTER JOIN feuilles_validees fv ON fv.user_id = su.user_id
LEFT JOIN profiles p ON p.user_id = COALESCE(su.user_id, fv.user_id)
LEFT JOIN membre_equipe me ON me.user_id = COALESCE(su.user_id, fv.user_id)
LEFT JOIN equipe e ON e.id = me.equipe_id
WHERE su.score_total > 0 OR fv.nb_feuilles_validees > 0
ORDER BY score_total DESC, nb_feuilles_validees DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- VUE: v_classement_equipes
-- Classement des équipes basé sur le score cumulé des membres
-- ═══════════════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS v_classement_equipes;

CREATE OR REPLACE VIEW v_classement_equipes AS
SELECT
    e.id AS equipe_id,
    e.nom AS equipe_nom,
    e.description,
    e.couleur,
    e.chef_id,
    COALESCE(chef.full_name, 'Inconnu') AS chef_nom,
    COALESCE(membres.nb_membres, 0) AS nb_membres,
    COALESCE(ROUND(scores.score_total::numeric, 0), 0) AS score_total,
    COALESCE(feuilles.nb_feuilles_validees, 0) AS nb_feuilles_validees
FROM equipe e
LEFT JOIN profiles chef ON chef.user_id = e.chef_id
LEFT JOIN (
    SELECT equipe_id, COUNT(*) AS nb_membres
    FROM membre_equipe
    GROUP BY equipe_id
) membres ON membres.equipe_id = e.id
LEFT JOIN (
    SELECT
        me.equipe_id,
        SUM(sl.score_calcule * 100) AS score_total
    FROM membre_equipe me
    INNER JOIN session_entrainement se ON se.user_id = me.user_id
    INNER JOIN score_local sl ON sl.session_id = se.id
    GROUP BY me.equipe_id
) scores ON scores.equipe_id = e.id
LEFT JOIN (
    SELECT
        me.equipe_id,
        COUNT(*) AS nb_feuilles_validees
    FROM membre_equipe me
    INNER JOIN progression_feuille pf ON pf.user_id = me.user_id
    WHERE pf.statut = 'validee'
    GROUP BY me.equipe_id
) feuilles ON feuilles.equipe_id = e.id
ORDER BY score_total DESC, nb_feuilles_validees DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════

GRANT SELECT ON v_classement_utilisateurs TO authenticated;
GRANT SELECT ON v_classement_equipes TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMMENTAIRES
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON VIEW v_classement_utilisateurs IS
'Vue du classement individuel. Score = SUM(score_local.score_calcule * 100).
Basée sur les sessions (pas profiles) pour inclure tous les utilisateurs avec des scores.
JOIN sur profiles.user_id (pas profiles.id).';

COMMENT ON VIEW v_classement_equipes IS
'Vue du classement des équipes. Score = somme des scores de tous les membres.
JOIN sur profiles.user_id pour le chef.';
