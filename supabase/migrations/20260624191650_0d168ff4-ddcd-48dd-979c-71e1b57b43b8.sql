DROP POLICY IF EXISTS pm_read ON public.project_member;
CREATE POLICY pm_read
ON public.project_member
FOR SELECT
TO authenticated
USING (
  public.can_read_project(project_id, auth.uid())
);

DROP POLICY IF EXISTS pm_write ON public.project_member;
CREATE POLICY pm_write
ON public.project_member
FOR ALL
TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.can_manage_project(project_id, auth.uid())
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.can_manage_project(project_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.users_visible_to(auth.uid()) visible
      WHERE visible.user_id = project_member.user_id
    )
  )
);