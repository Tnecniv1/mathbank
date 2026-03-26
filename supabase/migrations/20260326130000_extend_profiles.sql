ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pseudo        text,
  ADD COLUMN IF NOT EXISTS telephone     text,
  ADD COLUMN IF NOT EXISTS adresse       text,
  ADD COLUMN IF NOT EXISTS date_naissance date,
  ADD COLUMN IF NOT EXISTS profil_complet boolean DEFAULT false;
