-- ================================================================
-- Migration : Accès chef aux scores des membres pour le score global
--
-- Les nouvelles tables (session, exercice, score_exercice) n'ont
-- que des politiques "own" (user_id = auth.uid()). Cette migration
-- ajoute des politiques SELECT pour les chefs d'équipe, leur
-- permettant de lire les données de leurs membres.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. session : le chef peut lire les sessions de ses membres
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "session_select_chef_equipe" ON session;

CREATE POLICY "session_select_chef_equipe" ON session
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM membre_equipe me
      JOIN equipe eq ON eq.id = me.equipe_id
      WHERE me.user_id = session.user_id
        AND eq.chef_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------
-- 2. exercice : le chef peut lire les exercices de ses membres
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "exercice_select_chef_equipe" ON exercice;

CREATE POLICY "exercice_select_chef_equipe" ON exercice
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM session s
      JOIN membre_equipe me ON me.user_id = s.user_id
      JOIN equipe eq ON eq.id = me.equipe_id
      WHERE s.id = exercice.session_id
        AND eq.chef_id = auth.uid()
    )
  );


-- ----------------------------------------------------------------
-- 3. score_exercice : le chef peut lire les scores de ses membres
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "score_exercice_select_chef_equipe" ON score_exercice;

CREATE POLICY "score_exercice_select_chef_equipe" ON score_exercice
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM exercice e
      JOIN session s ON s.id = e.session_id
      JOIN membre_equipe me ON me.user_id = s.user_id
      JOIN equipe eq ON eq.id = me.equipe_id
      WHERE e.id = score_exercice.exercice_id
        AND eq.chef_id = auth.uid()
    )
  );
