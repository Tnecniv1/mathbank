-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION: Élargir les contraintes CHECK sur savoir et rédaction
-- Description: Permet les valeurs 0, 25, 50, 75, 100 au lieu de 0, 50, 100
-- Date: 2026-02-12
-- ═══════════════════════════════════════════════════════════════════════════

-- Supprimer les anciennes contraintes
ALTER TABLE score_local DROP CONSTRAINT IF EXISTS score_local_savoir_check;
ALTER TABLE score_local DROP CONSTRAINT IF EXISTS score_local_redaction_check;

-- Recréer avec les nouvelles valeurs
ALTER TABLE score_local ADD CONSTRAINT score_local_savoir_check
  CHECK (savoir IN (0, 25, 50, 75, 100));

ALTER TABLE score_local ADD CONSTRAINT score_local_redaction_check
  CHECK (redaction IN (0, 25, 50, 75, 100));
