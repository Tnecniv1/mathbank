-- Chantier 3 : progression autonome

-- Nombre d'exercices total par feuille (saisi manuellement dans l'admin)
ALTER TABLE noeud
  ADD COLUMN IF NOT EXISTS nb_exercices integer;

-- Score moyen calculé sur la feuille (mis à jour par l'agent IA)
ALTER TABLE progression_feuille
  ADD COLUMN IF NOT EXISTS score_moyen numeric DEFAULT 0;

-- Nombre d'exercices validés (mis à jour par l'agent IA)
ALTER TABLE progression_feuille
  ADD COLUMN IF NOT EXISTS nb_exercices_valides integer DEFAULT 0;
