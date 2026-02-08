-- ============================================
-- Migration : Système d'objectifs hebdomadaires
-- Objectifs par MEMBRE (pas par équipe)
-- ============================================

-- Table objectif_hebdomadaire
CREATE TABLE objectif_hebdomadaire (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipe_id UUID NOT NULL REFERENCES equipe(id) ON DELETE CASCADE,
  membre_user_id UUID NOT NULL REFERENCES auth.users(id),
  cree_par UUID NOT NULL REFERENCES auth.users(id),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  nb_sessions_min INTEGER NOT NULL DEFAULT 1,
  nb_exercices_mecanique INTEGER NOT NULL DEFAULT 0,
  consignes_mecanique TEXT,
  nb_exercices_chaotique INTEGER NOT NULL DEFAULT 0,
  consignes_chaotique TEXT,
  description TEXT,
  statut VARCHAR NOT NULL DEFAULT 'en_cours', -- en_cours, succes, echec
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_date_fin CHECK (date_fin = date_debut + INTERVAL '6 days'),
  UNIQUE(equipe_id, membre_user_id, date_debut)
);

-- Table progression_objectif
CREATE TABLE progression_objectif (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  objectif_id UUID NOT NULL REFERENCES objectif_hebdomadaire(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  nb_sessions_realisees INTEGER DEFAULT 0,
  nb_exercices_mecanique_realises INTEGER DEFAULT 0,
  nb_exercices_chaotique_realises INTEGER DEFAULT 0,
  objectif_atteint BOOLEAN DEFAULT FALSE,
  derniere_mise_a_jour TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(objectif_id, user_id)
);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE objectif_hebdomadaire ENABLE ROW LEVEL SECURITY;
ALTER TABLE progression_objectif ENABLE ROW LEVEL SECURITY;

-- Objectif hebdomadaire : chef ou membre concerné peut voir
CREATE POLICY "chef_select_objectif" ON objectif_hebdomadaire
  FOR SELECT USING (
    membre_user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM equipe e WHERE e.id = equipe_id AND e.chef_id = auth.uid()
    )
  );

CREATE POLICY "chef_insert_objectif" ON objectif_hebdomadaire
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM equipe e WHERE e.id = equipe_id AND e.chef_id = auth.uid()
    )
  );

CREATE POLICY "chef_update_objectif" ON objectif_hebdomadaire
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM equipe e WHERE e.id = equipe_id AND e.chef_id = auth.uid()
    )
  );

-- Progression objectif : chef peut tout voir, membre voit sa propre progression
CREATE POLICY "select_progression" ON progression_objectif
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM objectif_hebdomadaire oh
      JOIN equipe e ON e.id = oh.equipe_id
      WHERE oh.id = objectif_id AND e.chef_id = auth.uid()
    )
  );

CREATE POLICY "update_progression" ON progression_objectif
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM objectif_hebdomadaire oh
      JOIN equipe e ON e.id = oh.equipe_id
      WHERE oh.id = objectif_id AND e.chef_id = auth.uid()
    )
  );

-- ============================================
-- Fonction RPC : creer_objectif_hebdomadaire
-- Crée un objectif pour UN membre spécifique
-- ============================================

CREATE OR REPLACE FUNCTION creer_objectif_hebdomadaire(
  p_equipe_id UUID,
  p_membre_user_id UUID,
  p_date_debut DATE,
  p_nb_sessions_min INTEGER DEFAULT 1,
  p_nb_exercices_mecanique INTEGER DEFAULT 0,
  p_consignes_mecanique TEXT DEFAULT NULL,
  p_nb_exercices_chaotique INTEGER DEFAULT 0,
  p_consignes_chaotique TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_objectif_id UUID;
  v_date_fin DATE;
BEGIN
  -- Vérifier que l'utilisateur est le chef de l'équipe
  IF NOT EXISTS (
    SELECT 1 FROM equipe WHERE id = p_equipe_id AND chef_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Vous n''êtes pas le chef de cette équipe';
  END IF;

  -- Vérifier que le membre appartient à l'équipe
  IF NOT EXISTS (
    SELECT 1 FROM membre_equipe WHERE equipe_id = p_equipe_id AND user_id = p_membre_user_id
  ) THEN
    RAISE EXCEPTION 'Ce membre n''appartient pas à cette équipe';
  END IF;

  -- Calculer la date de fin (+6 jours)
  v_date_fin := p_date_debut + INTERVAL '6 days';

  -- Créer l'objectif pour ce membre
  INSERT INTO objectif_hebdomadaire (
    equipe_id, membre_user_id, cree_par, date_debut, date_fin,
    nb_sessions_min, nb_exercices_mecanique, consignes_mecanique,
    nb_exercices_chaotique, consignes_chaotique, description
  ) VALUES (
    p_equipe_id, p_membre_user_id, auth.uid(), p_date_debut, v_date_fin,
    p_nb_sessions_min, p_nb_exercices_mecanique, p_consignes_mecanique,
    p_nb_exercices_chaotique, p_consignes_chaotique, p_description
  )
  RETURNING id INTO v_objectif_id;

  -- Créer UNE SEULE ligne de progression pour ce membre
  INSERT INTO progression_objectif (objectif_id, user_id)
  VALUES (v_objectif_id, p_membre_user_id);

  RETURN v_objectif_id;
END;
$$;

-- ============================================
-- Fonction RPC : calculer_progression_objectif
-- ============================================

CREATE OR REPLACE FUNCTION calculer_progression_objectif(p_objectif_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj RECORD;
  v_prog RECORD;
  v_nb_sessions INTEGER;
  v_nb_meca INTEGER;
  v_nb_chaos INTEGER;
  v_atteint BOOLEAN;
BEGIN
  -- Récupérer l'objectif
  SELECT * INTO v_obj FROM objectif_hebdomadaire WHERE id = p_objectif_id;

  IF v_obj IS NULL THEN
    RAISE EXCEPTION 'Objectif introuvable';
  END IF;

  -- Mettre à jour la progression du membre
  FOR v_prog IN
    SELECT * FROM progression_objectif WHERE objectif_id = p_objectif_id
  LOOP
    -- Compter les sessions dans la période
    SELECT COUNT(DISTINCT se.id) INTO v_nb_sessions
    FROM session_entrainement se
    WHERE se.user_id = v_prog.user_id
      AND se.date_session >= v_obj.date_debut
      AND se.date_session <= v_obj.date_fin;

    -- Compter les exercices mécaniques
    SELECT COUNT(*) INTO v_nb_meca
    FROM score_local sl
    JOIN session_entrainement se ON se.id = sl.session_id
    JOIN feuille_entrainement fe ON fe.id = se.feuille_mecanique_id
    WHERE se.user_id = v_prog.user_id
      AND se.date_session >= v_obj.date_debut
      AND se.date_session <= v_obj.date_fin
      AND fe.type = 'mecanique';

    -- Compter les exercices chaotiques
    SELECT COUNT(*) INTO v_nb_chaos
    FROM score_local sl
    JOIN session_entrainement se ON se.id = sl.session_id
    JOIN feuille_entrainement fe ON fe.id = se.feuille_chaotique_id
    WHERE se.user_id = v_prog.user_id
      AND se.date_session >= v_obj.date_debut
      AND se.date_session <= v_obj.date_fin
      AND fe.type = 'chaotique';

    -- Vérifier si l'objectif est atteint
    v_atteint := (
      v_nb_sessions >= v_obj.nb_sessions_min
      AND v_nb_meca >= v_obj.nb_exercices_mecanique
      AND v_nb_chaos >= v_obj.nb_exercices_chaotique
    );

    -- Mettre à jour la progression
    UPDATE progression_objectif
    SET
      nb_sessions_realisees = v_nb_sessions,
      nb_exercices_mecanique_realises = v_nb_meca,
      nb_exercices_chaotique_realises = v_nb_chaos,
      objectif_atteint = v_atteint,
      derniere_mise_a_jour = NOW()
    WHERE id = v_prog.id;
  END LOOP;
END;
$$;

-- ============================================
-- Fonction RPC : get_objectifs_membre
-- Retourne les objectifs d'un membre spécifique
-- ============================================

CREATE OR REPLACE FUNCTION get_objectifs_membre(p_equipe_id UUID, p_membre_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Vérifier que l'utilisateur est chef ou le membre concerné
  IF NOT EXISTS (
    SELECT 1 FROM equipe WHERE id = p_equipe_id AND chef_id = auth.uid()
  ) AND auth.uid() != p_membre_user_id THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT json_agg(obj_data ORDER BY obj_data.date_debut DESC)
  INTO v_result
  FROM (
    SELECT
      oh.id,
      oh.equipe_id,
      oh.membre_user_id,
      oh.date_debut,
      oh.date_fin,
      oh.nb_sessions_min,
      oh.nb_exercices_mecanique,
      oh.consignes_mecanique,
      oh.nb_exercices_chaotique,
      oh.consignes_chaotique,
      oh.description,
      oh.statut,
      oh.created_at,
      (
        SELECT json_agg(
          json_build_object(
            'id', po.id,
            'user_id', po.user_id,
            'nom', COALESCE(p.full_name, 'Inconnu'),
            'nb_sessions_realisees', po.nb_sessions_realisees,
            'nb_exercices_mecanique_realises', po.nb_exercices_mecanique_realises,
            'nb_exercices_chaotique_realises', po.nb_exercices_chaotique_realises,
            'objectif_atteint', po.objectif_atteint,
            'derniere_mise_a_jour', po.derniere_mise_a_jour
          )
        )
        FROM progression_objectif po
        LEFT JOIN profiles p ON p.user_id = po.user_id
        WHERE po.objectif_id = oh.id
      ) AS progressions
    FROM objectif_hebdomadaire oh
    WHERE oh.equipe_id = p_equipe_id
      AND oh.membre_user_id = p_membre_user_id
  ) obj_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ============================================
-- Fonction RPC : cloturer_objectif
-- ============================================

CREATE OR REPLACE FUNCTION cloturer_objectif(
  p_objectif_id UUID,
  p_statut VARCHAR
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj RECORD;
BEGIN
  -- Vérifier le statut demandé
  IF p_statut NOT IN ('succes', 'echec') THEN
    RAISE EXCEPTION 'Statut invalide. Utilisez "succes" ou "echec"';
  END IF;

  -- Récupérer l'objectif et vérifier que l'utilisateur est le chef
  SELECT oh.* INTO v_obj
  FROM objectif_hebdomadaire oh
  JOIN equipe e ON e.id = oh.equipe_id
  WHERE oh.id = p_objectif_id AND e.chef_id = auth.uid();

  IF v_obj IS NULL THEN
    RAISE EXCEPTION 'Objectif introuvable ou accès refusé';
  END IF;

  IF v_obj.statut != 'en_cours' THEN
    RAISE EXCEPTION 'Cet objectif est déjà clôturé';
  END IF;

  -- Mettre à jour le statut
  UPDATE objectif_hebdomadaire
  SET statut = p_statut
  WHERE id = p_objectif_id;
END;
$$;

-- ============================================
-- Fonction RPC : verifier_objectifs_expires
-- Crée une notification pour le chef quand un objectif expire sans être clôturé
-- ============================================

CREATE OR REPLACE FUNCTION verifier_objectifs_expires(p_equipe_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj RECORD;
  v_chef_id UUID;
  v_membre_nom TEXT;
BEGIN
  -- Récupérer le chef de l'équipe
  SELECT chef_id INTO v_chef_id FROM equipe WHERE id = p_equipe_id;

  IF v_chef_id IS NULL THEN
    RETURN;
  END IF;

  -- Trouver les objectifs expirés encore en_cours (1 objectif = 1 membre)
  FOR v_obj IN
    SELECT oh.id, oh.date_debut, oh.date_fin, oh.equipe_id, oh.membre_user_id
    FROM objectif_hebdomadaire oh
    WHERE oh.equipe_id = p_equipe_id
      AND oh.statut = 'en_cours'
      AND oh.date_fin < CURRENT_DATE
      -- Pas de notification déjà envoyée pour cet objectif
      AND NOT EXISTS (
        SELECT 1 FROM notification n
        WHERE n.user_id = v_chef_id
          AND n.type = 'objectif_expire'
          AND (n.metadata->>'objectif_id')::UUID = oh.id
      )
  LOOP
    -- Récupérer le nom du membre
    SELECT full_name INTO v_membre_nom
    FROM profiles WHERE user_id = v_obj.membre_user_id;

    -- Créer la notification
    INSERT INTO notification (user_id, type, titre, message, lu, metadata)
    VALUES (
      v_chef_id,
      'objectif_expire',
      'Objectif a cloturer',
      'L''objectif du ' ||
        to_char(v_obj.date_debut, 'DD/MM') || ' au ' ||
        to_char(v_obj.date_fin, 'DD/MM') ||
        ' de ' || COALESCE(v_membre_nom, 'un membre') ||
        ' est termine. Veuillez le cloturer.',
      false,
      json_build_object(
        'objectif_id', v_obj.id,
        'equipe_id', v_obj.equipe_id,
        'membre_user_id', v_obj.membre_user_id
      )
    );
  END LOOP;
END;
$$;

-- ============================================
-- Fonction RPC : get_objectifs_grid_data
-- Retourne l'historique des objectifs d'un membre pour affichage en grille
-- ============================================

CREATE OR REPLACE FUNCTION get_objectifs_grid_data(
  p_equipe_id UUID,
  p_membre_user_id UUID,
  p_nb_semaines INTEGER DEFAULT 16
)
RETURNS TABLE (
  semaine_debut DATE,
  semaine_fin DATE,
  statut TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH semaines AS (
    SELECT
      (date_trunc('week', CURRENT_DATE - (n || ' weeks')::INTERVAL))::DATE AS debut,
      (date_trunc('week', CURRENT_DATE - (n || ' weeks')::INTERVAL) + INTERVAL '6 days')::DATE AS fin
    FROM generate_series(0, p_nb_semaines - 1) AS n
  ),
  objectifs_membre AS (
    SELECT
      oh.date_debut,
      oh.date_fin,
      oh.statut AS obj_statut,
      po.objectif_atteint
    FROM objectif_hebdomadaire oh
    LEFT JOIN progression_objectif po ON po.objectif_id = oh.id
    WHERE oh.equipe_id = p_equipe_id
      AND oh.membre_user_id = p_membre_user_id
  )
  SELECT
    s.debut AS semaine_debut,
    s.fin AS semaine_fin,
    CASE
      WHEN o.date_debut IS NULL THEN 'non_fixe'
      WHEN o.obj_statut = 'succes' THEN 'succes'
      WHEN o.obj_statut = 'echec' THEN 'echec'
      WHEN o.objectif_atteint = TRUE THEN 'succes'
      ELSE 'echec'
    END AS statut
  FROM semaines s
  LEFT JOIN objectifs_membre o ON s.debut = o.date_debut
  ORDER BY s.debut ASC;
END;
$$;
