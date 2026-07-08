
-- 1. observations field on task
ALTER TABLE public.task ADD COLUMN IF NOT EXISTS observations text;

-- 2. Allow assignee to update their own task (row-level); trigger restricts columns
DROP POLICY IF EXISTS task_assignee_update ON public.task;
CREATE POLICY task_assignee_update ON public.task
  FOR UPDATE
  USING (assignee_id = auth.uid() AND public.is_active_user(auth.uid()))
  WITH CHECK (assignee_id = auth.uid() AND public.is_active_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.task_assignee_column_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_manager boolean;
BEGIN
  IF auth.uid() IS NULL OR NEW.assignee_id IS DISTINCT FROM auth.uid() THEN
    RETURN NEW;
  END IF;
  SELECT public.can_edit_project(NEW.project_id, auth.uid())
      OR public.has_module_perm(auth.uid(), 'tasks', ARRAY['edit','admin'])
    INTO _is_manager;
  IF _is_manager THEN
    RETURN NEW;
  END IF;
  -- Assignee-only: can change observations, progress, status
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.deliverable_id IS DISTINCT FROM OLD.deliverable_id
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.start_date IS DISTINCT FROM OLD.start_date
     OR NEW.end_date IS DISTINCT FROM OLD.end_date
     OR NEW.baseline_start_date IS DISTINCT FROM OLD.baseline_start_date
     OR NEW.baseline_end_date IS DISTINCT FROM OLD.baseline_end_date
     OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
     OR NEW.assignee_external_name IS DISTINCT FROM OLD.assignee_external_name
     OR NEW.project_id IS DISTINCT FROM OLD.project_id
     OR NEW.order_index IS DISTINCT FROM OLD.order_index THEN
    RAISE EXCEPTION 'Responsável só pode alterar observações, progresso e status.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_task_assignee_column_guard ON public.task;
CREATE TRIGGER trg_task_assignee_column_guard
  BEFORE UPDATE ON public.task
  FOR EACH ROW EXECUTE FUNCTION public.task_assignee_column_guard();

-- 3. task_attachment table
CREATE TABLE IF NOT EXISTS public.task_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.task(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL UNIQUE,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_attachment_task ON public.task_attachment(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachment TO authenticated;
GRANT ALL ON public.task_attachment TO service_role;

ALTER TABLE public.task_attachment ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_task_attachment(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task t
    WHERE t.id = _task_id
      AND (
        public.can_edit_project(t.project_id, _user_id)
        OR public.has_module_perm(_user_id, 'tasks', ARRAY['edit','admin'])
        OR t.assignee_id = _user_id
      )
  );
$$;

CREATE POLICY task_attachment_read ON public.task_attachment
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.task t WHERE t.id = task_id AND public.can_read_project(t.project_id, auth.uid()))
  );

CREATE POLICY task_attachment_insert ON public.task_attachment
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_manage_task_attachment(task_id, auth.uid())
  );

CREATE POLICY task_attachment_delete ON public.task_attachment
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.task t WHERE t.id = task_id AND (
      public.can_edit_project(t.project_id, auth.uid())
      OR public.is_admin_or_pmo(auth.uid())
    ))
  );

-- 4. Storage policies for bucket 'task-attachments' (path layout: <task_id>/<filename>)
DROP POLICY IF EXISTS task_att_read ON storage.objects;
CREATE POLICY task_att_read ON storage.objects FOR SELECT USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.task t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND public.can_read_project(t.project_id, auth.uid())
  )
);

DROP POLICY IF EXISTS task_att_insert ON storage.objects;
CREATE POLICY task_att_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'task-attachments'
  AND auth.uid() = owner
  AND EXISTS (
    SELECT 1 FROM public.task t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND public.can_manage_task_attachment(t.id, auth.uid())
  )
);

DROP POLICY IF EXISTS task_att_delete ON storage.objects;
CREATE POLICY task_att_delete ON storage.objects FOR DELETE USING (
  bucket_id = 'task-attachments'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.task t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (public.can_edit_project(t.project_id, auth.uid()) OR public.is_admin_or_pmo(auth.uid()))
    )
  )
);
