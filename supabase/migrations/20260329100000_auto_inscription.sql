-- Chantier 2 : logique autonome — colonne auto_inscrit
ALTER TABLE progression_feuille
  ADD COLUMN IF NOT EXISTS auto_inscrit boolean DEFAULT false;
