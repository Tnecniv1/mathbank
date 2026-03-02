-- ================================================================
-- Migration : Grille objectifs depuis la première semaine
--
-- Refonte de get_objectifs_grid_data :
--   Avant : retourne les N dernières semaines depuis aujourd'hui (fixe).
--   Après : retourne toutes les semaines depuis le premier objectif
--           fixé pour ce membre jusqu'à la semaine courante.
--
-- La signature change : suppression de p_nb_semaines.
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Drop de l'ancienne signature
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS get_objectifs_grid_data(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS get_objectifs_grid_data(UUID, UUID);


-- ================================================================
-- 2. RPC : get_objectifs_grid_data (nouvelle version)
--
--    Génère une ligne par semaine de 7 jours depuis la date_debut
--    du premier objectif jamais fixé pour ce membre jusqu'à la
--    semaine contenant CURRENT_DATE.
--
--    Retourne :
--      semaine_debut DATE
--      semaine_fin   DATE
--      statut        TEXT  ('succes' | 'echec' | 'en_cours' | 'non_fixe')
-- ================================================================
CREATE OR REPLACE FUNCTION get_objectifs_grid_data(
  p_equipe_id      UUID,
  p_membre_user_id UUID
)
RETURNS TABLE (
  semaine_debut DATE,
  semaine_fin   DATE,
  statut        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_premiere_semaine DATE;
  v_nb_semaines      INTEGER;
BEGIN
  -- Accès : chef ou membre concerné
  IF NOT EXISTS (
    SELECT 1 FROM equipe WHERE id = p_equipe_id AND chef_id = auth.uid()
  ) AND auth.uid() != p_membre_user_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Trouver la première semaine où un objectif a été fixé pour ce membre
  SELECT MIN(oh.date_debut)
  INTO v_premiere_semaine
  FROM objectif_hebdomadaire oh
  WHERE oh.equipe_id      = p_equipe_id
    AND oh.membre_user_id = p_membre_user_id;

  -- Pas encore d'objectif : retourner vide
  IF v_premiere_semaine IS NULL THEN
    RETURN;
  END IF;

  -- Nombre de semaines depuis la première jusqu'à aujourd'hui (inclus)
  v_nb_semaines := FLOOR((CURRENT_DATE - v_premiere_semaine) / 7)::INTEGER + 1;

  RETURN QUERY
  WITH semaines AS (
    -- Générer les semaines en pas de 7 jours depuis v_premiere_semaine
    SELECT
      (v_premiere_semaine + n * 7)     AS debut,
      (v_premiere_semaine + n * 7 + 6) AS fin
    FROM generate_series(0, v_nb_semaines - 1) AS n
  ),
  objectifs_membre AS (
    SELECT
      oh.date_debut,
      oh.statut        AS obj_statut,
      po.objectif_atteint
    FROM objectif_hebdomadaire oh
    LEFT JOIN progression_objectif po ON po.objectif_id = oh.id
    WHERE oh.equipe_id      = p_equipe_id
      AND oh.membre_user_id = p_membre_user_id
  )
  SELECT
    s.debut                          AS semaine_debut,
    s.fin                            AS semaine_fin,
    CASE
      WHEN o.date_debut IS NULL      THEN 'non_fixe'
      WHEN o.obj_statut = 'succes'   THEN 'succes'
      WHEN o.obj_statut = 'echec'    THEN 'echec'
      WHEN o.objectif_atteint = TRUE THEN 'succes'
      WHEN s.fin >= CURRENT_DATE     THEN 'en_cours'  -- semaine pas encore terminée
      ELSE                                'echec'
    END                              AS statut
  FROM semaines s
  LEFT JOIN objectifs_membre o ON s.debut = o.date_debut
  ORDER BY s.debut ASC;
END;
$$;


-- ----------------------------------------------------------------
-- 3. Grants
-- ----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION get_objectifs_grid_data TO authenticated;
