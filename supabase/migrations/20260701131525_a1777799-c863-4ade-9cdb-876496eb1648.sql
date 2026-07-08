CREATE TABLE public.workflow_demand_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.workflow_demands(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.workflow_demand_attachment TO authenticated;
GRANT ALL ON public.workflow_demand_attachment TO service_role;
ALTER TABLE public.workflow_demand_attachment ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_workflow_demand(_demand_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_admin_or_pmo(_uid) OR public.is_global_reader(_uid) OR EXISTS (
    SELECT 1 FROM public.workflow_demands d
    WHERE d.id = _demand_id
      AND (d.created_by = _uid OR d.current_responsible_id = _uid OR d.current_approver_id = _uid)
  );
$$;

CREATE POLICY wda_select ON public.workflow_demand_attachment FOR SELECT TO authenticated
USING (public.can_view_workflow_demand(demand_id, auth.uid()));

CREATE POLICY wda_insert ON public.workflow_demand_attachment FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.workflow_demands d WHERE d.id = demand_id AND d.created_by = auth.uid()
  )
);

CREATE POLICY wda_delete ON public.workflow_demand_attachment FOR DELETE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.workflow_demands d WHERE d.id = demand_id AND d.created_by = auth.uid()
  )
);

-- Storage policies for bucket 'workflow-demand-attachments'
-- Path convention: <demand_id>/<uuid>-<filename>
CREATE POLICY wda_storage_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'workflow-demand-attachments'
  AND public.can_view_workflow_demand((split_part(name, '/', 1))::uuid, auth.uid())
);

CREATE POLICY wda_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'workflow-demand-attachments'
  AND EXISTS (
    SELECT 1 FROM public.workflow_demands d
    WHERE d.id = (split_part(name, '/', 1))::uuid AND d.created_by = auth.uid()
  )
);

CREATE POLICY wda_storage_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'workflow-demand-attachments'
  AND (public.is_admin_or_pmo(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.workflow_demands d
    WHERE d.id = (split_part(name, '/', 1))::uuid AND d.created_by = auth.uid()
  ))
);