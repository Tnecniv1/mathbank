-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION DES DONNÉES EXISTANTES
-- Crée les progressions manquantes pour les feuilles autorisées
-- Date: 2025-02-05
-- ═══════════════════════════════════════════════════════════════════════════

-- Créer les progressions manquantes pour les feuilles autorisées
INSERT INTO progression_feuille (user_id, feuille_id, en_cours, statut, est_termine)
SELECT
  me.user_id,
  fa.feuille_id,
  true,
  'en_attente',
  false
FROM feuilles_autorisees fa
JOIN membre_equipe me ON me.id = fa.membre_id
WHERE NOT EXISTS (
  SELECT 1 FROM progression_feuille pf
  WHERE pf.user_id = me.user_id
    AND pf.feuille_id = fa.feuille_id
);

-- Afficher le résumé
SELECT
  'Progressions créées pour feuilles autorisées' as action,
  COUNT(*) as nombre
FROM progression_feuille pf
JOIN feuilles_autorisees fa ON fa.feuille_id = pf.feuille_id
JOIN membre_equipe me ON me.id = fa.membre_id AND me.user_id = pf.user_id
WHERE pf.en_cours = true AND pf.statut = 'en_attente';
