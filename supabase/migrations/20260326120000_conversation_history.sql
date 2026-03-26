CREATE TABLE conversation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  feuille_id uuid NOT NULL REFERENCES noeud(id),
  exercice_numero integer NOT NULL,
  messages jsonb NOT NULL, -- tableau [{role, content, timestamp}]
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user sees own history" ON conversation_history
  FOR ALL USING (auth.uid() = user_id);
