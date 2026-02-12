-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Session Live avec Notation en Temps Réel
-- Description: Ajoute le support des sessions live (statut, started_at)
--              et une fonction pour récupérer l'évolution du score en direct
-- Date: 2026-02-12
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Nouvelles colonnes sur session_entrainement
-- ═══════════════════════════════════════════════════════════════════════════

-- Statut de la session : 'en_cours' pendant le live, 'terminee' après
ALTER TABLE session_entrainement
ADD COLUMN IF NOT EXISTS statut TEXT DEFAULT 'terminee'
CHECK (statut IN ('en_cours', 'terminee'));

-- Timestamp de démarrage de la session live
ALTER TABLE session_entrainement
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Fonction : get_session_live_evolution
-- Retourne l'évolution du score question par question pour une session
-- Utilisée par le graphique live pour afficher la progression
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_session_live_evolution(p_session_id UUID)
RETURNS TABLE (
  question_num BIGINT,
  exercice TEXT,
  question TEXT,
  score_question NUMERIC,
  score_cumule NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY sl.created_at) as question_num,
    sl.exercice,
    sl.question,
    sl.score_calcule * 100 as score_question,
    SUM(sl.score_calcule * 100) OVER (ORDER BY sl.created_at) as score_cumule,
    sl.created_at
  FROM score_local sl
  WHERE sl.session_id = p_session_id
  ORDER BY sl.created_at;
$$;

COMMENT ON FUNCTION get_session_live_evolution(UUID) IS
'Retourne l''évolution du score pour une session live :
- question_num : numéro séquentiel de la question
- exercice / question : références de la question
- score_question : score individuel en points (score_calcule * 100)
- score_cumule : somme cumulée des scores
- created_at : timestamp d''insertion';

-- Autoriser l'exécution pour les utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION get_session_live_evolution(UUID) TO authenticated;
