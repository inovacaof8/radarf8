CREATE OR REPLACE FUNCTION public.enforce_task_assignee_and_due()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _assignee uuid;
  _due date;
  _old_due date;
  _is_admin boolean;
  _external text;
BEGIN
  -- Ignora validação quando o update vem em cascata de outro trigger
  -- (ex.: normalize_external_assignees_from_profile ao criar um profile)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'task' THEN
    _assignee := NEW.assignee_id;
    _due := NEW.end_date;
    _external := NEW.assignee_external_name;
    IF TG_OP = 'UPDATE' THEN _old_due := OLD.end_date; END IF;
  ELSIF TG_TABLE_NAME = 'action_item' THEN
    _assignee := NEW.assignee_id;
    _due := NEW.due_date;
    IF TG_OP = 'UPDATE' THEN _old_due := OLD.due_date; END IF;
  ELSIF TG_TABLE_NAME = 'meeting_action_item' THEN
    _assignee := NEW.assignee_id;
    _due := NEW.due_date;
    _external := NEW.assignee_external_name;
    IF TG_OP = 'UPDATE' THEN _old_due := OLD.due_date; END IF;
  END IF;

  IF _assignee IS NULL AND _external IS NOT NULL AND length(trim(_external)) > 0 THEN
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
END $function$;