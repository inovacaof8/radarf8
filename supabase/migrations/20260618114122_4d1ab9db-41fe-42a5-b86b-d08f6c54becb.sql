
CREATE SEQUENCE IF NOT EXISTS public.action_item_code_seq START 1;

CREATE TABLE public.action_item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id UUID NOT NULL REFERENCES public.action_plan(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_external_name TEXT,
  what TEXT,
  why TEXT,
  where_loc TEXT,
  how TEXT,
  how_much NUMERIC,
  priority TEXT NOT NULL DEFAULT 'Média'
    CHECK (priority IN ('Baixa','Média','Alta','Crítica')),
  status TEXT NOT NULL DEFAULT 'Pendente'
    CHECK (status IN ('Pendente','Em andamento','Concluída','Cancelada','Bloqueada','Atrasada')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  planned_start_date DATE,
  due_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_item_plan ON public.action_item(action_plan_id);
CREATE INDEX idx_action_item_assignee ON public.action_item(assignee_id);
CREATE INDEX idx_action_item_status ON public.action_item(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_item TO authenticated;
GRANT ALL ON public.action_item TO service_role;

ALTER TABLE public.action_item ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_action_item_updated_at
  BEFORE UPDATE ON public.action_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Code automático AI-0001
CREATE OR REPLACE FUNCTION public.action_item_set_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'AI-' || LPAD(nextval('public.action_item_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_action_item_set_code
  BEFORE INSERT ON public.action_item
  FOR EACH ROW EXECUTE FUNCTION public.action_item_set_code();

-- Recalcula progresso do plano com base nas ações
CREATE OR REPLACE FUNCTION public.action_plan_recalc_progress(_plan_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _avg NUMERIC;
BEGIN
  SELECT AVG(progress) INTO _avg
  FROM public.action_item
  WHERE action_plan_id = _plan_id AND status <> 'Cancelada';

  UPDATE public.action_plan
  SET progress = COALESCE(ROUND(_avg)::int, 0)
  WHERE id = _plan_id;
END $$;

CREATE OR REPLACE FUNCTION public.action_item_after_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.action_plan_recalc_progress(OLD.action_plan_id);
    RETURN OLD;
  ELSE
    PERFORM public.action_plan_recalc_progress(NEW.action_plan_id);
    RETURN NEW;
  END IF;
END $$;

CREATE TRIGGER trg_action_item_recalc
  AFTER INSERT OR UPDATE OF progress, status, action_plan_id OR DELETE ON public.action_item
  FOR EACH ROW EXECUTE FUNCTION public.action_item_after_change();

-- Policies
CREATE POLICY "action_item_select" ON public.action_item
  FOR SELECT TO authenticated
  USING (public.can_read_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_item_insert" ON public.action_item
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_item_update" ON public.action_item
  FOR UPDATE TO authenticated
  USING (public.can_edit_action_plan(action_plan_id, auth.uid()))
  WITH CHECK (public.can_edit_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_item_delete" ON public.action_item
  FOR DELETE TO authenticated
  USING (public.can_edit_action_plan(action_plan_id, auth.uid()));
