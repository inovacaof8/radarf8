
-- 1) Relaxa a trigger só quando assignee_external_name está preenchido
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

  -- Exceção: permite tarefa sem assignee_id e sem prazo quando há responsável externo
  IF _assignee IS NULL AND _external IS NOT NULL AND length(trim(_external)) > 0 THEN
    -- Se mexer no prazo depois, ainda só admin pode alterar
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

-- 2) Função utilitária: normaliza string (lower + sem acento) e retorna primeiro nome
CREATE OR REPLACE FUNCTION public.first_name_key(_full text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $$
  SELECT lower(translate(
    split_part(coalesce(trim(_full), ''), ' ', 1),
    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
  ));
$$;

-- 3) Trigger no profiles: quando um profile ativo é criado/ativado,
--    busca tarefas com assignee_external_name cujo primeiro nome bate com o primeiro nome do profile
CREATE OR REPLACE FUNCTION public.normalize_external_assignees_from_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _key text;
BEGIN
  IF NEW.status <> 'active' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  _key := public.first_name_key(NEW.name);
  IF _key IS NULL OR _key = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.task
    SET assignee_id = NEW.user_id,
        assignee_external_name = NULL
    WHERE assignee_id IS NULL
      AND assignee_external_name IS NOT NULL
      AND public.first_name_key(assignee_external_name) = _key;

  UPDATE public.meeting_action_item
    SET assignee_id = NEW.user_id,
        assignee_external_name = NULL
    WHERE assignee_id IS NULL
      AND assignee_external_name IS NOT NULL
      AND public.first_name_key(assignee_external_name) = _key;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_normalize_external_assignees ON public.profiles;
CREATE TRIGGER trg_normalize_external_assignees
  AFTER INSERT OR UPDATE OF status, name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_external_assignees_from_profile();
