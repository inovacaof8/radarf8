
-- =========================================================
-- FASE 2: NÚCLEO DE PLANOS DE AÇÃO
-- =========================================================

-- Sequência para código humano dos planos
CREATE SEQUENCE IF NOT EXISTS public.action_plan_code_seq START 1;

-- =========================================================
-- TABELA: action_plan
-- =========================================================
CREATE TABLE public.action_plan (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  justification TEXT,
  origin_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (origin_type IN ('manual','meeting','project','audit','risk','incident','other')),
  origin_id UUID,
  status TEXT NOT NULL DEFAULT 'Rascunho'
    CHECK (status IN ('Rascunho','Em andamento','Concluído','Cancelado','Suspenso','Reaberto')),
  priority TEXT NOT NULL DEFAULT 'Média'
    CHECK (priority IN ('Baixa','Média','Alta','Crítica')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_plan_origin ON public.action_plan(origin_type, origin_id);
CREATE INDEX idx_action_plan_owner ON public.action_plan(owner_id);
CREATE INDEX idx_action_plan_status ON public.action_plan(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plan TO authenticated;
GRANT ALL ON public.action_plan TO service_role;

ALTER TABLE public.action_plan ENABLE ROW LEVEL SECURITY;

-- Trigger updated_at
CREATE TRIGGER trg_action_plan_updated_at
  BEFORE UPDATE ON public.action_plan
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para gerar code automaticamente (PA-0001)
CREATE OR REPLACE FUNCTION public.action_plan_set_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'PA-' || LPAD(nextval('public.action_plan_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_action_plan_set_code
  BEFORE INSERT ON public.action_plan
  FOR EACH ROW EXECUTE FUNCTION public.action_plan_set_code();

-- =========================================================
-- TABELA: action_plan_area
-- =========================================================
CREATE TABLE public.action_plan_area (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id UUID NOT NULL REFERENCES public.action_plan(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.area(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (action_plan_id, area_id)
);

CREATE INDEX idx_action_plan_area_plan ON public.action_plan_area(action_plan_id);
CREATE INDEX idx_action_plan_area_area ON public.action_plan_area(area_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plan_area TO authenticated;
GRANT ALL ON public.action_plan_area TO service_role;

ALTER TABLE public.action_plan_area ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- TABELA: action_plan_member
-- =========================================================
CREATE TABLE public.action_plan_member (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id UUID NOT NULL REFERENCES public.action_plan(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_plan TEXT NOT NULL DEFAULT 'participant'
    CHECK (role_in_plan IN ('owner','participant','observer','validator','creator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (action_plan_id, user_id, role_in_plan)
);

CREATE INDEX idx_action_plan_member_plan ON public.action_plan_member(action_plan_id);
CREATE INDEX idx_action_plan_member_user ON public.action_plan_member(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plan_member TO authenticated;
GRANT ALL ON public.action_plan_member TO service_role;

ALTER TABLE public.action_plan_member ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SECURITY DEFINER HELPERS
-- =========================================================

-- Usuário tem algum papel no plano?
CREATE OR REPLACE FUNCTION public.is_action_plan_member(_plan_id uuid, _user_id uuid, _roles text[] DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.action_plan_member
    WHERE action_plan_id = _plan_id
      AND user_id = _user_id
      AND (_roles IS NULL OR role_in_plan = ANY(_roles))
  )
$$;

-- Gestor de alguma área vinculada ao plano?
CREATE OR REPLACE FUNCTION public.manages_action_plan_area(_plan_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.action_plan_area apa
    JOIN public.user_managed_areas(_user_id) uma ON uma.area_id = apa.area_id
    WHERE apa.action_plan_id = _plan_id
  )
$$;

-- Pode ler plano?
CREATE OR REPLACE FUNCTION public.can_read_action_plan(_plan_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.is_reader(_user_id)
    OR EXISTS (SELECT 1 FROM public.action_plan WHERE id = _plan_id AND (owner_id = _user_id OR created_by = _user_id))
    OR public.is_action_plan_member(_plan_id, _user_id, NULL)
    OR public.manages_action_plan_area(_plan_id, _user_id);
$$;

-- Pode editar plano?
CREATE OR REPLACE FUNCTION public.can_edit_action_plan(_plan_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (SELECT 1 FROM public.action_plan WHERE id = _plan_id AND (owner_id = _user_id OR created_by = _user_id))
    OR public.is_action_plan_member(_plan_id, _user_id, ARRAY['owner','validator','creator'])
    OR public.manages_action_plan_area(_plan_id, _user_id);
$$;

-- Pode excluir plano?
CREATE OR REPLACE FUNCTION public.can_delete_action_plan(_plan_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (SELECT 1 FROM public.action_plan WHERE id = _plan_id AND (owner_id = _user_id OR created_by = _user_id));
$$;

-- =========================================================
-- POLICIES: action_plan
-- =========================================================
CREATE POLICY "action_plan_select" ON public.action_plan
  FOR SELECT TO authenticated
  USING (public.can_read_action_plan(id, auth.uid()));

CREATE POLICY "action_plan_insert" ON public.action_plan
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by OR public.is_admin_or_pmo(auth.uid()));

CREATE POLICY "action_plan_update" ON public.action_plan
  FOR UPDATE TO authenticated
  USING (public.can_edit_action_plan(id, auth.uid()))
  WITH CHECK (public.can_edit_action_plan(id, auth.uid()));

CREATE POLICY "action_plan_delete" ON public.action_plan
  FOR DELETE TO authenticated
  USING (public.can_delete_action_plan(id, auth.uid()));

-- =========================================================
-- POLICIES: action_plan_area
-- =========================================================
CREATE POLICY "action_plan_area_select" ON public.action_plan_area
  FOR SELECT TO authenticated
  USING (public.can_read_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_plan_area_insert" ON public.action_plan_area
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_plan_area_update" ON public.action_plan_area
  FOR UPDATE TO authenticated
  USING (public.can_edit_action_plan(action_plan_id, auth.uid()))
  WITH CHECK (public.can_edit_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_plan_area_delete" ON public.action_plan_area
  FOR DELETE TO authenticated
  USING (public.can_edit_action_plan(action_plan_id, auth.uid()));

-- =========================================================
-- POLICIES: action_plan_member
-- =========================================================
CREATE POLICY "action_plan_member_select" ON public.action_plan_member
  FOR SELECT TO authenticated
  USING (public.can_read_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_plan_member_insert" ON public.action_plan_member
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_plan_member_update" ON public.action_plan_member
  FOR UPDATE TO authenticated
  USING (public.can_edit_action_plan(action_plan_id, auth.uid()))
  WITH CHECK (public.can_edit_action_plan(action_plan_id, auth.uid()));

CREATE POLICY "action_plan_member_delete" ON public.action_plan_member
  FOR DELETE TO authenticated
  USING (public.can_edit_action_plan(action_plan_id, auth.uid()));
