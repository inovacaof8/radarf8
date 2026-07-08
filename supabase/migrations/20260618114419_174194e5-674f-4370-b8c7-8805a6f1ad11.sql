
-- Função genérica de validação para tarefas/ações/to-dos
CREATE OR REPLACE FUNCTION public.enforce_task_assignee_and_due()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _assignee uuid;
  _due date;
  _old_due date;
  _is_admin boolean;
BEGIN
  -- Identifica colunas por tabela
  IF TG_TABLE_NAME = 'task' THEN
    _assignee := NEW.assignee_id;
    _due := NEW.end_date;
    IF TG_OP = 'UPDATE' THEN _old_due := OLD.end_date; END IF;
  ELSIF TG_TABLE_NAME = 'action_item' THEN
    _assignee := NEW.assignee_id;
    _due := NEW.due_date;
    IF TG_OP = 'UPDATE' THEN _old_due := OLD.due_date; END IF;
  ELSIF TG_TABLE_NAME = 'meeting_action_item' THEN
    _assignee := NEW.assignee_id;
    _due := NEW.due_date;
    IF TG_OP = 'UPDATE' THEN _old_due := OLD.due_date; END IF;
  END IF;

  IF _assignee IS NULL THEN
    RAISE EXCEPTION 'É obrigatório informar um responsável (usuário cadastrado da empresa).'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _assignee AND status = 'active') THEN
    RAISE EXCEPTION 'O responsável deve ser um usuário ativo cadastrado no sistema.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF _due IS NULL THEN
    RAISE EXCEPTION 'É obrigatório informar o prazo (data de término/entrega).'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Restrição de alteração de prazo: apenas administradores
  IF TG_OP = 'UPDATE'
     AND _old_due IS NOT NULL
     AND _due IS DISTINCT FROM _old_due THEN
    _is_admin := public.has_role(auth.uid(), 'Administrador');
    IF NOT _is_admin THEN
      RAISE EXCEPTION 'Somente administradores podem alterar prazos já definidos.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- Triggers em cada tabela
DROP TRIGGER IF EXISTS trg_task_enforce_rules ON public.task;
CREATE TRIGGER trg_task_enforce_rules
  BEFORE INSERT OR UPDATE ON public.task
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_assignee_and_due();

DROP TRIGGER IF EXISTS trg_action_item_enforce_rules ON public.action_item;
CREATE TRIGGER trg_action_item_enforce_rules
  BEFORE INSERT OR UPDATE ON public.action_item
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_assignee_and_due();

DROP TRIGGER IF EXISTS trg_mai_enforce_rules ON public.meeting_action_item;
CREATE TRIGGER trg_mai_enforce_rules
  BEFORE INSERT OR UPDATE ON public.meeting_action_item
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_assignee_and_due();
