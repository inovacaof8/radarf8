-- =========================================================
-- Macro entregas, ajustes em task e task_dependency
-- =========================================================

-- 1) PROJECT_DELIVERABLE (macro entregas)
CREATE TABLE IF NOT EXISTS public.project_deliverable (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  owner_id     uuid,
  start_date   date,
  end_date     date,
  status       text NOT NULL DEFAULT 'not_started',
  progress     integer NOT NULL DEFAULT 0,
  order_index  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pd_progress_range CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT pd_status_chk CHECK (status IN ('not_started','in_progress','blocked','done','cancelled')),
  CONSTRAINT pd_dates_chk  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE INDEX IF NOT EXISTS idx_pd_project ON public.project_deliverable(project_id);

ALTER TABLE public.project_deliverable ENABLE ROW LEVEL SECURITY;

CREATE POLICY pd_read ON public.project_deliverable
  FOR SELECT USING (public.can_read_project(project_id, auth.uid()));

CREATE POLICY pd_write ON public.project_deliverable
  FOR ALL
  USING (public.can_manage_project(project_id, auth.uid()))
  WITH CHECK (public.can_manage_project(project_id, auth.uid()));

CREATE TRIGGER pd_set_updated_at
  BEFORE UPDATE ON public.project_deliverable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) TASK: adicionar campos novos preservando os existentes
ALTER TABLE public.task
  ADD COLUMN IF NOT EXISTS deliverable_id uuid REFERENCES public.project_deliverable(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS baseline_start_date date,
  ADD COLUMN IF NOT EXISTS baseline_end_date date;

-- Backfill: title := name onde estiver vazio
UPDATE public.task SET title = name WHERE title IS NULL;

-- Manter title sincronizado com name (compat com código antigo que ainda usa "name")
CREATE OR REPLACE FUNCTION public.task_sync_title_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.title IS NULL AND NEW.name IS NOT NULL THEN
    NEW.title := NEW.name;
  ELSIF NEW.name IS NULL AND NEW.title IS NOT NULL THEN
    NEW.name := NEW.title;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title AND NEW.name = OLD.name THEN
      NEW.name := NEW.title;
    ELSIF NEW.name IS DISTINCT FROM OLD.name AND NEW.title = OLD.title THEN
      NEW.title := NEW.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_sync_title_name_trg ON public.task;
CREATE TRIGGER task_sync_title_name_trg
  BEFORE INSERT OR UPDATE ON public.task
  FOR EACH ROW EXECUTE FUNCTION public.task_sync_title_name();

CREATE INDEX IF NOT EXISTS idx_task_deliverable ON public.task(deliverable_id);


-- 3) TASK_DEPENDENCY: adicionar project_id + UNIQUE + check self
ALTER TABLE public.task_dependency
  ADD COLUMN IF NOT EXISTS project_id uuid;

-- Backfill project_id a partir da predecessora
UPDATE public.task_dependency td
SET project_id = t.project_id
FROM public.task t
WHERE td.predecessor_id = t.id AND td.project_id IS NULL;

ALTER TABLE public.task_dependency
  ALTER COLUMN project_id SET NOT NULL;

-- Impede self-dependency
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'td_no_self'
  ) THEN
    ALTER TABLE public.task_dependency
      ADD CONSTRAINT td_no_self CHECK (predecessor_id <> successor_id);
  END IF;
END $$;

-- Impede duplicidade
CREATE UNIQUE INDEX IF NOT EXISTS uq_td_pair
  ON public.task_dependency(predecessor_id, successor_id);

-- Trigger anti ciclo simples (A->B impede B->A) e same project
CREATE OR REPLACE FUNCTION public.task_dependency_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pred_proj uuid;
  succ_proj uuid;
BEGIN
  SELECT project_id INTO pred_proj FROM public.task WHERE id = NEW.predecessor_id;
  SELECT project_id INTO succ_proj FROM public.task WHERE id = NEW.successor_id;

  IF pred_proj IS NULL OR succ_proj IS NULL OR pred_proj <> succ_proj THEN
    RAISE EXCEPTION 'Tarefas devem pertencer ao mesmo projeto';
  END IF;

  NEW.project_id := pred_proj;

  -- ciclo simples: já existe dependência inversa?
  IF EXISTS (
    SELECT 1 FROM public.task_dependency
    WHERE predecessor_id = NEW.successor_id
      AND successor_id   = NEW.predecessor_id
  ) THEN
    RAISE EXCEPTION 'Dependência circular não permitida';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_dependency_validate_trg ON public.task_dependency;
CREATE TRIGGER task_dependency_validate_trg
  BEFORE INSERT OR UPDATE ON public.task_dependency
  FOR EACH ROW EXECUTE FUNCTION public.task_dependency_validate();


-- 4) Função utilitária: ao definir manager_id, garantir membro
CREATE OR REPLACE FUNCTION public.ensure_manager_is_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.manager_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.manager_id IS DISTINCT FROM OLD.manager_id) THEN
    INSERT INTO public.project_member (project_id, user_id, role_in_project)
    VALUES (NEW.id, NEW.manager_id, 'líder do projeto')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_ensure_manager_member ON public.project;
CREATE TRIGGER project_ensure_manager_member
  AFTER INSERT OR UPDATE OF manager_id ON public.project
  FOR EACH ROW EXECUTE FUNCTION public.ensure_manager_is_member();

-- Garante PK lógica em project_member para o ON CONFLICT acima
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='uq_project_member_pair'
  ) THEN
    CREATE UNIQUE INDEX uq_project_member_pair
      ON public.project_member(project_id, user_id);
  END IF;
END $$;
