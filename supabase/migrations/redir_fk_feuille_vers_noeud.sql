-- ================================================================
-- Migration : Redirection des FKs feuille_entrainement → noeud
--
-- Aucune donnée modifiée : les UUIDs sont identiques dans noeud.
-- Seul le pointeur de contrainte change sur 3 tables.
-- session_entrainement (archive) est intentionnellement exclue.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Table session
--    Avant : feuille_mecanique_id REFERENCES feuille_entrainement(id)
--            feuille_chaotique_id REFERENCES feuille_entrainement(id)
-- ----------------------------------------------------------------
ALTER TABLE session
  DROP CONSTRAINT session_feuille_mecanique_id_fkey,
  DROP CONSTRAINT session_feuille_chaotique_id_fkey;

ALTER TABLE session
  ADD CONSTRAINT session_feuille_mecanique_id_fkey
    FOREIGN KEY (feuille_mecanique_id) REFERENCES noeud(id),
  ADD CONSTRAINT session_feuille_chaotique_id_fkey
    FOREIGN KEY (feuille_chaotique_id) REFERENCES noeud(id);


-- ----------------------------------------------------------------
-- 2. Table feuilles_autorisees
--    Avant : feuille_id REFERENCES feuille_entrainement(id)
-- ----------------------------------------------------------------
ALTER TABLE feuilles_autorisees
  DROP CONSTRAINT feuilles_autorisees_feuille_id_fkey;

ALTER TABLE feuilles_autorisees
  ADD CONSTRAINT feuilles_autorisees_feuille_id_fkey
    FOREIGN KEY (feuille_id) REFERENCES noeud(id);


-- ----------------------------------------------------------------
-- 3. Table progression_feuille
--    Avant : feuille_id REFERENCES feuille_entrainement(id)
-- ----------------------------------------------------------------
ALTER TABLE progression_feuille
  DROP CONSTRAINT progression_feuille_feuille_id_fkey;

ALTER TABLE progression_feuille
  ADD CONSTRAINT progression_feuille_feuille_id_fkey
    FOREIGN KEY (feuille_id) REFERENCES noeud(id);
