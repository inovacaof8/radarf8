
-- 1) New columns on tarefas
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

-- Backfill: existing tasks are self-created
UPDATE public.tarefas SET created_by = user_id WHERE created_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_tarefas_created_by ON public.tarefas(created_by);

-- 2) Trigger to set created_by + assigned_at on insert
CREATE OR REPLACE FUNCTION public.tarefas_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.user_id);
  END IF;
  IF NEW.created_by IS DISTINCT FROM NEW.user_id AND NEW.assigned_at IS NULL THEN
    NEW.assigned_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tarefas_set_created_by ON public.tarefas;
CREATE TRIGGER trg_tarefas_set_created_by
  BEFORE INSERT ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tarefas_set_created_by();

-- 3) Authorization helper: can _granter assign tarefa to _recipient?
CREATE OR REPLACE FUNCTION public.can_assign_tarefa(_granter uuid, _recipient uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _granter = _recipient
    OR public.is_admin_or_pmo(_granter)
    OR (
      (
        public.has_role(_granter, 'Gestor')
        OR public.has_role(_granter, 'Diretor Geral')
      )
      AND EXISTS (
        SELECT 1 FROM public.users_visible_to(_granter) v
        WHERE v.user_id = _recipient
      )
    );
$$;

-- 4) Replace RLS policies
DROP POLICY IF EXISTS "tarefas_insert" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_select" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_update" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_delete" ON public.tarefas;

CREATE POLICY "tarefas_insert" ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_assign_tarefa(auth.uid(), user_id)
  );

CREATE POLICY "tarefas_select" ON public.tarefas
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = created_by
    OR public.is_admin_or_pmo(auth.uid())
  );

CREATE POLICY "tarefas_update" ON public.tarefas
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = created_by
    OR public.is_admin_or_pmo(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = created_by
    OR public.is_admin_or_pmo(auth.uid())
  );

CREATE POLICY "tarefas_delete" ON public.tarefas
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() = created_by
    OR public.is_admin_or_pmo(auth.uid())
  );

-- 5) Auto-create notification when a leader assigns a task to someone else
CREATE OR REPLACE FUNCTION public.tarefas_notify_recipient()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _notif_id uuid;
  _title text;
  _msg text;
BEGIN
  IF NEW.created_by IS NULL OR NEW.created_by = NEW.user_id THEN
    RETURN NEW;
  END IF;

  _title := 'Nova tarefa atribuída: ' || NEW.titulo;
  _msg := COALESCE(NEW.descricao, '')
    || E'\n\nData: ' || to_char(NEW.data, 'DD/MM/YYYY')
    || CASE WHEN NEW.hora IS NOT NULL THEN ' às ' || to_char(NEW.hora, 'HH24:MI') ELSE '' END
    || E'\nPrioridade: ' || NEW.prioridade;

  INSERT INTO public.notification(
    title, message, notification_type, priority, sender_user_id,
    status, sent_at, requires_acknowledgment, publication_date
  )
  VALUES (
    _title, _msg, 'atualizacao',
    CASE NEW.prioridade WHEN 'alta' THEN 'alta'::notification_priority
                       WHEN 'baixa' THEN 'baixa'::notification_priority
                       ELSE 'normal'::notification_priority END,
    NEW.created_by, 'enviada', now(), false, now()
  )
  RETURNING id INTO _notif_id;

  INSERT INTO public.notification_recipient(
    notification_id, user_id, source_type, source_id,
    delivery_status, delivered_at, acknowledgment_status
  )
  VALUES (
    _notif_id, NEW.user_id, 'tarefa', NEW.id,
    'entregue', now(), 'nao_lida'
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tarefas_notify_recipient ON public.tarefas;
CREATE TRIGGER trg_tarefas_notify_recipient
  AFTER INSERT ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tarefas_notify_recipient();
