-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION DES DONNÉES EXISTANTES
-- Corrige les incohérences causées par les bugs dans les RPCs
-- Date: 2026-02-04
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Corriger les feuilles validées qui ont encore en_cours = true
--    Bug: valider_soumission_feuille ne mettait pas en_cours = false
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE progression_feuille
SET en_cours = false
WHERE statut = 'validee' AND en_cours = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Créer les records manquants dans progression_feuille
--    Bug: gerer_feuilles_membre ne créait pas de record dans progression_feuille
--    Résultat: certaines feuilles autorisées n'ont pas de progression associée
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO progression_feuille (user_id, feuille_id, en_cours, statut, est_termine)
SELECT me.user_id, fa.feuille_id, true, 'en_attente', false
FROM feuilles_autorisees fa
JOIN membre_equipe me ON me.id = fa.membre_id
WHERE NOT EXISTS (
    SELECT 1 FROM progression_feuille pf
    WHERE pf.user_id = me.user_id AND pf.feuille_id = fa.feuille_id
);
