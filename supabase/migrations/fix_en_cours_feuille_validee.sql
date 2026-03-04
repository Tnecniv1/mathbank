-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER : synchronise en_cours = false quand statut → 'validee'
--
-- Problème  : valider_soumission_feuille ne mettait pas en_cours = false
--             → la feuille restait visible dans la Library et le sélecteur
--               de session chaotique (tous deux filtrent sur en_cours = true)
--
-- Solution  : trigger BEFORE UPDATE qui force en_cours = false à chaque fois
--             que statut passe à 'validee', quelle que soit la source du write
--             (RPC, client direct, future migration).
--
-- Périmètre : 'validee' seulement.
--             'rejetee' garde en_cours = true (le membre doit refaire la feuille).
--
-- Date      : 2026-03-02
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Fonction du trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_en_cours_on_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.statut = 'validee' THEN
        NEW.en_cours := false;
    END IF;
    RETURN NEW;
END;
$$;


-- ── 2. Trigger BEFORE UPDATE ─────────────────────────────────────────────────
--    DROP IF EXISTS pour permettre les ré-exécutions idempotentes

DROP TRIGGER IF EXISTS trg_sync_en_cours ON progression_feuille;

CREATE TRIGGER trg_sync_en_cours
    BEFORE UPDATE ON progression_feuille
    FOR EACH ROW
    EXECUTE FUNCTION sync_en_cours_on_validation();


-- ── 3. Correction des lignes existantes incohérentes ────────────────────────
--    Rattrapage de toutes les feuilles déjà validées mais toujours en_cours

UPDATE progression_feuille
SET en_cours = false
WHERE statut = 'validee'
  AND en_cours = true;
