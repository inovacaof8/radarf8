
-- 1) Consolidate duplicate modules: projects→project, programs→program, portfolios→portfolio
-- Move role_permissions that point at the duplicate (export action) into the canonical module first
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Add 'export' action to canonical modules if missing
  INSERT INTO public.permissions (module, action, description)
  SELECT m, 'export', 'Exportar dados de ' || m
  FROM (VALUES ('project'),('program'),('portfolio')) AS t(m)
  ON CONFLICT DO NOTHING;
END $$;

-- Re-point role_permissions of duplicates to canonical, then delete duplicates
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, pcan.id
FROM public.role_permissions rp
JOIN public.permissions pdup ON pdup.id = rp.permission_id
JOIN public.permissions pcan
  ON pcan.action = pdup.action
 AND pcan.module = CASE pdup.module
   WHEN 'projects' THEN 'project'
   WHEN 'programs' THEN 'program'
   WHEN 'portfolios' THEN 'portfolio'
 END
WHERE pdup.module IN ('projects','programs','portfolios')
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions
WHERE permission_id IN (SELECT id FROM public.permissions WHERE module IN ('projects','programs','portfolios'));

DELETE FROM public.permissions WHERE module IN ('projects','programs','portfolios');

-- 2) Helper: has_module_perm — true if user has any of the given actions on a module
CREATE OR REPLACE FUNCTION public.has_module_perm(_user_id uuid, _module text, _actions text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.module = _module
      AND p.action = ANY(_actions)
  )
$$;

-- 3) Extend read functions to honor permission table view/edit/admin
CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.is_reader(_user_id)
    OR public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
    OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = _project_id AND p.manager_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = _project_id AND pm.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_read_program(_program_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.is_reader(_user_id)
    OR public.has_module_perm(_user_id, 'program', ARRAY['view','edit','admin'])
    OR public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
    OR EXISTS (SELECT 1 FROM public.project p JOIN public.project_member pm ON pm.project_id = p.id
               WHERE p.program_id = _program_id AND pm.user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.project p WHERE p.program_id = _program_id AND p.manager_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_read_portfolio(_portfolio_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.is_reader(_user_id)
    OR public.has_module_perm(_user_id, 'portfolio', ARRAY['view','edit','admin'])
    OR public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
    OR EXISTS (SELECT 1 FROM public.project p JOIN public.project_member pm ON pm.project_id = p.id
               WHERE p.portfolio_id = _portfolio_id AND pm.user_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.project p WHERE p.portfolio_id = _portfolio_id AND p.manager_id = _user_id);
$$;

-- 4) Project table: drop redundant policies and create clean ones honoring permissions
DROP POLICY IF EXISTS project_delete ON public.project;
DROP POLICY IF EXISTS project_delete_perm ON public.project;
DROP POLICY IF EXISTS project_insert ON public.project;
DROP POLICY IF EXISTS project_insert_perm ON public.project;
DROP POLICY IF EXISTS project_update ON public.project;
DROP POLICY IF EXISTS project_update_perm ON public.project;

CREATE POLICY project_insert ON public.project FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['create','admin'])
);

CREATE POLICY project_update ON public.project FOR UPDATE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR manager_id = auth.uid()
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR manager_id = auth.uid()
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
);

CREATE POLICY project_delete ON public.project FOR DELETE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['delete','admin'])
);

-- 5) Portfolio: replace permission policies to use helper (cleaner) and honor view via can_read_portfolio
DROP POLICY IF EXISTS portfolio_insert_perm ON public.portfolio;
DROP POLICY IF EXISTS portfolio_update_perm ON public.portfolio;
DROP POLICY IF EXISTS portfolio_delete_perm ON public.portfolio;

CREATE POLICY portfolio_insert ON public.portfolio FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'portfolio', ARRAY['create','admin']));

CREATE POLICY portfolio_update ON public.portfolio FOR UPDATE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'portfolio', ARRAY['edit','admin']))
WITH CHECK (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'portfolio', ARRAY['edit','admin']));

CREATE POLICY portfolio_delete ON public.portfolio FOR DELETE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'portfolio', ARRAY['delete','admin']));

-- 6) Program: same pattern
DROP POLICY IF EXISTS program_insert_perm ON public.program;
DROP POLICY IF EXISTS program_update_perm ON public.program;
DROP POLICY IF EXISTS program_delete_perm ON public.program;

CREATE POLICY program_insert ON public.program FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'program', ARRAY['create','admin']));

CREATE POLICY program_update ON public.program FOR UPDATE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'program', ARRAY['edit','admin']))
WITH CHECK (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'program', ARRAY['edit','admin']));

CREATE POLICY program_delete ON public.program FOR DELETE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'program', ARRAY['delete','admin']));

-- 7) Sub-tables (phase, task, project_deliverable, risk, project_member):
--    Allow users with project edit/admin perms to write; reads already go through can_read_project (now perm-aware)
DROP POLICY IF EXISTS phase_write ON public.phase;
CREATE POLICY phase_write ON public.phase FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = phase.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = phase.project_id AND pm.user_id = auth.uid())
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = phase.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = phase.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS task_write ON public.task;
CREATE POLICY task_write ON public.task FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR public.has_module_perm(auth.uid(), 'tasks', ARRAY['edit','create','admin'])
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = task.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = task.project_id AND pm.user_id = auth.uid())
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR public.has_module_perm(auth.uid(), 'tasks', ARRAY['edit','create','admin'])
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = task.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = task.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS pd_write ON public.project_deliverable;
CREATE POLICY pd_write ON public.project_deliverable FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = project_deliverable.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = project_deliverable.project_id AND pm.user_id = auth.uid())
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = project_deliverable.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = project_deliverable.project_id AND pm.user_id = auth.uid())
);

DROP POLICY IF EXISTS risk_write ON public.risk;
CREATE POLICY risk_write ON public.risk FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = risk.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = risk.project_id AND pm.user_id = auth.uid())
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = risk.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = risk.project_id AND pm.user_id = auth.uid())
);

-- Allow project managers (or users with project admin perm) to manage members
DROP POLICY IF EXISTS pm_write ON public.project_member;
CREATE POLICY pm_write ON public.project_member FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR public.can_manage_project(project_id, auth.uid())
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
  OR public.can_manage_project(project_id, auth.uid())
);
