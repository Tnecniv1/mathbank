-- ================================================================
-- RPCs : Suppression récursive depuis la table noeud
--
-- Remplacent delete_feuille_chef / delete_chapitre_chef /
-- delete_sujet_chef qui opéraient sur les anciennes tables.
-- Les noms sont conservés pour ne pas changer le frontend.
--
-- La suppression en CASCADE sur noeud.parent_id gère
-- automatiquement toute la sous-arborescence.
-- Les tables dépendantes (feuilles_autorisees, progression_feuille)
-- sont nettoyées explicitement car leurs FK pointent encore vers
-- feuille_entrainement (les anciennes tables restent intactes
-- le temps de la validation).
-- ================================================================


-- ----------------------------------------------------------------
-- 1. delete_feuille_chef  — supprime une feuille (nœud feuille)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_feuille_chef(p_feuille_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Nettoyer les tables dépendantes (FK vers feuille_entrainement)
  DELETE FROM feuilles_autorisees  WHERE feuille_id = p_feuille_id;
  DELETE FROM progression_feuille  WHERE feuille_id = p_feuille_id;

  -- Supprimer le nœud (pas d'enfants pour une feuille)
  DELETE FROM noeud WHERE id = p_feuille_id;
END;
$$;


-- ----------------------------------------------------------------
-- 2. delete_chapitre_chef — supprime un chapitre et ses feuilles
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_chapitre_chef(p_chapitre_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_feuille_id uuid;
BEGIN
  -- Nettoyer les dépendances pour chaque feuille enfant
  FOR v_feuille_id IN
    SELECT id FROM noeud
    WHERE parent_id = p_chapitre_id
      AND type IN ('mecanique', 'chaotique')
  LOOP
    DELETE FROM feuilles_autorisees WHERE feuille_id = v_feuille_id;
    DELETE FROM progression_feuille WHERE feuille_id = v_feuille_id;
  END LOOP;

  -- Supprimer le chapitre — CASCADE supprime les feuilles dans noeud
  DELETE FROM noeud WHERE id = p_chapitre_id;
END;
$$;


-- ----------------------------------------------------------------
-- 3. delete_sujet_chef — supprime un sujet, ses chapitres et feuilles
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_sujet_chef(p_sujet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_feuille_id uuid;
BEGIN
  -- Nettoyer les dépendances pour chaque feuille sous ce sujet
  -- (profondeur 2 : sujet → chapitre → feuille)
  FOR v_feuille_id IN
    SELECT f.id
    FROM noeud f
    JOIN noeud c ON c.id = f.parent_id
    WHERE c.parent_id = p_sujet_id
      AND f.type IN ('mecanique', 'chaotique')
  LOOP
    DELETE FROM feuilles_autorisees WHERE feuille_id = v_feuille_id;
    DELETE FROM progression_feuille WHERE feuille_id = v_feuille_id;
  END LOOP;

  -- Supprimer le sujet — CASCADE supprime chapitres + feuilles dans noeud
  DELETE FROM noeud WHERE id = p_sujet_id;
END;
$$;
