-- Tabela genérica de change log
CREATE TABLE IF NOT EXISTS public.change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_log_entity ON public.change_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_change_log_changed_at ON public.change_log(changed_at DESC);

ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS change_log_read ON public.change_log;
CREATE POLICY change_log_read ON public.change_log FOR SELECT USING (true);

DROP POLICY IF EXISTS change_log_insert ON public.change_log;
CREATE POLICY change_log_insert ON public.change_log FOR INSERT WITH CHECK (true);

-- Função genérica de log de mudança de status
CREATE OR REPLACE FUNCTION public.log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'status', OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers em project, document e task
DROP TRIGGER IF EXISTS trg_project_status_log ON public.project;
CREATE TRIGGER trg_project_status_log
  AFTER UPDATE ON public.project
  FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

DROP TRIGGER IF EXISTS trg_document_status_log ON public.document;
CREATE TRIGGER trg_document_status_log
  AFTER UPDATE ON public.document
  FOR EACH ROW EXECUTE FUNCTION public.log_status_change();

DROP TRIGGER IF EXISTS trg_task_status_log ON public.task;
CREATE TRIGGER trg_task_status_log
  AFTER UPDATE ON public.task
  FOR EACH ROW EXECUTE FUNCTION public.log_status_change();