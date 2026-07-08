ALTER TABLE public.task ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_task_order ON public.task(project_id, deliverable_id, order_index);