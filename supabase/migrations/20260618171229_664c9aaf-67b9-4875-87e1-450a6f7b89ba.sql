-- ============ TAREFAS ============
CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  descricao text,
  data date NOT NULL,
  hora time,
  duracao_min integer,
  prioridade text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'pendente',
  origem text NOT NULL DEFAULT 'manual',
  origem_id uuid,
  anotacoes text,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tarefas_user_data ON public.tarefas(user_id, data);
CREATE INDEX idx_tarefas_status ON public.tarefas(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tarefas_select ON public.tarefas FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY tarefas_insert ON public.tarefas FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY tarefas_update ON public.tarefas FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY tarefas_delete ON public.tarefas FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_tarefas_updated_at
BEFORE UPDATE ON public.tarefas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FAB DRAWINGS (Notas) ============
CREATE TABLE public.fab_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  texto_extraido text,
  processado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fab_drawings_user ON public.fab_drawings(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fab_drawings TO authenticated;
GRANT ALL ON public.fab_drawings TO service_role;

ALTER TABLE public.fab_drawings ENABLE ROW LEVEL SECURITY;

CREATE POLICY fab_drawings_select ON public.fab_drawings FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY fab_drawings_insert ON public.fab_drawings FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY fab_drawings_update ON public.fab_drawings FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY fab_drawings_delete ON public.fab_drawings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_fab_drawings_updated_at
BEFORE UPDATE ON public.fab_drawings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();