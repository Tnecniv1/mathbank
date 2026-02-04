CREATE OR REPLACE FUNCTION public.gerer_feuilles_membre(p_membre_id uuid, p_feuilles_a_ajouter uuid[], p_feuilles_a_retirer uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
  v_feuille_id UUID;
  v_feuille_type TEXT;
  v_count_meca INTEGER;
  v_count_chaos INTEGER;
  v_chef_id UUID;
  v_user_id UUID;
BEGIN
  v_chef_id := auth.uid();

  IF v_chef_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Utilisateur non authentifié'
    );
  END IF;

  SELECT user_id INTO v_user_id
  FROM membre_equipe
  WHERE id = p_membre_id;

  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Membre introuvable'
    );
  END IF;

  IF p_feuilles_a_retirer IS NOT NULL AND array_length(p_feuilles_a_retirer, 1) > 0 THEN
    FOREACH v_feuille_id IN ARRAY p_feuilles_a_retirer LOOP
      DELETE FROM feuilles_autorisees
      WHERE membre_id = p_membre_id
        AND feuille_id = v_feuille_id;
    END LOOP;
  END IF;

  IF p_feuilles_a_ajouter IS NOT NULL AND array_length(p_feuilles_a_ajouter, 1) > 0 THEN
    FOREACH v_feuille_id IN ARRAY p_feuilles_a_ajouter LOOP

      SELECT type INTO v_feuille_type
      FROM feuille_entrainement
      WHERE id = v_feuille_id;

      IF v_feuille_type IS NULL THEN
        RETURN json_build_object(
          'success', false,
          'error', 'La feuille n''a pas de type défini (mécanique ou chaotique)'
        );
      END IF;

      IF v_feuille_type = 'mecanique' THEN
        SELECT COUNT(*) INTO v_count_meca
        FROM feuilles_autorisees fa
        JOIN feuille_entrainement fe ON fa.feuille_id = fe.id
        LEFT JOIN progression_feuille pf
          ON pf.feuille_id = fa.feuille_id
          AND pf.user_id = v_user_id
        WHERE fa.membre_id = p_membre_id
          AND fe.type = 'mecanique'
          AND (pf.statut IS NULL OR pf.statut != 'validee');

        IF v_count_meca >= 1 THEN
          RETURN json_build_object(
            'success', false,
            'error', 'Ce membre a déjà 1 feuille mécanique autorisée. Maximum : 1 feuille mécanique.'
          );
        END IF;
      END IF;

      IF v_feuille_type = 'chaotique' THEN
        SELECT COUNT(*) INTO v_count_chaos
        FROM feuilles_autorisees fa
        JOIN feuille_entrainement fe ON fa.feuille_id = fe.id
        LEFT JOIN progression_feuille pf
          ON pf.feuille_id = fa.feuille_id
          AND pf.user_id = v_user_id
        WHERE fa.membre_id = p_membre_id
          AND fe.type = 'chaotique'
          AND (pf.statut IS NULL OR pf.statut != 'validee');

        IF v_count_chaos >= 1 THEN
          RETURN json_build_object(
            'success', false,
            'error', 'Ce membre a déjà 1 feuille chaotique autorisée. Maximum : 1 feuille chaotique.'
          );
        END IF;
      END IF;

      INSERT INTO feuilles_autorisees (membre_id, feuille_id, autorise_par)
      VALUES (p_membre_id, v_feuille_id, v_chef_id)
      ON CONFLICT (membre_id, feuille_id) DO NOTHING;

      -- ✅ AJOUT : Créer ou mettre à jour la progression
      INSERT INTO progression_feuille (user_id, feuille_id, en_cours, statut, est_termine)
      VALUES (v_user_id, v_feuille_id, true, 'en_attente', false)
      ON CONFLICT (user_id, feuille_id)
      DO UPDATE SET
        en_cours = true,
        statut = 'en_attente',
        est_termine = false
      WHERE progression_feuille.statut != 'validee';

    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Feuilles mises à jour avec succès'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$
