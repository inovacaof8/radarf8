INSERT INTO public.profiles (user_id, name, email, status, must_change_password, notes)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'name',''), split_part(u.email, '@', 1)) AS name,
  u.email,
  CASE WHEN COALESCE((u.raw_user_meta_data->>'provisional')::boolean, false)
       THEN 'inactive'::public.user_status
       ELSE 'active'::public.user_status END,
  true,
  CASE WHEN COALESCE((u.raw_user_meta_data->>'provisional')::boolean, false)
       THEN 'Usuário provisório criado a partir de ata de reunião. Cadastro pendente de complemento.'
       ELSE NULL END
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.id IS NULL;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();