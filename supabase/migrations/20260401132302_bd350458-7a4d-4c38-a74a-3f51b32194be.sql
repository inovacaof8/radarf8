CREATE OR REPLACE FUNCTION public.link_oauth_profile(_new_user_id uuid, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_record RECORD;
  _old_user_id uuid;
BEGIN
  -- Check if profile already exists for this user_id
  SELECT * INTO _profile_record FROM public.profiles WHERE user_id = _new_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('linked', true, 'status', 'already_linked');
  END IF;

  -- Check if profile exists for this email
  SELECT * INTO _profile_record FROM public.profiles WHERE email = _email LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'status', 'no_profile');
  END IF;

  _old_user_id := _profile_record.user_id;

  -- Update profile to new user_id
  UPDATE public.profiles SET user_id = _new_user_id, updated_at = now() WHERE id = _profile_record.id;

  -- Update user_roles
  UPDATE public.user_roles SET user_id = _new_user_id WHERE user_id = _old_user_id;

  -- Update audit_logs references
  UPDATE public.audit_logs SET user_id = _new_user_id WHERE user_id = _old_user_id;

  -- Update legal_acceptances
  UPDATE public.legal_acceptances SET user_id = _new_user_id WHERE user_id = _old_user_id;

  RETURN jsonb_build_object('linked', true, 'status', 'linked_successfully');
END;
$$;