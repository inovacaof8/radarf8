DROP POLICY IF EXISTS document_read ON public.document;

CREATE POLICY document_read ON public.document
FOR SELECT TO authenticated
USING (
  public.is_active_user(auth.uid())
  AND (
    public.is_admin_or_pmo(auth.uid())
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.document_acl a
      WHERE a.document_id = document.id
        AND a.user_id = auth.uid()
        AND a.permission = ANY (ARRAY['read','edit','admin'])
    )
    OR (
      public.has_module_perm(auth.uid(), 'documents', ARRAY['view','edit','admin'])
      AND (
        (project_id IS NOT NULL AND public.can_read_project(project_id, auth.uid()))
        OR (program_id IS NOT NULL AND public.can_read_program(program_id, auth.uid()))
        OR (portfolio_id IS NOT NULL AND public.can_read_portfolio(portfolio_id, auth.uid()))
      )
    )
  )
);