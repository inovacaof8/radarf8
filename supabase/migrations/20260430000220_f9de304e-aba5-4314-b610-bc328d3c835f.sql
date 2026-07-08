-- =========================================
-- MÓDULO REUNIÕES
-- =========================================

-- 1. Tabela meeting
CREATE TABLE public.meeting (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  agenda TEXT,
  location TEXT,
  modality TEXT NOT NULL DEFAULT 'online', -- presencial | online | hibrida
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'agendada', -- agendada | realizada | cancelada
  organizer_id UUID,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  portfolio_id UUID REFERENCES public.portfolio(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.program(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.project(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_project ON public.meeting(project_id);
CREATE INDEX idx_meeting_program ON public.meeting(program_id);
CREATE INDEX idx_meeting_portfolio ON public.meeting(portfolio_id);
CREATE INDEX idx_meeting_created_by ON public.meeting(created_by);
CREATE INDEX idx_meeting_scheduled_at ON public.meeting(scheduled_at DESC);

-- 2. Participantes
CREATE TABLE public.meeting_participant (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meeting(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role_in_meeting TEXT NOT NULL DEFAULT 'participante', -- organizador | participante | convidado
  attended BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, user_id)
);

CREATE INDEX idx_meeting_participant_user ON public.meeting_participant(user_id);
CREATE INDEX idx_meeting_participant_meeting ON public.meeting_participant(meeting_id);

-- 3. Ata
CREATE TABLE public.meeting_minute (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL UNIQUE REFERENCES public.meeting(id) ON DELETE CASCADE,
  raw_input TEXT,
  generation_mode TEXT NOT NULL DEFAULT 'transcricao', -- transcricao | bullets | audio
  formatted_content TEXT,
  ai_model TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | publicada
  generated_at TIMESTAMPTZ,
  generated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Action items (atividades da ata)
CREATE TABLE public.meeting_action_item (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meeting(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID,
  assignee_email_hint TEXT, -- preenchido pela IA quando não consegue mapear o usuário
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'media', -- baixa | media | alta
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | em_andamento | concluida | cancelada
  promoted_to_task_id UUID REFERENCES public.task(id) ON DELETE SET NULL,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mai_meeting ON public.meeting_action_item(meeting_id);
CREATE INDEX idx_mai_assignee ON public.meeting_action_item(assignee_id);
CREATE INDEX idx_mai_due_date ON public.meeting_action_item(due_date);

-- =========================================
-- TRIGGERS updated_at
-- =========================================
CREATE TRIGGER trg_meeting_updated_at BEFORE UPDATE ON public.meeting
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_meeting_minute_updated_at BEFORE UPDATE ON public.meeting_minute
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mai_updated_at BEFORE UPDATE ON public.meeting_action_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- HELPER FUNCTION: pode ler reunião?
-- =========================================
CREATE OR REPLACE FUNCTION public.can_read_meeting(_meeting_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.meeting m
      WHERE m.id = _meeting_id
        AND (
          m.created_by = _user_id
          OR m.organizer_id = _user_id
          OR (m.project_id IS NOT NULL AND public.can_read_project(m.project_id, _user_id))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participant mp
      WHERE mp.meeting_id = _meeting_id AND mp.user_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_meeting(_meeting_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.meeting m
      WHERE m.id = _meeting_id
        AND (m.created_by = _user_id OR m.organizer_id = _user_id)
    );
$$;

-- =========================================
-- RLS
-- =========================================
ALTER TABLE public.meeting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minute ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_item ENABLE ROW LEVEL SECURITY;

-- meeting
CREATE POLICY meeting_read ON public.meeting FOR SELECT
  USING (public.can_read_meeting(id, auth.uid()));

CREATE POLICY meeting_insert ON public.meeting FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY meeting_update ON public.meeting FOR UPDATE
  USING (public.can_manage_meeting(id, auth.uid()))
  WITH CHECK (public.can_manage_meeting(id, auth.uid()));

CREATE POLICY meeting_delete ON public.meeting FOR DELETE
  USING (public.can_manage_meeting(id, auth.uid()));

-- meeting_participant
CREATE POLICY mp_read ON public.meeting_participant FOR SELECT
  USING (public.can_read_meeting(meeting_id, auth.uid()));

CREATE POLICY mp_write ON public.meeting_participant FOR ALL
  USING (public.can_manage_meeting(meeting_id, auth.uid()))
  WITH CHECK (public.can_manage_meeting(meeting_id, auth.uid()));

-- meeting_minute
CREATE POLICY mm_read ON public.meeting_minute FOR SELECT
  USING (public.can_read_meeting(meeting_id, auth.uid()));

CREATE POLICY mm_write ON public.meeting_minute FOR ALL
  USING (public.can_manage_meeting(meeting_id, auth.uid()))
  WITH CHECK (public.can_manage_meeting(meeting_id, auth.uid()));

-- meeting_action_item
CREATE POLICY mai_read ON public.meeting_action_item FOR SELECT
  USING (
    public.can_read_meeting(meeting_id, auth.uid())
    OR assignee_id = auth.uid()
  );

CREATE POLICY mai_insert ON public.meeting_action_item FOR INSERT
  WITH CHECK (public.can_manage_meeting(meeting_id, auth.uid()));

CREATE POLICY mai_update ON public.meeting_action_item FOR UPDATE
  USING (
    public.can_manage_meeting(meeting_id, auth.uid())
    OR assignee_id = auth.uid()
  )
  WITH CHECK (
    public.can_manage_meeting(meeting_id, auth.uid())
    OR assignee_id = auth.uid()
  );

CREATE POLICY mai_delete ON public.meeting_action_item FOR DELETE
  USING (public.can_manage_meeting(meeting_id, auth.uid()));

-- =========================================
-- Cadastro do módulo
-- =========================================
INSERT INTO public.modules (name, slug, description, icon, is_active)
VALUES ('Reuniões', 'meetings', 'Gestão de reuniões com atas geradas por IA e acompanhamento de atividades', 'CalendarCheck', true)
ON CONFLICT DO NOTHING;