-- Fix recursive access rules for PMO hierarchy
CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.is_reader(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = _project_id
        AND p.manager_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_member pm
      WHERE pm.project_id = _project_id
        AND pm.user_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = _project_id
        AND p.manager_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_portfolio(_portfolio_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.is_reader(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project p
      JOIN public.project_member pm ON pm.project_id = p.id
      WHERE p.portfolio_id = _portfolio_id
        AND pm.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.portfolio_id = _portfolio_id
        AND p.manager_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_read_program(_program_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.is_reader(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project p
      JOIN public.project_member pm ON pm.project_id = p.id
      WHERE p.program_id = _program_id
        AND pm.user_id = _user_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.program_id = _program_id
        AND p.manager_id = _user_id
    );
$$;

DROP POLICY IF EXISTS portfolio_read ON public.portfolio;
DROP POLICY IF EXISTS program_read ON public.program;
DROP POLICY IF EXISTS project_read ON public.project;
DROP POLICY IF EXISTS pm_read ON public.project_member;
DROP POLICY IF EXISTS pm_write ON public.project_member;

CREATE POLICY portfolio_read
ON public.portfolio
FOR SELECT
USING (public.can_read_portfolio(id, auth.uid()));

CREATE POLICY program_read
ON public.program
FOR SELECT
USING (public.can_read_program(id, auth.uid()));

CREATE POLICY project_read
ON public.project
FOR SELECT
USING (public.can_read_project(id, auth.uid()));

CREATE POLICY pm_read
ON public.project_member
FOR SELECT
USING (
  public.is_admin_or_pmo(auth.uid())
  OR user_id = auth.uid()
  OR public.can_manage_project(project_id, auth.uid())
);

CREATE POLICY pm_write
ON public.project_member
FOR ALL
USING (public.can_manage_project(project_id, auth.uid()))
WITH CHECK (public.can_manage_project(project_id, auth.uid()));

-- Ensure mandatory security settings seed exists
INSERT INTO public.security_settings (
  session_timeout_minutes,
  min_password_length,
  require_uppercase,
  require_lowercase,
  require_numbers,
  require_special_chars,
  password_expiration_days,
  max_login_attempts,
  lockout_duration_minutes
)
SELECT 60, 8, true, true, true, false, 90, 5, 15
WHERE NOT EXISTS (SELECT 1 FROM public.security_settings);

-- Ensure mandatory visual/system settings seed exists
INSERT INTO public.system_settings (
  app_name,
  primary_color,
  secondary_color,
  logo_url,
  favicon_url
)
SELECT 'Governança Corporativa', '#2563eb', '#64748b', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);