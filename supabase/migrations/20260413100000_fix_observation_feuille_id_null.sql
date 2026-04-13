-- Correction : observations créées sans feuille_id
-- Remonte le feuille_id depuis l'entrainement associé
UPDATE observation
SET feuille_id = (
  SELECT feuille_id
  FROM entrainement
  WHERE id = observation.entrainement_id_final
)
WHERE feuille_id IS NULL
  AND entrainement_id_final IS NOT NULL;
