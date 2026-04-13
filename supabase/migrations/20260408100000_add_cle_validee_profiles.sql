-- Ajout de la colonne cle_validee pour la protection anti-triche
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cle_validee boolean DEFAULT false;
