
-- 1) Mark tarefa as viewed when recipient concludes it
CREATE OR REPLACE FUNCTION public.tarefas_mark_viewed_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'concluida'
     AND (OLD.status IS DISTINCT FROM 'concluida')
     AND NEW.created_by IS NOT NULL
     AND NEW.created_by <> NEW.user_id
     AND NEW.first_viewed_at IS NULL THEN
    NEW.first_viewed_at := now();
    NEW.last_viewed_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tarefas_mark_viewed_on_complete ON public.tarefas;
CREATE TRIGGER trg_tarefas_mark_viewed_on_complete
BEFORE UPDATE ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.tarefas_mark_viewed_on_complete();

-- 2) Propagate notification "viewed" to the linked tarefa
CREATE OR REPLACE FUNCTION public.notif_recipient_propagate_view_to_tarefa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_type = 'tarefa'
     AND NEW.source_id IS NOT NULL
     AND NEW.first_viewed_at IS NOT NULL
     AND (OLD.first_viewed_at IS NULL OR OLD.first_viewed_at IS DISTINCT FROM NEW.first_viewed_at) THEN
    UPDATE public.tarefas
       SET first_viewed_at = COALESCE(first_viewed_at, NEW.first_viewed_at),
           last_viewed_at = NEW.last_viewed_at
     WHERE id = NEW.source_id
       AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notif_recipient_propagate_view_to_tarefa ON public.notification_recipient;
CREATE TRIGGER trg_notif_recipient_propagate_view_to_tarefa
AFTER UPDATE ON public.notification_recipient
FOR EACH ROW EXECUTE FUNCTION public.notif_recipient_propagate_view_to_tarefa();
