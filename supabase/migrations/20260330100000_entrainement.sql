CREATE TABLE IF NOT EXISTS entrainement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  statut text NOT NULL DEFAULT 'en_cours'
    CHECK (statut IN ('en_cours', 'boucle')),
  mode text NOT NULL DEFAULT 'assiste'
    CHECK (mode IN ('autonome', 'assiste')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE entrainement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user sees own" ON entrainement
  FOR ALL USING (auth.uid() = user_id);

-- Lier les exercices à un entraînement
ALTER TABLE exercice
  ADD COLUMN IF NOT EXISTS entrainement_id uuid
  REFERENCES entrainement(id) ON DELETE SET NULL;

-- Lier les grilles à un entraînement
ALTER TABLE grille_observation
  ADD COLUMN IF NOT EXISTS entrainement_id text;
