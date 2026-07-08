
-- MODULE
INSERT INTO public.modules (name, slug, description, is_active)
SELECT 'Workflows', 'workflows', 'Workflow de demandas com etapas e aprovação', true
WHERE NOT EXISTS (SELECT 1 FROM public.modules WHERE slug = 'workflows');

INSERT INTO public.permissions (module, action, description)
SELECT 'workflows', a.action, a.descr
FROM (VALUES
  ('view','Visualizar workflows e demandas'),
  ('create','Criar workflows e demandas'),
  ('edit','Editar workflows e demandas'),
  ('admin','Administrar workflows'),
  ('approve','Aprovar etapas de demanda')
) AS a(action, descr)
WHERE NOT EXISTS (SELECT 1 FROM public.permissions p WHERE p.module='workflows' AND p.action=a.action);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
JOIN public.permissions p ON p.module='workflows'
WHERE r.name IN ('Administrador','PMO')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
JOIN public.permissions p ON p.module='workflows' AND p.action IN ('view','create','edit','approve')
WHERE r.name = 'Gestor'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r
JOIN public.permissions p ON p.module='workflows' AND p.action='view'
WHERE r.name IN ('Membro','Diretor Geral','Leitor')
ON CONFLICT DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS public.workflow_demand_code_seq START 1;

-- workflow
CREATE TABLE public.workflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  area_id uuid REFERENCES public.area(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow TO authenticated;
GRANT ALL ON public.workflow TO service_role;
ALTER TABLE public.workflow ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_workflow_updated_at BEFORE UPDATE ON public.workflow
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- workflow_steps
CREATE TABLE public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.workflow(id) ON DELETE CASCADE,
  order_index int NOT NULL,
  name text NOT NULL,
  description text,
  sla_hours int NOT NULL DEFAULT 24,
  default_responsible_type text NOT NULL DEFAULT 'user'
    CHECK (default_responsible_type IN ('user','area_manager','creator','previous_step')),
  default_responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  default_responsible_area_id uuid REFERENCES public.area(id) ON DELETE SET NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  approver_type text CHECK (approver_type IN ('user','area_manager','configured')),
  approver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_area_id uuid REFERENCES public.area(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, order_index),
  CHECK (
    NOT requires_approval
    OR (approver_type IS NOT NULL AND (
      (approver_type='user' AND approver_user_id IS NOT NULL)
      OR (approver_type='area_manager' AND approver_area_id IS NOT NULL)
      OR (approver_type='configured' AND approver_user_id IS NOT NULL)
    ))
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_steps TO authenticated;
GRANT ALL ON public.workflow_steps TO service_role;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_workflow_steps_updated_at BEFORE UPDATE ON public.workflow_steps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- workflow_demands
CREATE TABLE public.workflow_demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  workflow_id uuid NOT NULL REFERENCES public.workflow(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','critica')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting_approval','rejected','completed','cancelled')),
  current_step_id uuid REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  current_responsible_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_demands TO authenticated;
GRANT ALL ON public.workflow_demands TO service_role;
ALTER TABLE public.workflow_demands ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_workflow_demands_updated_at BEFORE UPDATE ON public.workflow_demands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- workflow_demand_history
CREATE TABLE public.workflow_demand_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.workflow_demands(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN (
    'created','assigned','started','submitted_for_approval','approved','rejected','advanced','completed','cancelled'
  )),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.workflow_demand_history TO authenticated;
GRANT ALL ON public.workflow_demand_history TO service_role;
ALTER TABLE public.workflow_demand_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.workflow_demand_history (demand_id, created_at);
CREATE INDEX ON public.workflow_demands (current_responsible_id);
CREATE INDEX ON public.workflow_demands (current_approver_id);
CREATE INDEX ON public.workflow_demands (status);

-- HELPERS
CREATE OR REPLACE FUNCTION public.can_manage_workflow(_workflow_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.workflow w
      WHERE w.id = _workflow_id
        AND (w.created_by = _user_id
             OR (w.area_id IS NOT NULL AND public.user_can_manage_area(_user_id, w.area_id)))
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_workflow(_workflow_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_active_user(_user_id)
    AND (public.is_global_reader(_user_id)
         OR public.has_module_perm(_user_id, 'workflows', ARRAY['view','create','edit','admin']))
$$;

CREATE OR REPLACE FUNCTION public.can_read_demand(_demand_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.workflow_demands d
        WHERE d.id = _demand_id
          AND (
            d.created_by = _user_id
            OR d.current_responsible_id = _user_id
            OR d.current_approver_id = _user_id
            OR EXISTS (SELECT 1 FROM public.workflow_demand_history h
                       WHERE h.demand_id = d.id
                         AND (h.actor_id=_user_id OR h.to_user_id=_user_id OR h.approver_id=_user_id))
            OR EXISTS (SELECT 1 FROM public.workflow w
                       WHERE w.id=d.workflow_id AND w.area_id IS NOT NULL
                         AND public.user_can_manage_area(_user_id, w.area_id))
          )
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.workflow_resolve_approver(_step_id uuid, _demand_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.workflow_steps; _r uuid;
BEGIN
  SELECT * INTO s FROM public.workflow_steps WHERE id=_step_id;
  IF s.approver_type IN ('user','configured') THEN
    RETURN s.approver_user_id;
  ELSIF s.approver_type = 'area_manager' THEN
    SELECT am.user_id INTO _r FROM public.area_manager am
     WHERE am.area_id=s.approver_area_id AND am.status='active'
       AND am.start_date <= CURRENT_DATE AND (am.end_date IS NULL OR am.end_date>=CURRENT_DATE)
     ORDER BY am.start_date DESC LIMIT 1;
    RETURN _r;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.workflow_resolve_responsible(_step_id uuid, _demand_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.workflow_steps; d public.workflow_demands; _r uuid;
BEGIN
  SELECT * INTO s FROM public.workflow_steps WHERE id=_step_id;
  SELECT * INTO d FROM public.workflow_demands WHERE id=_demand_id;
  IF s.default_responsible_type='user' THEN RETURN s.default_responsible_user_id;
  ELSIF s.default_responsible_type='creator' THEN RETURN d.created_by;
  ELSIF s.default_responsible_type='previous_step' THEN RETURN d.current_responsible_id;
  ELSIF s.default_responsible_type='area_manager' THEN
    SELECT am.user_id INTO _r FROM public.area_manager am
     WHERE am.area_id=s.default_responsible_area_id AND am.status='active'
     ORDER BY am.start_date DESC LIMIT 1;
    RETURN _r;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public._workflow_advance(_demand_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.workflow_demands; cur public.workflow_steps; nxt public.workflow_steps;
  _new_resp uuid; _new_due timestamptz;
BEGIN
  SELECT * INTO d FROM public.workflow_demands WHERE id=_demand_id;
  SELECT * INTO cur FROM public.workflow_steps WHERE id=d.current_step_id;
  SELECT * INTO nxt FROM public.workflow_steps
    WHERE workflow_id=cur.workflow_id AND order_index>cur.order_index
    ORDER BY order_index ASC LIMIT 1;
  IF nxt.id IS NULL THEN
    UPDATE public.workflow_demands
       SET status='completed', current_approver_id=NULL, completed_at=now()
     WHERE id=_demand_id;
    INSERT INTO public.workflow_demand_history(demand_id, step_id, action, actor_id)
    VALUES (_demand_id, cur.id, 'completed', auth.uid());
    RETURN;
  END IF;
  _new_resp := public.workflow_resolve_responsible(nxt.id, _demand_id);
  _new_due := now() + make_interval(hours => nxt.sla_hours);
  UPDATE public.workflow_demands
     SET current_step_id=nxt.id, current_responsible_id=_new_resp,
         current_approver_id=NULL, status='in_progress', due_at=_new_due
   WHERE id=_demand_id;
  INSERT INTO public.workflow_demand_history(demand_id, step_id, action, actor_id, to_user_id)
  VALUES (_demand_id, nxt.id, 'advanced', auth.uid(), _new_resp);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_complete_step(_demand_id uuid, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.workflow_demands; s public.workflow_steps; _approver uuid;
BEGIN
  SELECT * INTO d FROM public.workflow_demands WHERE id=_demand_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Demanda não encontrada'; END IF;
  IF d.status NOT IN ('open','in_progress') THEN
    RAISE EXCEPTION 'Demanda não está em execução (status = %)', d.status;
  END IF;
  IF d.current_responsible_id IS DISTINCT FROM auth.uid()
     AND NOT public.is_admin_or_pmo(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o responsável atual pode concluir a etapa.' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT * INTO s FROM public.workflow_steps WHERE id=d.current_step_id;
  IF s.requires_approval THEN
    _approver := public.workflow_resolve_approver(s.id, d.id);
    IF _approver IS NULL THEN
      RAISE EXCEPTION 'Aprovador da etapa não pôde ser resolvido.';
    END IF;
    UPDATE public.workflow_demands
       SET status='waiting_approval', current_approver_id=_approver
     WHERE id=d.id;
    INSERT INTO public.workflow_demand_history(demand_id, step_id, action, actor_id, approver_id, comment)
    VALUES (d.id, s.id, 'submitted_for_approval', auth.uid(), _approver, _comment);
  ELSE
    INSERT INTO public.workflow_demand_history(demand_id, step_id, action, actor_id, comment)
    VALUES (d.id, s.id, 'completed', auth.uid(), _comment);
    PERFORM public._workflow_advance(d.id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.workflow_approve(_demand_id uuid, _comment text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.workflow_demands;
BEGIN
  SELECT * INTO d FROM public.workflow_demands WHERE id=_demand_id FOR UPDATE;
  IF d.status <> 'waiting_approval' THEN RAISE EXCEPTION 'Demanda não está aguardando aprovação.'; END IF;
  IF d.current_approver_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin_or_pmo(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o aprovador definido pode aprovar.' USING ERRCODE='insufficient_privilege';
  END IF;
  INSERT INTO public.workflow_demand_history(demand_id, step_id, action, actor_id, approver_id, comment)
  VALUES (d.id, d.current_step_id, 'approved', auth.uid(), auth.uid(), _comment);
  PERFORM public._workflow_advance(d.id);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_reject(_demand_id uuid, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.workflow_demands;
BEGIN
  IF _comment IS NULL OR length(trim(_comment))=0 THEN
    RAISE EXCEPTION 'É obrigatório informar o motivo da rejeição.';
  END IF;
  SELECT * INTO d FROM public.workflow_demands WHERE id=_demand_id FOR UPDATE;
  IF d.status <> 'waiting_approval' THEN RAISE EXCEPTION 'Demanda não está aguardando aprovação.'; END IF;
  IF d.current_approver_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin_or_pmo(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o aprovador definido pode rejeitar.' USING ERRCODE='insufficient_privilege';
  END IF;
  UPDATE public.workflow_demands SET status='rejected', current_approver_id=NULL WHERE id=d.id;
  INSERT INTO public.workflow_demand_history(demand_id, step_id, action, actor_id, approver_id, comment)
  VALUES (d.id, d.current_step_id, 'rejected', auth.uid(), auth.uid(), _comment);
END $$;

CREATE OR REPLACE FUNCTION public.workflow_resubmit(_demand_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.workflow_demands;
BEGIN
  SELECT * INTO d FROM public.workflow_demands WHERE id=_demand_id FOR UPDATE;
  IF d.status <> 'rejected' THEN RAISE EXCEPTION 'Demanda não está rejeitada.'; END IF;
  IF d.current_responsible_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin_or_pmo(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o responsável pode reabrir a demanda.' USING ERRCODE='insufficient_privilege';
  END IF;
  UPDATE public.workflow_demands SET status='in_progress' WHERE id=d.id;
END $$;

-- BEFORE INSERT: code, first step
CREATE OR REPLACE FUNCTION public.workflow_demand_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE first_step public.workflow_steps;
BEGIN
  IF NEW.code IS NULL OR NEW.code='' THEN
    NEW.code := 'WF-' || LPAD(nextval('public.workflow_demand_code_seq')::text, 5, '0');
  END IF;
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  IF NEW.current_step_id IS NULL THEN
    SELECT * INTO first_step FROM public.workflow_steps
      WHERE workflow_id=NEW.workflow_id ORDER BY order_index ASC LIMIT 1;
    IF first_step.id IS NULL THEN RAISE EXCEPTION 'Workflow não possui etapas cadastradas.'; END IF;
    NEW.current_step_id := first_step.id;
    IF first_step.default_responsible_type='user' THEN
      NEW.current_responsible_id := first_step.default_responsible_user_id;
    ELSIF first_step.default_responsible_type='creator' THEN
      NEW.current_responsible_id := NEW.created_by;
    ELSIF first_step.default_responsible_type='area_manager' THEN
      SELECT am.user_id INTO NEW.current_responsible_id FROM public.area_manager am
       WHERE am.area_id=first_step.default_responsible_area_id AND am.status='active'
       ORDER BY am.start_date DESC LIMIT 1;
    END IF;
    IF NEW.due_at IS NULL THEN NEW.due_at := now() + make_interval(hours => first_step.sla_hours); END IF;
    IF NEW.status='open' THEN NEW.status := 'in_progress'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_workflow_demand_before_insert
BEFORE INSERT ON public.workflow_demands
FOR EACH ROW EXECUTE FUNCTION public.workflow_demand_before_insert();

CREATE OR REPLACE FUNCTION public.workflow_demand_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.workflow_demand_history(demand_id, step_id, action, actor_id, to_user_id)
  VALUES (NEW.id, NEW.current_step_id, 'created', NEW.created_by, NEW.current_responsible_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_workflow_demand_after_insert
AFTER INSERT ON public.workflow_demands
FOR EACH ROW EXECUTE FUNCTION public.workflow_demand_after_insert();

CREATE OR REPLACE FUNCTION public.workflow_demand_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF OLD.status='waiting_approval' AND NOT public.is_admin_or_pmo(auth.uid()) THEN
    IF NEW.current_step_id IS DISTINCT FROM OLD.current_step_id
       OR NEW.current_responsible_id IS DISTINCT FROM OLD.current_responsible_id THEN
      RAISE EXCEPTION 'Demanda aguardando aprovação não pode avançar diretamente.'
        USING ERRCODE='insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_workflow_demand_guard_update
BEFORE UPDATE ON public.workflow_demands
FOR EACH ROW EXECUTE FUNCTION public.workflow_demand_guard_update();

-- RLS
CREATE POLICY workflow_select ON public.workflow FOR SELECT TO authenticated
USING (public.can_read_workflow(id, auth.uid()));
CREATE POLICY workflow_insert ON public.workflow FOR INSERT TO authenticated
WITH CHECK (public.has_module_perm(auth.uid(),'workflows',ARRAY['create','admin']));
CREATE POLICY workflow_update ON public.workflow FOR UPDATE TO authenticated
USING (public.can_manage_workflow(id, auth.uid()))
WITH CHECK (public.can_manage_workflow(id, auth.uid()));
CREATE POLICY workflow_delete ON public.workflow FOR DELETE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()));

CREATE POLICY wsteps_select ON public.workflow_steps FOR SELECT TO authenticated
USING (public.can_read_workflow(workflow_id, auth.uid()));
CREATE POLICY wsteps_write ON public.workflow_steps FOR ALL TO authenticated
USING (public.can_manage_workflow(workflow_id, auth.uid()))
WITH CHECK (public.can_manage_workflow(workflow_id, auth.uid()));

CREATE POLICY wdemand_select ON public.workflow_demands FOR SELECT TO authenticated
USING (
  created_by=auth.uid() OR current_responsible_id=auth.uid() OR current_approver_id=auth.uid()
  OR public.can_read_demand(id, auth.uid())
);
CREATE POLICY wdemand_insert ON public.workflow_demands FOR INSERT TO authenticated
WITH CHECK (
  public.has_module_perm(auth.uid(),'workflows',ARRAY['create','admin'])
  AND (created_by=auth.uid() OR created_by IS NULL)
);
CREATE POLICY wdemand_update ON public.workflow_demands FOR UPDATE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid()) OR created_by=auth.uid()
  OR current_responsible_id=auth.uid() OR current_approver_id=auth.uid()
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid()) OR created_by=auth.uid()
  OR current_responsible_id=auth.uid() OR current_approver_id=auth.uid()
);
CREATE POLICY wdemand_delete ON public.workflow_demands FOR DELETE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()));

CREATE POLICY whistory_select ON public.workflow_demand_history FOR SELECT TO authenticated
USING (public.can_read_demand(demand_id, auth.uid()));
CREATE POLICY whistory_insert ON public.workflow_demand_history FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.workflow_demands d WHERE d.id=demand_id
             AND (d.created_by=auth.uid() OR d.current_responsible_id=auth.uid() OR d.current_approver_id=auth.uid()))
);
