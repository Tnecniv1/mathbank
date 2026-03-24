-- ================================================================
-- Migration : Création de la table récursive `noeud`
--             + migration des données depuis les 4 tables actuelles
--
-- Les anciennes tables (niveau, sujet, chapitre, feuille_entrainement)
-- sont conservées INTACTES — aucune suppression ni modification.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Table noeud
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS noeud (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES noeud(id) ON DELETE CASCADE,
  titre     text        NOT NULL,
  ordre     integer     NOT NULL DEFAULT 0,
  -- 'niveau' | 'sujet' | 'chapitre' | 'mecanique' | 'chaotique'
  type      text        NOT NULL CHECK (type IN ('niveau','sujet','chapitre','mecanique','chaotique')),
  pdf_url   text,
  -- Ajouté car utilisé par l'UI (FeuilleCard) ; null pour les nœuds non-feuilles
  difficulte integer
);

CREATE INDEX IF NOT EXISTS idx_noeud_parent_id ON noeud(parent_id);
CREATE INDEX IF NOT EXISTS idx_noeud_type      ON noeud(type);


-- ----------------------------------------------------------------
-- 2. RLS — lecture libre aux utilisateurs connectés
--    (la restriction fine est gérée par feuilles_autorisees)
-- ----------------------------------------------------------------
ALTER TABLE noeud ENABLE ROW LEVEL SECURITY;

CREATE POLICY "noeud_select_authenticated" ON noeud
  FOR SELECT USING (auth.role() = 'authenticated');


-- ----------------------------------------------------------------
-- 3. Migration des données
--    Les UUIDs sont conservés à l'identique pour que les tables
--    feuilles_autorisees, session, progression_feuille, etc.
--    continuent de fonctionner sans modification.
-- ----------------------------------------------------------------

-- 3a. Niveaux (racines — pas de parent)
INSERT INTO noeud (id, parent_id, titre, ordre, type, pdf_url, difficulte)
SELECT id, NULL, titre, ordre, 'niveau', NULL, NULL
FROM niveau
ON CONFLICT (id) DO NOTHING;

-- 3b. Sujets
INSERT INTO noeud (id, parent_id, titre, ordre, type, pdf_url, difficulte)
SELECT id, niveau_id, titre, ordre, 'sujet', NULL, NULL
FROM sujet
ON CONFLICT (id) DO NOTHING;

-- 3c. Chapitres
INSERT INTO noeud (id, parent_id, titre, ordre, type, pdf_url, difficulte)
SELECT id, sujet_id, titre, ordre, 'chapitre', NULL, NULL
FROM chapitre
ON CONFLICT (id) DO NOTHING;

-- 3d. Feuilles d'entraînement
--     Le champ `type` (mecanique|chaotique) est déjà compatible.
INSERT INTO noeud (id, parent_id, titre, ordre, type, pdf_url, difficulte)
SELECT id, chapitre_id, titre, ordre, type, pdf_url, difficulte
FROM feuille_entrainement
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------
-- Vérification rapide (optionnel — à lancer manuellement)
-- ----------------------------------------------------------------
-- SELECT type, COUNT(*) FROM noeud GROUP BY type ORDER BY type;
-- SELECT COUNT(*) FROM noeud WHERE parent_id IS NULL;  -- doit = COUNT(*) FROM niveau
