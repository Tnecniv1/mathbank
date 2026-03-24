-- ================================================================
-- RLS : Politiques d'écriture sur la table noeud
--
-- Contexte des anciennes tables :
--   niveau, sujet, chapitre, feuille_entrainement n'avaient
--   aucune politique RLS dans les migrations → RLS désactivé,
--   tous les utilisateurs authentifiés pouvaient lire et écrire.
--
-- Choix pour noeud :
--   SELECT  → tous les utilisateurs authentifiés (déjà en place)
--   INSERT / UPDATE / DELETE → admins uniquement
--     (plus restrictif que les anciennes tables, cohérent avec
--      le fait que seule la page admin écrit dans cette table)
--
-- Identification des admins : profiles.role = 'admin'
--   (même colonne utilisée par le frontend pour le contrôle
--    d'accès à /admin)
-- ================================================================

CREATE POLICY "noeud_insert_admin" ON noeud
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "noeud_update_admin" ON noeud
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "noeud_delete_admin" ON noeud
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
