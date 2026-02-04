-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTION: gerer_feuilles_membre
-- Bug: Ne créait pas de record dans progression_feuille lors de l'autorisation
-- Résultat: les nouvelles feuilles autorisées n'apparaissaient pas dans la sélection
-- Date: 2026-02-04
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION gerer_feuilles_membre(
    p_membre_id UUID,
    p_feuilles_a_ajouter UUID[],
    p_feuilles_a_retirer UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_feuille_id UUID;
BEGIN
    -- Vérifier que le membre existe et récupérer son user_id
    SELECT user_id INTO v_user_id
    FROM membre_equipe
    WHERE id = p_membre_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Membre non trouvé');
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- AJOUTER les feuilles autorisées
    -- ═══════════════════════════════════════════════════════════════════════
    IF array_length(p_feuilles_a_ajouter, 1) > 0 THEN
        -- Insérer dans feuilles_autorisees
        INSERT INTO feuilles_autorisees (membre_id, feuille_id)
        SELECT p_membre_id, feuille_id
        FROM unnest(p_feuilles_a_ajouter) AS feuille_id
        ON CONFLICT (membre_id, feuille_id) DO NOTHING;

        -- CORRECTION: Créer/mettre à jour les records dans progression_feuille
        -- pour que les feuilles apparaissent dans la sélection de session
        INSERT INTO progression_feuille (user_id, feuille_id, en_cours, statut, est_termine)
        SELECT v_user_id, feuille_id, true, 'en_attente', false
        FROM unnest(p_feuilles_a_ajouter) AS feuille_id
        ON CONFLICT (user_id, feuille_id) DO UPDATE
        SET en_cours = true, statut = 'en_attente'
        WHERE progression_feuille.est_termine = false;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════════
    -- RETIRER les feuilles autorisées
    -- ═══════════════════════════════════════════════════════════════════════
    IF array_length(p_feuilles_a_retirer, 1) > 0 THEN
        -- Supprimer de feuilles_autorisees
        DELETE FROM feuilles_autorisees
        WHERE membre_id = p_membre_id
          AND feuille_id = ANY(p_feuilles_a_retirer);

        -- Mettre à jour progression_feuille pour ces feuilles
        UPDATE progression_feuille
        SET en_cours = false
        WHERE user_id = v_user_id
          AND feuille_id = ANY(p_feuilles_a_retirer)
          AND statut != 'validee';  -- Ne pas toucher aux feuilles déjà validées
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION gerer_feuilles_membre(UUID, UUID[], UUID[]) TO authenticated;

COMMENT ON FUNCTION gerer_feuilles_membre IS
'Gère les feuilles autorisées pour un membre d''équipe.
- Ajoute les feuilles dans feuilles_autorisees ET progression_feuille
- Retire les feuilles non validées
Corrigé pour créer les records de progression lors de l''autorisation.';
