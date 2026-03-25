-- ================================================================
-- Migration : get_tableau_progression — lecture depuis noeud
--
-- Gère deux topologies :
--   1. sujet → feuille directe (mecanique|chaotique)
--   2. sujet → chapitre → feuille (mecanique|chaotique)
-- ================================================================

CREATE OR REPLACE FUNCTION get_tableau_progression(
  p_niveau_id uuid,
  p_user_id   uuid
)
RETURNS TABLE (
  sujet_id        uuid,
  sujet_titre     text,
  sujet_ordre     integer,
  chapitre_id     uuid,
  chapitre_titre  text,
  chapitre_ordre  integer,
  feuille_id      uuid,
  feuille_titre   text,
  feuille_ordre   integer,
  feuille_statut  text,
  feuille_en_cours boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$

  -- Cas 1 : feuilles directement sous un sujet (sans chapitre intermédiaire)
  -- Le sujet joue le rôle de chapitre (même id/titre/ordre)
  SELECT
    s.id                              AS sujet_id,
    s.titre                           AS sujet_titre,
    s.ordre                           AS sujet_ordre,
    s.id                              AS chapitre_id,
    s.titre                           AS chapitre_titre,
    s.ordre                           AS chapitre_ordre,
    f.id                              AS feuille_id,
    f.titre                           AS feuille_titre,
    f.ordre                           AS feuille_ordre,
    pf.statut                         AS feuille_statut,
    COALESCE(pf.en_cours, false)      AS feuille_en_cours
  FROM noeud s
  JOIN noeud f
    ON f.parent_id = s.id
   AND f.type IN ('mecanique', 'chaotique')
  LEFT JOIN progression_feuille pf
    ON pf.feuille_id = f.id
   AND pf.user_id = p_user_id
  WHERE s.parent_id = p_niveau_id
    AND s.type = 'sujet'

  UNION ALL

  -- Cas 2 : feuilles via chapitres (sujet → chapitre → feuille)
  SELECT
    s.id                              AS sujet_id,
    s.titre                           AS sujet_titre,
    s.ordre                           AS sujet_ordre,
    c.id                              AS chapitre_id,
    c.titre                           AS chapitre_titre,
    c.ordre                           AS chapitre_ordre,
    f.id                              AS feuille_id,
    f.titre                           AS feuille_titre,
    f.ordre                           AS feuille_ordre,
    pf.statut                         AS feuille_statut,
    COALESCE(pf.en_cours, false)      AS feuille_en_cours
  FROM noeud s
  JOIN noeud c
    ON c.parent_id = s.id
   AND c.type = 'chapitre'
  LEFT JOIN noeud f
    ON f.parent_id = c.id
   AND f.type IN ('mecanique', 'chaotique')
  LEFT JOIN progression_feuille pf
    ON pf.feuille_id = f.id
   AND pf.user_id = p_user_id
  WHERE s.parent_id = p_niveau_id
    AND s.type = 'sujet'

  ORDER BY sujet_ordre, chapitre_ordre, feuille_ordre NULLS LAST;
$$;
