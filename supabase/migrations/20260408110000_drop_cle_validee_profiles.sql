-- Suppression de la colonne cle_validee : la clé secrète n'est plus mémorisée
ALTER TABLE profiles DROP COLUMN IF EXISTS cle_validee;
