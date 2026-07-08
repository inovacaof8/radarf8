
-- 1) Função utilitária: verifica se usuário pertence à área (primária ou membership ativo)
CREATE OR REPLACE FUNCTION public.user_belongs_to_area(_user_id uuid, _area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _user_id AND p.primary_area_id = _area_id AND p.status = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.user_area_membership uam
    WHERE uam.user_id = _user_id
      AND uam.area_id = _area_id
      AND uam.status = 'active'
      AND uam.start_date <= CURRENT_DATE
      AND (uam.end_date IS NULL OR uam.end_date >= CURRENT_DATE)
  );
$$;

-- 2) Trigger em area_manager: bloqueia gestão de área a qual o usuário não pertence
CREATE OR REPLACE FUNCTION public.area_manager_enforce_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active'
     AND (NEW.end_date IS NULL OR NEW.end_date >= CURRENT_DATE) THEN
    IF NOT public.user_belongs_to_area(NEW.user_id, NEW.area_id) THEN
      RAISE EXCEPTION 'O usuário só pode ser gestor de uma área da qual faz parte.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_area_manager_enforce_membership ON public.area_manager;
CREATE TRIGGER trg_area_manager_enforce_membership
BEFORE INSERT OR UPDATE ON public.area_manager
FOR EACH ROW EXECUTE FUNCTION public.area_manager_enforce_membership();

-- 3) Limpeza automática: ao trocar área primária ou perder vínculo, remove cargos de gestor inválidos
CREATE OR REPLACE FUNCTION public.cleanup_area_manager_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.area_manager am
  WHERE am.user_id = _user_id
    AND NOT public.user_belongs_to_area(_user_id, am.area_id);
END $$;

-- 3a) Hook em profiles (mudança de área primária)
CREATE OR REPLACE FUNCTION public.profiles_area_change_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.primary_area_id IS DISTINCT FROM OLD.primary_area_id THEN
    PERFORM public.cleanup_user_memberships(NEW.user_id);
    PERFORM public.cleanup_area_manager_for_user(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

-- 3b) Hook em user_area_membership (delete/update)
CREATE OR REPLACE FUNCTION public.user_area_membership_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.cleanup_user_memberships(OLD.user_id);
    PERFORM public.cleanup_area_manager_for_user(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.cleanup_user_memberships(NEW.user_id);
    PERFORM public.cleanup_area_manager_for_user(NEW.user_id);
    RETURN NEW;
  END IF;
END $$;

-- 4) Limpa dados pré-existentes inconsistentes
DELETE FROM public.area_manager am
WHERE NOT public.user_belongs_to_area(am.user_id, am.area_id);
