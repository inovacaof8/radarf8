
-- Create a security definer function to expose only non-sensitive settings to all authenticated users
CREATE OR REPLACE FUNCTION public.get_public_security_settings()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'session_timeout_minutes', session_timeout_minutes,
    'min_password_length', min_password_length,
    'require_uppercase', require_uppercase,
    'require_lowercase', require_lowercase,
    'require_numbers', require_numbers,
    'require_special_chars', require_special_chars,
    'password_expiration_days', password_expiration_days
  )
  FROM public.security_settings
  LIMIT 1
$$;
