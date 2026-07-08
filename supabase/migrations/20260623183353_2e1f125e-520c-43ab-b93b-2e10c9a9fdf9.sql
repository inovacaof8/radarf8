CREATE OR REPLACE FUNCTION public.can_write_document(_doc_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.document d
        WHERE d.id = _doc_id
          AND d.created_by = _user_id
          AND public.has_module_perm(_user_id, 'documents', ARRAY['create','edit','admin'])
      )
      OR EXISTS (
        SELECT 1
        FROM public.document_acl a
        WHERE a.document_id = _doc_id
          AND a.user_id = _user_id
          AND a.permission = ANY (ARRAY['edit','admin'])
      )
      OR EXISTS (
        SELECT 1
        FROM public.document d
        WHERE d.id = _doc_id
          AND public.has_module_perm(_user_id, 'documents', ARRAY['edit','admin'])
          AND (
            (d.project_id IS NOT NULL AND public.can_read_project(d.project_id, _user_id))
            OR (d.program_id IS NOT NULL AND public.can_read_program(d.program_id, _user_id))
            OR (d.portfolio_id IS NOT NULL AND public.can_read_portfolio(d.portfolio_id, _user_id))
          )
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_write_document(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_document(uuid, uuid) TO service_role;