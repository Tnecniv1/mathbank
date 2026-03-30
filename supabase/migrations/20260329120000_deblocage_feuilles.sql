-- Feuilles débloquées par l'élève (mais pas encore commencées)
CREATE TABLE IF NOT EXISTS feuille_debloquee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  feuille_id uuid NOT NULL REFERENCES noeud(id) ON DELETE CASCADE,
  debloquee_at timestamptz DEFAULT now(),
  UNIQUE(user_id, feuille_id)
);

ALTER TABLE feuille_debloquee ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user sees own" ON feuille_debloquee
  FOR ALL USING (auth.uid() = user_id);
