-- ================================================================
-- Migration : RPCs pour insertion de sessions par un chef d'équipe
--
-- Les tables session, exercice et score_exercice n'autorisent
-- que user_id = auth.uid() en INSERT (RLS). Ces RPCs en
-- SECURITY DEFINER permettent au chef d'insérer au nom d'un membre
-- après vérification qu'il est bien chef de l'équipe du membre.
-- ================================================================


-- ----------------------------------------------------------------
-- Helpers de vérification (réutilisés dans chaque RPC)
-- ----------------------------------------------------------------

-- Vérifie que auth.uid() est chef d'une équipe dont p_user_id est membre
CREATE OR REPLACE FUNCTION _is_chef_of_member(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM membre_equipe me
    JOIN equipe eq ON eq.id = me.equipe_id
    WHERE me.user_id = p_user_id
      AND eq.chef_id = auth.uid()
  );
$$;


-- ----------------------------------------------------------------
-- 1. insert_session_chef
--    Crée une session pour un membre, retourne l'UUID de la session
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS insert_session_chef(UUID, DATE, INTEGER, UUID, UUID);

CREATE OR REPLACE FUNCTION insert_session_chef(
  p_membre_user_id      UUID,
  p_date                DATE,
  p_duree               INTEGER,
  p_feuille_mecanique_id UUID,
  p_feuille_chaotique_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  IF NOT _is_chef_of_member(p_membre_user_id) THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas chef de ce membre';
  END IF;

  INSERT INTO session (
    user_id,
    date_session,
    duree,
    feuille_mecanique_id,
    feuille_chaotique_id
  )
  VALUES (
    p_membre_user_id,
    p_date,
    p_duree,
    p_feuille_mecanique_id,
    p_feuille_chaotique_id
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;


-- ----------------------------------------------------------------
-- 2. insert_exercice_chef
--    Crée un exercice pour une session appartenant à un membre,
--    retourne l'UUID de l'exercice
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS insert_exercice_chef(UUID, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION insert_exercice_chef(
  p_session_id UUID,
  p_type       TEXT,
  p_reference  TEXT,
  p_ordre      INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_membre_user_id UUID;
  v_exercice_id    UUID;
BEGIN
  -- Récupère le propriétaire de la session
  SELECT user_id INTO v_membre_user_id
  FROM session
  WHERE id = p_session_id;

  IF v_membre_user_id IS NULL THEN
    RAISE EXCEPTION 'Session introuvable : %', p_session_id;
  END IF;

  IF NOT _is_chef_of_member(v_membre_user_id) THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas chef de ce membre';
  END IF;

  INSERT INTO exercice (
    session_id,
    type,
    reference,
    ordre
  )
  VALUES (
    p_session_id,
    p_type,
    p_reference,
    p_ordre
  )
  RETURNING id INTO v_exercice_id;

  RETURN v_exercice_id;
END;
$$;


-- ----------------------------------------------------------------
-- 3. insert_score_exercice_chef
--    Crée un score_exercice pour un exercice appartenant à un membre,
--    retourne l'UUID du score_exercice
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS insert_score_exercice_chef(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION insert_score_exercice_chef(
  p_exercice_id UUID,
  p_reussi      BOOLEAN,
  p_c1          BOOLEAN,
  p_c2          BOOLEAN,
  p_c3          BOOLEAN,
  p_c4          BOOLEAN,
  p_s1          BOOLEAN,
  p_s2          BOOLEAN,
  p_s3          BOOLEAN,
  p_s4          BOOLEAN,
  p_r1          BOOLEAN,
  p_r2          BOOLEAN,
  p_r3          BOOLEAN,
  p_r4          BOOLEAN,
  p_correction  BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_membre_user_id  UUID;
  v_score_id        UUID;
BEGIN
  -- Récupère le propriétaire via session
  SELECT s.user_id INTO v_membre_user_id
  FROM exercice e
  JOIN session s ON s.id = e.session_id
  WHERE e.id = p_exercice_id;

  IF v_membre_user_id IS NULL THEN
    RAISE EXCEPTION 'Exercice introuvable : %', p_exercice_id;
  END IF;

  IF NOT _is_chef_of_member(v_membre_user_id) THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas chef de ce membre';
  END IF;

  INSERT INTO score_exercice (
    exercice_id,
    reussi,
    c1, c2, c3, c4,
    s1, s2, s3, s4,
    r1, r2, r3, r4,
    correction
  )
  VALUES (
    p_exercice_id,
    p_reussi,
    p_c1, p_c2, p_c3, p_c4,
    p_s1, p_s2, p_s3, p_s4,
    p_r1, p_r2, p_r3, p_r4,
    p_correction
  )
  RETURNING id INTO v_score_id;

  RETURN v_score_id;
END;
$$;


-- ----------------------------------------------------------------
-- 4. delete_session_chef
--    Supprime une session (et ses exercices + scores en cascade)
--    appartenant à un membre de l'équipe du chef
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS delete_session_chef(UUID);

CREATE OR REPLACE FUNCTION delete_session_chef(
  p_session_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_membre_user_id UUID;
BEGIN
  SELECT user_id INTO v_membre_user_id
  FROM session
  WHERE id = p_session_id;

  IF v_membre_user_id IS NULL THEN
    RAISE EXCEPTION 'Session introuvable : %', p_session_id;
  END IF;

  IF NOT _is_chef_of_member(v_membre_user_id) THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas chef de ce membre';
  END IF;

  DELETE FROM session WHERE id = p_session_id;
END;
$$;


-- ----------------------------------------------------------------
-- 5. Grants
-- ----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION _is_chef_of_member(UUID)                                                                                                   TO authenticated;
GRANT EXECUTE ON FUNCTION insert_session_chef(UUID, DATE, INTEGER, UUID, UUID)                                                                        TO authenticated;
GRANT EXECUTE ON FUNCTION insert_exercice_chef(UUID, TEXT, TEXT, INTEGER)                                                                             TO authenticated;
GRANT EXECUTE ON FUNCTION insert_score_exercice_chef(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_session_chef(UUID)                                                                                                   TO authenticated;
