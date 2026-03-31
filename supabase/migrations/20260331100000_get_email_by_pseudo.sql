CREATE OR REPLACE FUNCTION get_email_by_pseudo(pseudo text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT email FROM auth.users
  WHERE id = (
    SELECT id FROM profiles WHERE full_name = pseudo LIMIT 1
  )
  LIMIT 1;
$$;
