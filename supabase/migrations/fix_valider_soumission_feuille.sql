-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION: valider_soumission_feuille
-- Bug: Ne mettait pas en_cours = false lors de la validation
-- Résultat: les feuilles validées restaient visibles dans "En progression"
-- Date: 2026-02-04
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION valider_soumission_feuille(
    p_notification_id UUID,
    p_user_id UUID,
    p_feuille_id UUID,
    p_score NUMERIC DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mettre à jour la progression de la feuille
    -- CORRECTION: Ajout de en_cours = false pour que la feuille n'apparaisse plus dans "En progression"
    UPDATE progression_feuille
    SET
        statut = 'validee',
        en_cours = false,           -- ← CORRECTION DU BUG
        validee_at = NOW(),
        score = COALESCE(p_score, score)
    WHERE user_id = p_user_id
      AND feuille_id = p_feuille_id;

    -- Marquer la notification comme lue
    UPDATE notification
    SET lu = true
    WHERE id = p_notification_id;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION valider_soumission_feuille(UUID, UUID, UUID, NUMERIC) TO authenticated;

COMMENT ON FUNCTION valider_soumission_feuille IS
'Valide une soumission de feuille par le chef.
Met à jour le statut en "validee", en_cours = false, et enregistre le score.
Marque également la notification comme lue.';
