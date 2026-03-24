-- ================================================================
-- RPC : get_arbre_noeud(p_racine_id uuid)
--
-- Retourne tous les nœuds de l'arbre descendant d'un nœud racine
-- (inclus), sous forme de liste plate ordonnée par profondeur puis
-- par `ordre`. Le client reconstruit la hiérarchie via parent_id.
--
-- Usage depuis le client :
--   supabase.rpc('get_arbre_noeud', { p_racine_id: '<uuid>' })
-- ================================================================

CREATE OR REPLACE FUNCTION get_arbre_noeud(p_racine_id uuid)
RETURNS TABLE (
  id         uuid,
  parent_id  uuid,
  titre      text,
  ordre      integer,
  type       text,
  pdf_url    text,
  difficulte integer,
  profondeur integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE arbre AS (

    -- Nœud racine
    SELECT
      n.id,
      n.parent_id,
      n.titre,
      n.ordre,
      n.type,
      n.pdf_url,
      n.difficulte,
      0 AS profondeur
    FROM noeud n
    WHERE n.id = p_racine_id

    UNION ALL

    -- Descendants récursifs
    SELECT
      n.id,
      n.parent_id,
      n.titre,
      n.ordre,
      n.type,
      n.pdf_url,
      n.difficulte,
      a.profondeur + 1
    FROM noeud n
    JOIN arbre a ON n.parent_id = a.id

  )
  SELECT * FROM arbre
  ORDER BY profondeur, ordre;
$$;
