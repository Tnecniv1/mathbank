-- ================================================================
-- Migration : Simplification des scores mécaniques
--
-- Les exercices mécaniques passent d'un système 3 critères
-- (compréhension, savoir, rédaction) à un simple VRAI/FAUX.
--
-- Stockage retenu :
--   comprehension = NULL
--   redaction     = NULL
--   savoir        = 100 (VRAI) ou 0 (FAUX)
--
-- La contrainte savoir IN (0, 25, 50, 75, 100) est déjà
-- compatible (0 et 100 sont dans l'ensemble autorisé).
--
-- Règle de migration des données existantes :
--   savoir > 0  → 100 (VRAI)
--   savoir = 0  → 0   (FAUX)
-- ================================================================

UPDATE score_local sl
SET
  comprehension = NULL,
  redaction     = NULL,
  savoir        = CASE WHEN sl.savoir > 0 THEN 100 ELSE 0 END
FROM session_entrainement se
WHERE sl.session_id             = se.id
  AND se.feuille_mecanique_id   IS NOT NULL;
