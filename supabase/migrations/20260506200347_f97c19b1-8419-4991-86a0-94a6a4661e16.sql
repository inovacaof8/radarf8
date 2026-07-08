
-- Função security definer para checar ACL sem disparar RLS recursiva
CREATE OR REPLACE FUNCTION public.has_document_acl(_doc_id uuid, _user_id uuid, _perms text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_acl
    WHERE document_id = _doc_id
      AND user_id = _user_id
      AND permission = ANY(_perms)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_document_creator(_doc_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.document WHERE id = _doc_id AND created_by = _user_id)
$$;

-- Recriar policies de document
DROP POLICY IF EXISTS document_read ON public.document;
DROP POLICY IF EXISTS document_update ON public.document;
DROP POLICY IF EXISTS document_delete ON public.document;

CREATE POLICY document_read ON public.document FOR SELECT
USING (
  is_admin_or_pmo(auth.uid())
  OR created_by = auth.uid()
  OR has_document_acl(id, auth.uid(), ARRAY['read','edit','admin'])
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM project_member pm WHERE pm.project_id = document.project_id AND pm.user_id = auth.uid()
  ))
  OR (project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM project p WHERE p.id = document.project_id AND p.manager_id = auth.uid()
  ))
);

CREATE POLICY document_update ON public.document FOR UPDATE
USING (
  is_admin_or_pmo(auth.uid())
  OR created_by = auth.uid()
  OR has_document_acl(id, auth.uid(), ARRAY['edit','admin'])
)
WITH CHECK (
  is_admin_or_pmo(auth.uid())
  OR created_by = auth.uid()
  OR has_document_acl(id, auth.uid(), ARRAY['edit','admin'])
);

CREATE POLICY document_delete ON public.document FOR DELETE
USING (
  is_admin_or_pmo(auth.uid())
  OR created_by = auth.uid()
  OR has_document_acl(id, auth.uid(), ARRAY['admin'])
);

-- Recriar policies de document_acl sem referenciar document diretamente
DROP POLICY IF EXISTS dacl_read ON public.document_acl;
DROP POLICY IF EXISTS dacl_write ON public.document_acl;

CREATE POLICY dacl_read ON public.document_acl FOR SELECT
USING (
  is_admin_or_pmo(auth.uid())
  OR user_id = auth.uid()
  OR is_document_creator(document_id, auth.uid())
);

CREATE POLICY dacl_write ON public.document_acl FOR ALL
USING (
  is_admin_or_pmo(auth.uid())
  OR is_document_creator(document_id, auth.uid())
  OR has_document_acl(document_id, auth.uid(), ARRAY['admin'])
)
WITH CHECK (
  is_admin_or_pmo(auth.uid())
  OR is_document_creator(document_id, auth.uid())
  OR has_document_acl(document_id, auth.uid(), ARRAY['admin'])
);
