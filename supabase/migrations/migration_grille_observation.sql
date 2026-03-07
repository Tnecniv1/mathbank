CREATE TABLE grille_observation (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  data jsonb NOT NULL,
  closed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE grille_observation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own" ON grille_observation
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grille_observation_updated_at
  BEFORE UPDATE ON grille_observation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
