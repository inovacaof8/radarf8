
-- Garante que todo usuário ativo tenha pelo menos 1 perfil (role)
CREATE OR REPLACE FUNCTION public.enforce_user_has_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
  _cnt int;
  _status text;
BEGIN
  _uid := COALESCE(OLD.user_id, NEW.user_id);
  IF _uid IS NULL THEN RETURN NULL; END IF;

  SELECT status INTO _status FROM public.profiles WHERE user_id = _uid;
  IF _status IS DISTINCT FROM 'active' THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO _cnt FROM public.user_roles WHERE user_id = _uid;
  IF _cnt = 0 THEN
    RAISE EXCEPTION 'Todo usuário ativo deve possuir pelo menos um perfil de acesso.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_user_roles_enforce_has_role ON public.user_roles;
CREATE CONSTRAINT TRIGGER trg_user_roles_enforce_has_role
AFTER DELETE OR UPDATE ON public.user_roles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_has_role();

-- Quando reativar um usuário, ele precisa ter ao menos um perfil
CREATE OR REPLACE FUNCTION public.profiles_enforce_role_on_activate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cnt int;
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT COUNT(*) INTO _cnt FROM public.user_roles WHERE user_id = NEW.user_id;
    -- INSERT inicial pode acontecer antes da role ser atribuída pelo fluxo de criação;
    -- por isso só validamos na transição inactive->active (reativação).
    IF TG_OP = 'UPDATE' AND _cnt = 0 THEN
      RAISE EXCEPTION 'Não é possível ativar um usuário sem ao menos um perfil de acesso.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_enforce_role_on_activate ON public.profiles;
CREATE TRIGGER trg_profiles_enforce_role_on_activate
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_enforce_role_on_activate();
