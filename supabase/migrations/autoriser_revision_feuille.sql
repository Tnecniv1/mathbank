-- ═══════════════════════════════════════════════════════════════════════════
-- RPC : autoriser_revision_feuille
-- Remet une feuille validée en état "en_attente" pour une révision.
--
-- Contrainte technique : UNIQUE(user_id, feuille_id) sur progression_feuille
-- → on ne peut pas insérer une nouvelle ligne, on remet la ligne existante à zéro.
--
-- Garde-fous :
--   - Bloque si une autre feuille du même type est déjà active pour ce membre
--   - Ne fonctionne que si la feuille est actuellement validée (statut = 'validee')
--
-- Date : 2026-03-02
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION autoriser_revision_feuille(
    p_membre_id  UUID,
    p_feuille_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_chef_id      UUID;
    v_user_id      UUID;
    v_feuille_type TEXT;
    v_count_active INTEGER;
    v_rows_updated INTEGER;
BEGIN
    v_chef_id := auth.uid();

    IF v_chef_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Utilisateur non authentifié');
    END IF;

    -- Résoudre user_id à partir du membre_equipe.id
    SELECT user_id INTO v_user_id
    FROM membre_equipe
    WHERE id = p_membre_id;

    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Membre introuvable');
    END IF;

    -- Récupérer le type de la feuille
    SELECT type INTO v_feuille_type
    FROM feuille_entrainement
    WHERE id = p_feuille_id;

    IF v_feuille_type IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Feuille introuvable');
    END IF;

    -- Vérifier qu'il n'y a pas déjà une autre feuille active du même type
    -- (même logique que gerer_feuilles_membre : max 1 par type non-validée)
    SELECT COUNT(*) INTO v_count_active
    FROM feuilles_autorisees fa
    JOIN feuille_entrainement fe ON fa.feuille_id = fe.id
    LEFT JOIN progression_feuille pf
        ON pf.feuille_id = fa.feuille_id
        AND pf.user_id = v_user_id
    WHERE fa.membre_id = p_membre_id
      AND fe.type = v_feuille_type
      AND fa.feuille_id != p_feuille_id          -- exclure la feuille en cours de révision
      AND (pf.statut IS NULL OR pf.statut != 'validee');

    IF v_count_active >= 1 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Ce membre a déjà une feuille ' || v_feuille_type
                     || ' en cours. Terminez-la d''abord.'
        );
    END IF;

    -- Remettre la progression à zéro
    UPDATE progression_feuille
    SET
        statut           = 'en_attente',
        en_cours         = true,
        score            = NULL,
        validee_at       = NULL,
        est_termine      = false,
        commentaire_chef = NULL
    WHERE user_id    = v_user_id
      AND feuille_id = p_feuille_id
      AND statut     = 'validee';   -- garde-fou : ne touche que les feuilles validées

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Cette feuille n''est pas dans l''état validée pour ce membre'
        );
    END IF;

    -- Réinscrire dans feuilles_autorisees si l'entrée a été supprimée entre-temps
    INSERT INTO feuilles_autorisees (membre_id, feuille_id, autorise_par)
    VALUES (p_membre_id, p_feuille_id, v_chef_id)
    ON CONFLICT (membre_id, feuille_id) DO NOTHING;

    RETURN json_build_object('success', true, 'message', 'Révision lancée');

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION autoriser_revision_feuille(UUID, UUID) TO authenticated;
