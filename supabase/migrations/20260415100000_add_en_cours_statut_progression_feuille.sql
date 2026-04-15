-- Ajout des colonnes manquantes à progression_feuille
-- en_cours : indique qu'une feuille est active pour l'utilisateur
-- statut   : état textuel de la progression (ex: 'en_cours', 'validee')

ALTER TABLE progression_feuille
  ADD COLUMN IF NOT EXISTS en_cours BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS statut   TEXT;
