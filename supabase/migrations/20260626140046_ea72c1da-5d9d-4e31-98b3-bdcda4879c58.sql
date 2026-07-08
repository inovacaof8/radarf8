
-- 1) Permitir qualquer usuário ativo usar o GED (insert/manage do próprio documento)
CREATE OR REPLACE FUNCTION public.ged_can_manage(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active_user(_uid);
$$;

-- 2) Visão geral do módulo: qualquer usuário ativo enxerga o menu/listagem (linhas restritas pela RLS por documento)
CREATE OR REPLACE FUNCTION public.ged_can_view(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active_user(_uid);
$$;

-- 3) Trigger: o dono só pode dar acesso a usuários visíveis a ele (liderados/área).
--    Admin/PMO podem conceder a qualquer um.
CREATE OR REPLACE FUNCTION public.ged_acl_enforce_scope()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _granter uuid := auth.uid();
BEGIN
  IF _granter IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  -- Admin/PMO podem compartilhar com qualquer um
  IF public.is_admin_or_pmo(_granter) THEN
    RETURN NEW;
  END IF;

  -- O dono só pode compartilhar com usuários sob sua visibilidade
  IF NOT EXISTS (
    SELECT 1 FROM public.users_visible_to(_granter) v
    WHERE v.user_id = NEW.user_id
  ) AND NEW.user_id <> _granter THEN
    RAISE EXCEPTION 'Você só pode compartilhar com usuários sob sua gestão.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ged_acl_enforce_scope ON public.ged_document_acl;
CREATE TRIGGER trg_ged_acl_enforce_scope
  BEFORE INSERT OR UPDATE ON public.ged_document_acl
  FOR EACH ROW EXECUTE FUNCTION public.ged_acl_enforce_scope();
