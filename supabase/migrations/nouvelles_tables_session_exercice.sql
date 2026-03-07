-- ================================================================
-- Migration : Nouvelles tables session, exercice, score_exercice
--
-- Ces tables remplacent session_entrainement et score_local
-- pour les nouvelles sessions. Les anciennes tables sont conservées
-- en lecture seule (archives).
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Table session (remplace session_entrainement pour les nouvelles données)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users NOT NULL,
  date_session         date NOT NULL DEFAULT CURRENT_DATE,
  duree                integer NOT NULL,
  feuille_mecanique_id uuid REFERENCES feuille_entrainement(id),
  feuille_chaotique_id uuid REFERENCES feuille_entrainement(id),
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_user_id      ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_date_session ON session(date_session);


-- ----------------------------------------------------------------
-- 2. Table exercice (exercices au sein d'une session)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercice (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES session(id) ON DELETE CASCADE NOT NULL,
  type       text NOT NULL CHECK (type IN ('mecanique', 'chaotique')),
  reference  text NOT NULL,
  ordre      integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercice_session_id ON exercice(session_id);


-- ----------------------------------------------------------------
-- 3. Table score_exercice (score par exercice)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS score_exercice (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id uuid REFERENCES exercice(id) ON DELETE CASCADE NOT NULL,
  -- Mécanique
  reussi      boolean,
  -- Chaotique : grille complète
  c1          boolean DEFAULT false,
  c2          boolean DEFAULT false,
  c3          boolean DEFAULT false,
  c4          boolean DEFAULT false,
  s1          boolean DEFAULT false,
  s2          boolean DEFAULT false,
  s3          boolean DEFAULT false,
  s4          boolean DEFAULT false,
  r1          boolean DEFAULT false,
  r2          boolean DEFAULT false,
  r3          boolean DEFAULT false,
  r4          boolean DEFAULT false,
  correction  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_exercice_exercice_id ON score_exercice(exercice_id);


-- ----------------------------------------------------------------
-- 4. RLS — session
-- ----------------------------------------------------------------
ALTER TABLE session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_select_own" ON session
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "session_insert_own" ON session
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "session_update_own" ON session
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "session_delete_own" ON session
  FOR DELETE USING (user_id = auth.uid());


-- ----------------------------------------------------------------
-- 5. RLS — exercice (via JOIN session)
-- ----------------------------------------------------------------
ALTER TABLE exercice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercice_select_own" ON exercice
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "exercice_insert_own" ON exercice
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM session s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "exercice_update_own" ON exercice
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM session s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "exercice_delete_own" ON exercice
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM session s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------
-- 6. RLS — score_exercice (via JOIN exercice → session)
-- ----------------------------------------------------------------
ALTER TABLE score_exercice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "score_exercice_select_own" ON score_exercice
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exercice e
      JOIN session s ON s.id = e.session_id
      WHERE e.id = exercice_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "score_exercice_insert_own" ON score_exercice
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM exercice e
      JOIN session s ON s.id = e.session_id
      WHERE e.id = exercice_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "score_exercice_update_own" ON score_exercice
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM exercice e
      JOIN session s ON s.id = e.session_id
      WHERE e.id = exercice_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "score_exercice_delete_own" ON score_exercice
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM exercice e
      JOIN session s ON s.id = e.session_id
      WHERE e.id = exercice_id AND s.user_id = auth.uid()
    )
  );
