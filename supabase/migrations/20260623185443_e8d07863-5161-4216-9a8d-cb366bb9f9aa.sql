
-- 1) Restrict project visibility: non-admin/PMO users only see projects where they
-- are the manager or an explicit project_member. Portfolio/program access alone
-- no longer grants visibility of all child projects.
CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = _project_id AND p.manager_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.project_member pm
        WHERE pm.project_id = _project_id AND pm.user_id = _user_id
      )
    )
$$;

-- 2) Programs/portfolios continue to be visible to area members, but the
-- can_read_program path that exposed projects through program ownership/area is kept
-- only for program/portfolio visibility, not projects. (can_read_program unchanged
-- already does not influence can_read_project anymore.)

-- 3) Project member write: when a Gestor (or any non-admin manager) adds a member,
-- the target user must be under their leadership scope.
DROP POLICY IF EXISTS pm_write ON public.project_member;
CREATE POLICY pm_write ON public.project_member
FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.can_manage_project(project_id, auth.uid())
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.can_manage_project(project_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_leadership_user_ids(auth.uid()) l
        WHERE l.user_id = project_member.user_id
      )
    )
  )
);
