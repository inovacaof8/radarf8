
-- 1. Garante cascata de subáreas para todos os gestores existentes
UPDATE public.area_manager SET include_child_areas = TRUE WHERE include_child_areas IS DISTINCT FROM TRUE;

-- 2. Cria o papel Diretor Geral
INSERT INTO public.roles (name, description)
VALUES ('Diretor Geral', 'Visão executiva global: lê portfólios, programas, projetos, cronogramas, reuniões, planos de ação e documentos de toda a organização.')
ON CONFLICT (name) DO NOTHING;

-- 3. Concede permissões de leitura (view) em todos os módulos existentes
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Diretor Geral'
  AND p.action = 'view'
ON CONFLICT DO NOTHING;

-- 4. Função helper: leitor global (Admin, PMO, Diretor Geral)
CREATE OR REPLACE FUNCTION public.is_global_reader(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active_user(_uid)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _uid
        AND r.name IN ('Administrador','PMO','Diretor Geral')
    )
$$;

-- 5. Atualiza funções de leitura para incluir Diretor Geral
CREATE OR REPLACE FUNCTION public.can_read_portfolio(_portfolio_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR EXISTS (SELECT 1 FROM public.portfolio p WHERE p.id = _portfolio_id AND p.owner_id = _user_id)
      OR (
        public.has_module_perm(_user_id, 'portfolio', ARRAY['view','edit','admin'])
        AND EXISTS (
          SELECT 1 FROM public.portfolio_area pa
          WHERE pa.portfolio_id = _portfolio_id
            AND public.user_can_access_area(_user_id, pa.area_id)
        )
      )
      OR (
        public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
        AND EXISTS (SELECT 1 FROM public.project p WHERE p.portfolio_id = _portfolio_id AND p.manager_id = _user_id)
      )
      OR (
        public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
        AND EXISTS (
          SELECT 1 FROM public.project p
          JOIN public.project_member pm ON pm.project_id = p.id
          WHERE p.portfolio_id = _portfolio_id AND pm.user_id = _user_id
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_program(_program_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR EXISTS (SELECT 1 FROM public.program pr WHERE pr.id = _program_id AND pr.owner_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.program pr
        WHERE pr.id = _program_id
          AND public.has_module_perm(_user_id, 'program', ARRAY['view','edit','admin'])
          AND public.can_read_portfolio(pr.portfolio_id, _user_id)
      )
      OR EXISTS (SELECT 1 FROM public.project p WHERE p.program_id = _program_id AND p.manager_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.project p
        JOIN public.project_member pm ON pm.project_id = p.id
        WHERE p.program_id = _program_id AND pm.user_id = _user_id
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = _project_id AND p.manager_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.project_member pm
        WHERE pm.project_id = _project_id AND pm.user_id = _user_id
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_action_plan(_plan_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_global_reader(_user_id)
    OR public.is_reader(_user_id)
    OR EXISTS (SELECT 1 FROM public.action_plan WHERE id = _plan_id AND (owner_id = _user_id OR created_by = _user_id))
    OR public.is_action_plan_member(_plan_id, _user_id, NULL)
    OR public.manages_action_plan_area(_plan_id, _user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_read_meeting(_meeting_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR (
        public.has_module_perm(_user_id, 'meetings', ARRAY['view','edit','admin'])
        AND (
          EXISTS (
            SELECT 1 FROM public.meeting m
            WHERE m.id = _meeting_id
              AND (
                m.created_by = _user_id
                OR m.organizer_id = _user_id
                OR m.manager_id = _user_id
                OR (m.project_id IS NOT NULL AND public.can_read_project(m.project_id, _user_id))
                OR (m.program_id IS NOT NULL AND public.can_read_program(m.program_id, _user_id))
                OR (m.portfolio_id IS NOT NULL AND public.can_read_portfolio(m.portfolio_id, _user_id))
              )
          )
          OR EXISTS (
            SELECT 1 FROM public.meeting_participant mp
            WHERE mp.meeting_id = _meeting_id AND mp.user_id = _user_id
          )
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_document(_doc_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR EXISTS (SELECT 1 FROM public.document d WHERE d.id = _doc_id AND d.created_by = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.document_acl a
        WHERE a.document_id = _doc_id
          AND a.user_id = _user_id
          AND a.permission = ANY (ARRAY['read','edit','admin'])
      )
      OR EXISTS (
        SELECT 1 FROM public.document d
        WHERE d.id = _doc_id
          AND public.has_module_perm(_user_id, 'documents', ARRAY['view','edit','admin'])
          AND (
            (d.project_id IS NOT NULL AND public.can_read_project(d.project_id, _user_id))
            OR (d.program_id IS NOT NULL AND public.can_read_program(d.program_id, _user_id))
            OR (d.portfolio_id IS NOT NULL AND public.can_read_portfolio(d.portfolio_id, _user_id))
          )
      )
    )
$$;

-- 6. Diretor Geral enxerga todos os usuários ativos nos seletores
CREATE OR REPLACE FUNCTION public.users_visible_to(_user_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND public.is_global_reader(_user_id)
  UNION
  SELECT DISTINCT p.user_id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND NOT public.is_global_reader(_user_id)
    AND (
      p.user_id = _user_id
      OR (
        p.primary_area_id IS NOT NULL
        AND p.primary_area_id IN (SELECT area_id FROM public.user_visible_areas(_user_id))
      )
      OR EXISTS (
        SELECT 1 FROM public.user_area_membership uam
        WHERE uam.user_id = p.user_id
          AND uam.status = 'active'
          AND uam.start_date <= CURRENT_DATE
          AND (uam.end_date IS NULL OR uam.end_date >= CURRENT_DATE)
          AND uam.area_id IN (SELECT area_id FROM public.user_visible_areas(_user_id))
      )
    );
$$;
