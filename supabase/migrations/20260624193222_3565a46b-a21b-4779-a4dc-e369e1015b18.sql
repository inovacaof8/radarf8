
-- 1) Áreas vinculadas a um projeto (via portfólio direto e/ou via programa->portfólio)
CREATE OR REPLACE FUNCTION public.project_areas(_project_id uuid)
RETURNS TABLE(area_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT pa.area_id
  FROM public.project p
  LEFT JOIN public.portfolio_area pa
    ON pa.portfolio_id = p.portfolio_id
  WHERE p.id = _project_id AND pa.area_id IS NOT NULL
  UNION
  SELECT DISTINCT pa.area_id
  FROM public.project p
  JOIN public.program pr ON pr.id = p.program_id
  JOIN public.portfolio_area pa ON pa.portfolio_id = pr.portfolio_id
  WHERE p.id = _project_id;
$$;

-- 2) Pode o usuário participar deste projeto? (área compartilhada)
CREATE OR REPLACE FUNCTION public.user_can_join_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_pmo(_user_id)
    OR EXISTS (SELECT 1 FROM public.project WHERE id = _project_id AND manager_id = _user_id)
    OR NOT EXISTS (SELECT 1 FROM public.project_areas(_project_id))
    OR EXISTS (
      SELECT 1
      FROM public.project_areas(_project_id) pa
      JOIN public.user_visible_areas(_user_id) uva ON uva.area_id = pa.area_id
    );
$$;

-- 3) Pode o usuário participar deste plano de ação?
CREATE OR REPLACE FUNCTION public.user_can_join_action_plan(_user_id uuid, _plan_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_or_pmo(_user_id)
    OR EXISTS (SELECT 1 FROM public.action_plan WHERE id = _plan_id AND (owner_id = _user_id OR created_by = _user_id))
    OR NOT EXISTS (SELECT 1 FROM public.action_plan_area WHERE action_plan_id = _plan_id)
    OR EXISTS (
      SELECT 1
      FROM public.action_plan_area apa
      JOIN public.user_visible_areas(_user_id) uva ON uva.area_id = apa.area_id
      WHERE apa.action_plan_id = _plan_id
    );
$$;

-- 4) Triggers que impedem adicionar usuário de outra área
CREATE OR REPLACE FUNCTION public.project_member_enforce_area()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NOT public.user_can_join_project(NEW.user_id, NEW.project_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à(s) área(s) deste projeto e não pode ser adicionado à equipe.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_project_member_enforce_area ON public.project_member;
CREATE TRIGGER trg_project_member_enforce_area
BEFORE INSERT OR UPDATE ON public.project_member
FOR EACH ROW EXECUTE FUNCTION public.project_member_enforce_area();

CREATE OR REPLACE FUNCTION public.action_plan_member_enforce_area()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NOT public.user_can_join_action_plan(NEW.user_id, NEW.action_plan_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à(s) área(s) deste plano de ação e não pode ser adicionado.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_action_plan_member_enforce_area ON public.action_plan_member;
CREATE TRIGGER trg_action_plan_member_enforce_area
BEFORE INSERT OR UPDATE ON public.action_plan_member
FOR EACH ROW EXECUTE FUNCTION public.action_plan_member_enforce_area();

-- 5) Limpeza automática quando a área do usuário muda
CREATE OR REPLACE FUNCTION public.cleanup_user_memberships(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Remove de equipes de projetos onde não tem mais área em comum
  DELETE FROM public.project_member pm
  WHERE pm.user_id = _user_id
    AND NOT public.is_admin_or_pmo(_user_id)
    AND NOT EXISTS (SELECT 1 FROM public.project p WHERE p.id = pm.project_id AND p.manager_id = _user_id)
    AND EXISTS (SELECT 1 FROM public.project_areas(pm.project_id))
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_areas(pm.project_id) pa
      JOIN public.user_visible_areas(_user_id) uva ON uva.area_id = pa.area_id
    );

  -- Remove de planos de ação onde não tem mais área em comum
  DELETE FROM public.action_plan_member apm
  WHERE apm.user_id = _user_id
    AND NOT public.is_admin_or_pmo(_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.action_plan ap
      WHERE ap.id = apm.action_plan_id
        AND (ap.owner_id = _user_id OR ap.created_by = _user_id)
    )
    AND EXISTS (SELECT 1 FROM public.action_plan_area WHERE action_plan_id = apm.action_plan_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.action_plan_area apa
      JOIN public.user_visible_areas(_user_id) uva ON uva.area_id = apa.area_id
      WHERE apa.action_plan_id = apm.action_plan_id
    );
END $$;

-- Trigger em profiles: primary_area_id mudou
CREATE OR REPLACE FUNCTION public.profiles_area_change_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.primary_area_id IS DISTINCT FROM OLD.primary_area_id THEN
    PERFORM public.cleanup_user_memberships(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_area_change_cleanup ON public.profiles;
CREATE TRIGGER trg_profiles_area_change_cleanup
AFTER UPDATE OF primary_area_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_area_change_cleanup();

-- Trigger em user_area_membership
CREATE OR REPLACE FUNCTION public.user_area_membership_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.cleanup_user_memberships(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.cleanup_user_memberships(NEW.user_id);
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_user_area_membership_cleanup ON public.user_area_membership;
CREATE TRIGGER trg_user_area_membership_cleanup
AFTER INSERT OR UPDATE OR DELETE ON public.user_area_membership
FOR EACH ROW EXECUTE FUNCTION public.user_area_membership_cleanup();

-- 6) Endurecer WITH CHECK das políticas para também exigir match de área
DROP POLICY IF EXISTS "pm_write" ON public.project_member;
CREATE POLICY "pm_write" ON public.project_member
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_admin_or_pmo(auth.uid()) OR public.can_manage_project(project_id, auth.uid()))
  WITH CHECK (
    (public.is_admin_or_pmo(auth.uid()) OR public.can_manage_project(project_id, auth.uid()))
    AND EXISTS (SELECT 1 FROM public.users_visible_to(auth.uid()) v WHERE v.user_id = project_member.user_id)
    AND public.user_can_join_project(project_member.user_id, project_member.project_id)
  );

-- 7) Executar limpeza retroativa para usuários atuais
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles WHERE status = 'active' LOOP
    PERFORM public.cleanup_user_memberships(r.user_id);
  END LOOP;
END $$;
