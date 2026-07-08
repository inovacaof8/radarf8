
-- =========================================================
-- FASE 1: ÁREAS, VÍNCULOS DE USUÁRIO E GESTORES
-- =========================================================

-- 1) ENUMs
DO $$ BEGIN
  CREATE TYPE public.area_status AS ENUM ('active','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_type AS ENUM ('primary','additional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.manager_type AS ENUM ('principal','substitute','support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) TABLE area
CREATE TABLE IF NOT EXISTS public.area (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  acronym TEXT,
  description TEXT,
  parent_area_id UUID REFERENCES public.area(id) ON DELETE RESTRICT,
  status public.area_status NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT area_not_self_parent CHECK (parent_area_id IS NULL OR parent_area_id <> id)
);
CREATE INDEX IF NOT EXISTS idx_area_parent ON public.area(parent_area_id);
CREATE INDEX IF NOT EXISTS idx_area_status ON public.area(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_area_name_per_parent
  ON public.area(lower(name), COALESCE(parent_area_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.area TO authenticated;
GRANT ALL ON public.area TO service_role;
ALTER TABLE public.area ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_area_updated_at BEFORE UPDATE ON public.area
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Função: descendentes (recursiva)
CREATE OR REPLACE FUNCTION public.area_descendants(_area_id UUID)
RETURNS TABLE(id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE t AS (
    SELECT a.id FROM public.area a WHERE a.id = _area_id
    UNION ALL
    SELECT a.id FROM public.area a JOIN t ON a.parent_area_id = t.id
  )
  SELECT id FROM t;
$$;

-- 4) Trigger: impedir ciclo na hierarquia
CREATE OR REPLACE FUNCTION public.area_prevent_cycle()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_area_id IS NOT NULL THEN
    IF NEW.parent_area_id = NEW.id THEN
      RAISE EXCEPTION 'Uma área não pode ser superior de si mesma';
    END IF;
    IF EXISTS (SELECT 1 FROM public.area_descendants(NEW.id) d WHERE d.id = NEW.parent_area_id) THEN
      RAISE EXCEPTION 'A área superior não pode ser uma área descendente';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_area_prevent_cycle
  BEFORE INSERT OR UPDATE OF parent_area_id ON public.area
  FOR EACH ROW EXECUTE FUNCTION public.area_prevent_cycle();

-- 5) TABLE user_area_membership
CREATE TABLE IF NOT EXISTS public.user_area_membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.area(id) ON DELETE RESTRICT,
  membership_type public.membership_type NOT NULL DEFAULT 'additional',
  purpose TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status public.area_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT uam_dates_valid CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_uam_user ON public.user_area_membership(user_id);
CREATE INDEX IF NOT EXISTS idx_uam_area ON public.user_area_membership(area_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_uam_one_primary_active
  ON public.user_area_membership(user_id)
  WHERE membership_type = 'primary' AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_uam_no_duplicate_active
  ON public.user_area_membership(user_id, area_id, membership_type)
  WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_area_membership TO authenticated;
GRANT ALL ON public.user_area_membership TO service_role;
ALTER TABLE public.user_area_membership ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_uam_updated_at BEFORE UPDATE ON public.user_area_membership
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) TABLE area_manager
CREATE TABLE IF NOT EXISTS public.area_manager (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES public.area(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_type public.manager_type NOT NULL DEFAULT 'principal',
  include_child_areas BOOLEAN NOT NULL DEFAULT TRUE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status public.area_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT am_dates_valid CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_am_area ON public.area_manager(area_id);
CREATE INDEX IF NOT EXISTS idx_am_user ON public.area_manager(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_am_no_dup_active
  ON public.area_manager(area_id, user_id, manager_type)
  WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.area_manager TO authenticated;
GRANT ALL ON public.area_manager TO service_role;
ALTER TABLE public.area_manager ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_am_updated_at BEFORE UPDATE ON public.area_manager
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Helper: áreas geridas por um usuário (considera abrangência sobre subordinadas)
CREATE OR REPLACE FUNCTION public.user_managed_areas(_user_id UUID)
RETURNS TABLE(area_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT d.id AS area_id
  FROM public.area_manager am
  CROSS JOIN LATERAL (
    SELECT a.id FROM public.area a WHERE a.id = am.area_id
    UNION
    SELECT d2.id FROM public.area_descendants(am.area_id) d2
    WHERE am.include_child_areas = TRUE
  ) d
  WHERE am.user_id = _user_id
    AND am.status = 'active'
    AND am.start_date <= CURRENT_DATE
    AND (am.end_date IS NULL OR am.end_date >= CURRENT_DATE);
$$;

CREATE OR REPLACE FUNCTION public.user_manages_area(_user_id UUID, _area_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_managed_areas(_user_id) WHERE area_id = _area_id);
$$;

-- 8) Helper: áreas visíveis (geridas + onde o usuário tem vínculo)
CREATE OR REPLACE FUNCTION public.user_visible_areas(_user_id UUID)
RETURNS TABLE(area_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT area_id FROM public.user_managed_areas(_user_id)
  UNION
  SELECT area_id FROM public.user_area_membership
    WHERE user_id = _user_id AND status = 'active';
$$;

-- 9) Profiles: campos novos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS primary_area_id UUID REFERENCES public.area(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS direct_manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date DATE;

-- 10) RLS POLICIES

-- area: leitura para autenticados (catálogo organizacional); escrita Admin/PMO
CREATE POLICY area_select_authenticated ON public.area
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY area_insert_admin_pmo ON public.area
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pmo(auth.uid()));

CREATE POLICY area_update_admin_pmo ON public.area
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_pmo(auth.uid()))
  WITH CHECK (public.is_admin_or_pmo(auth.uid()));

CREATE POLICY area_delete_admin_pmo ON public.area
  FOR DELETE TO authenticated USING (public.is_admin_or_pmo(auth.uid()));

-- user_area_membership: usuário vê o próprio; gestores veem da área gerida; Admin/PMO veem tudo
CREATE POLICY uam_select_visible ON public.user_area_membership
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.is_admin_or_pmo(auth.uid())
    OR public.user_manages_area(auth.uid(), area_id)
  );

CREATE POLICY uam_insert_admin_pmo ON public.user_area_membership
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pmo(auth.uid()));

CREATE POLICY uam_update_admin_pmo ON public.user_area_membership
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_pmo(auth.uid()))
  WITH CHECK (public.is_admin_or_pmo(auth.uid()));

CREATE POLICY uam_delete_admin_pmo ON public.user_area_membership
  FOR DELETE TO authenticated USING (public.is_admin_or_pmo(auth.uid()));

-- area_manager: leitura para autenticados; escrita Admin/PMO
CREATE POLICY am_select_authenticated ON public.area_manager
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY am_insert_admin_pmo ON public.area_manager
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_pmo(auth.uid()));

CREATE POLICY am_update_admin_pmo ON public.area_manager
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_pmo(auth.uid()))
  WITH CHECK (public.is_admin_or_pmo(auth.uid()));

CREATE POLICY am_delete_admin_pmo ON public.area_manager
  FOR DELETE TO authenticated USING (public.is_admin_or_pmo(auth.uid()));

-- 11) Impedir DELETE físico de área com vínculos/registros
CREATE OR REPLACE FUNCTION public.area_block_delete_when_linked()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_area_membership WHERE area_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.area_manager WHERE area_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.area WHERE parent_area_id = OLD.id)
     OR EXISTS (SELECT 1 FROM public.profiles WHERE primary_area_id = OLD.id) THEN
    RAISE EXCEPTION 'Área possui vínculos ativos. Utilize a inativação.';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER trg_area_block_delete BEFORE DELETE ON public.area
  FOR EACH ROW EXECUTE FUNCTION public.area_block_delete_when_linked();

-- 12) Permissões dos módulos
INSERT INTO public.permissions (module, action, description)
VALUES
  ('areas','view','Visualizar áreas organizacionais'),
  ('areas','create','Criar áreas organizacionais'),
  ('areas','edit','Editar áreas organizacionais'),
  ('areas','delete','Inativar/remover áreas'),
  ('area-managers','view','Visualizar gestores de área'),
  ('area-managers','manage','Gerenciar vínculos de gestão')
ON CONFLICT (module, action) DO NOTHING;

-- Conceder todas as novas permissões para Administrador e PMO
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Administrador','PMO')
  AND p.module IN ('areas','area-managers')
ON CONFLICT DO NOTHING;
