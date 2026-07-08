ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Update existing profiles with email from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;