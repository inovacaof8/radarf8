-- Ensure role/permission helpers only authorize active users
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND p.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _user_id
        AND r.name = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_pmo(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_uid)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _uid AND r.name IN ('Administrador','PMO')
    )
$$;

CREATE OR REPLACE FUNCTION public.is_reader(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_uid)
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _uid AND r.name = 'Leitor'
    )
$$;

CREATE OR REPLACE FUNCTION public.has_module_perm(_user_id uuid, _module text, _actions text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = _user_id
        AND p.module = _module
        AND p.action = ANY(_actions)
    )
$$;

-- Area scoping for portfolios
CREATE TABLE IF NOT EXISTS public.portfolio_area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolio(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.area(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, area_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_area TO authenticated;
GRANT ALL ON public.portfolio_area TO service_role;
ALTER TABLE public.portfolio_area ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_area(_user_id uuid, _area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_area_membership uam
      WHERE uam.user_id = _user_id
        AND uam.area_id = _area_id
        AND uam.status = 'active'
        AND uam.start_date <= CURRENT_DATE
        AND (uam.end_date IS NULL OR uam.end_date >= CURRENT_DATE)
    )
    OR public.user_manages_area(_user_id, _area_id)
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_area(_user_id uuid, _area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.user_manages_area(_user_id, _area_id)
$$;

CREATE OR REPLACE FUNCTION public.is_portfolio_owner(_portfolio_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portfolio p
    WHERE p.id = _portfolio_id
      AND p.owner_id = _user_id
  )
$$;

-- Backfill area links from project managers' primary areas and area memberships
INSERT INTO public.portfolio_area (portfolio_id, area_id, is_primary)
SELECT DISTINCT p.id, pr.primary_area_id, true
FROM public.portfolio p
JOIN public.project pj ON pj.portfolio_id = p.id
JOIN public.profiles pr ON pr.user_id = pj.manager_id
WHERE pr.primary_area_id IS NOT NULL
ON CONFLICT (portfolio_id, area_id) DO NOTHING;

INSERT INTO public.portfolio_area (portfolio_id, area_id, is_primary)
SELECT DISTINCT p.id, uam.area_id, false
FROM public.portfolio p
JOIN public.project pj ON pj.portfolio_id = p.id
JOIN public.user_area_membership uam ON uam.user_id = pj.manager_id
WHERE uam.status = 'active'
ON CONFLICT (portfolio_id, area_id) DO NOTHING;

DROP POLICY IF EXISTS portfolio_area_select ON public.portfolio_area;
DROP POLICY IF EXISTS portfolio_area_insert ON public.portfolio_area;
DROP POLICY IF EXISTS portfolio_area_update ON public.portfolio_area;
DROP POLICY IF EXISTS portfolio_area_delete ON public.portfolio_area;
CREATE POLICY portfolio_area_select ON public.portfolio_area FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.user_can_access_area(auth.uid(), area_id)
  OR public.is_portfolio_owner(portfolio_id, auth.uid())
);
CREATE POLICY portfolio_area_insert ON public.portfolio_area FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.is_portfolio_owner(portfolio_id, auth.uid())
    AND public.user_can_manage_area(auth.uid(), area_id)
  )
);
CREATE POLICY portfolio_area_update ON public.portfolio_area FOR UPDATE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.is_portfolio_owner(portfolio_id, auth.uid())
    AND public.user_can_manage_area(auth.uid(), area_id)
  )
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.is_portfolio_owner(portfolio_id, auth.uid())
    AND public.user_can_manage_area(auth.uid(), area_id)
  )
);
CREATE POLICY portfolio_area_delete ON public.portfolio_area FOR DELETE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.is_portfolio_owner(portfolio_id, auth.uid())
    AND public.user_can_manage_area(auth.uid(), area_id)
  )
);

-- Defaults so newly created records remain visible/editable by their creator
CREATE OR REPLACE FUNCTION public.portfolio_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_portfolio_set_owner ON public.portfolio;
CREATE TRIGGER trg_portfolio_set_owner
BEFORE INSERT ON public.portfolio
FOR EACH ROW EXECUTE FUNCTION public.portfolio_set_owner();

CREATE OR REPLACE FUNCTION public.program_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_program_set_owner ON public.program;
CREATE TRIGGER trg_program_set_owner
BEFORE INSERT ON public.program
FOR EACH ROW EXECUTE FUNCTION public.program_set_owner();

CREATE OR REPLACE FUNCTION public.project_set_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.manager_id IS NULL THEN
    NEW.manager_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_project_set_manager ON public.project;
CREATE TRIGGER trg_project_set_manager
BEFORE INSERT ON public.project
FOR EACH ROW EXECUTE FUNCTION public.project_set_manager();

-- Scoped read/edit helpers for hierarchy and documents
CREATE OR REPLACE FUNCTION public.can_read_portfolio(_portfolio_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
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

CREATE OR REPLACE FUNCTION public.can_edit_portfolio(_portfolio_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR EXISTS (SELECT 1 FROM public.portfolio p WHERE p.id = _portfolio_id AND p.owner_id = _user_id)
      OR (
        public.has_module_perm(_user_id, 'portfolio', ARRAY['edit','admin'])
        AND EXISTS (
          SELECT 1 FROM public.portfolio_area pa
          WHERE pa.portfolio_id = _portfolio_id
            AND public.user_can_manage_area(_user_id, pa.area_id)
        )
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_program(_program_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
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

CREATE OR REPLACE FUNCTION public.can_edit_program(_program_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR EXISTS (SELECT 1 FROM public.program pr WHERE pr.id = _program_id AND pr.owner_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.program pr
        WHERE pr.id = _program_id
          AND public.has_module_perm(_user_id, 'program', ARRAY['edit','admin'])
          AND public.can_edit_portfolio(pr.portfolio_id, _user_id)
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = _project_id AND p.manager_id = _user_id)
      OR (
        public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
        AND EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = _project_id AND pm.user_id = _user_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.project p
        WHERE p.id = _project_id
          AND public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
          AND p.portfolio_id IS NOT NULL
          AND public.can_read_portfolio(p.portfolio_id, _user_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.project p
        WHERE p.id = _project_id
          AND public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
          AND p.program_id IS NOT NULL
          AND public.can_read_program(p.program_id, _user_id)
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = _project_id AND p.manager_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.project p
        WHERE p.id = _project_id
          AND public.has_module_perm(_user_id, 'project', ARRAY['edit','admin'])
          AND (
            (p.portfolio_id IS NOT NULL AND public.can_edit_portfolio(p.portfolio_id, _user_id))
            OR (p.program_id IS NOT NULL AND public.can_edit_program(p.program_id, _user_id))
          )
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_document(_doc_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
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

CREATE OR REPLACE FUNCTION public.can_write_document(_doc_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.document d
        WHERE d.id = _doc_id
          AND d.created_by = _user_id
          AND public.has_module_perm(_user_id, 'documents', ARRAY['create','edit','admin'])
      )
      OR EXISTS (
        SELECT 1 FROM public.document_acl a
        WHERE a.document_id = _doc_id
          AND a.user_id = _user_id
          AND a.permission = ANY (ARRAY['edit','admin'])
      )
      OR EXISTS (
        SELECT 1 FROM public.document d
        WHERE d.id = _doc_id
          AND public.has_module_perm(_user_id, 'documents', ARRAY['create','edit','admin'])
          AND (
            (d.project_id IS NOT NULL AND public.can_edit_project(d.project_id, _user_id))
            OR (d.program_id IS NOT NULL AND public.can_edit_program(d.program_id, _user_id))
            OR (d.portfolio_id IS NOT NULL AND public.can_edit_portfolio(d.portfolio_id, _user_id))
          )
      )
    )
$$;

-- Replace hierarchy RLS policies with scoped helpers
DROP POLICY IF EXISTS portfolio_admin_pmo_all ON public.portfolio;
DROP POLICY IF EXISTS portfolio_read ON public.portfolio;
DROP POLICY IF EXISTS portfolio_insert ON public.portfolio;
DROP POLICY IF EXISTS portfolio_update ON public.portfolio;
DROP POLICY IF EXISTS portfolio_delete ON public.portfolio;
CREATE POLICY portfolio_read ON public.portfolio FOR SELECT TO authenticated
USING (public.can_read_portfolio(id, auth.uid()));
CREATE POLICY portfolio_insert ON public.portfolio FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user(auth.uid())
  AND (owner_id = auth.uid() OR public.is_admin_or_pmo(auth.uid()))
  AND (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'portfolio', ARRAY['create','admin']))
);
CREATE POLICY portfolio_update ON public.portfolio FOR UPDATE TO authenticated
USING (public.can_edit_portfolio(id, auth.uid()))
WITH CHECK (public.can_edit_portfolio(id, auth.uid()));
CREATE POLICY portfolio_delete ON public.portfolio FOR DELETE TO authenticated
USING (
  public.can_edit_portfolio(id, auth.uid())
  AND (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'portfolio', ARRAY['delete','admin']))
);

DROP POLICY IF EXISTS program_admin_pmo_all ON public.program;
DROP POLICY IF EXISTS program_read ON public.program;
DROP POLICY IF EXISTS program_insert ON public.program;
DROP POLICY IF EXISTS program_update ON public.program;
DROP POLICY IF EXISTS program_delete ON public.program;
CREATE POLICY program_read ON public.program FOR SELECT TO authenticated
USING (public.can_read_program(id, auth.uid()));
CREATE POLICY program_insert ON public.program FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user(auth.uid())
  AND (owner_id = auth.uid() OR public.is_admin_or_pmo(auth.uid()))
  AND (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'program', ARRAY['create','admin']))
  AND public.can_edit_portfolio(portfolio_id, auth.uid())
);
CREATE POLICY program_update ON public.program FOR UPDATE TO authenticated
USING (public.can_edit_program(id, auth.uid()))
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.has_module_perm(auth.uid(), 'program', ARRAY['edit','admin'])
    AND public.can_edit_portfolio(portfolio_id, auth.uid())
  )
  OR owner_id = auth.uid()
);
CREATE POLICY program_delete ON public.program FOR DELETE TO authenticated
USING (
  public.can_edit_program(id, auth.uid())
  AND (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'program', ARRAY['delete','admin']))
);

DROP POLICY IF EXISTS project_read ON public.project;
DROP POLICY IF EXISTS project_insert ON public.project;
DROP POLICY IF EXISTS project_update ON public.project;
DROP POLICY IF EXISTS project_delete ON public.project;
CREATE POLICY project_read ON public.project FOR SELECT TO authenticated
USING (public.can_read_project(id, auth.uid()));
CREATE POLICY project_insert ON public.project FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user(auth.uid())
  AND (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'project', ARRAY['create','admin']))
  AND (manager_id = auth.uid() OR public.is_admin_or_pmo(auth.uid()))
  AND (portfolio_id IS NULL OR public.can_edit_portfolio(portfolio_id, auth.uid()))
  AND (program_id IS NULL OR public.can_edit_program(program_id, auth.uid()))
);
CREATE POLICY project_update ON public.project FOR UPDATE TO authenticated
USING (public.can_edit_project(id, auth.uid()))
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR manager_id = auth.uid()
  OR (
    public.has_module_perm(auth.uid(), 'project', ARRAY['edit','admin'])
    AND (portfolio_id IS NULL OR public.can_edit_portfolio(portfolio_id, auth.uid()))
    AND (program_id IS NULL OR public.can_edit_program(program_id, auth.uid()))
  )
);
CREATE POLICY project_delete ON public.project FOR DELETE TO authenticated
USING (
  public.can_edit_project(id, auth.uid())
  AND (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'project', ARRAY['delete','admin']))
);

DROP POLICY IF EXISTS task_write ON public.task;
CREATE POLICY task_write ON public.task FOR ALL TO authenticated
USING (
  public.can_edit_project(project_id, auth.uid())
  OR (public.has_module_perm(auth.uid(), 'tasks', ARRAY['edit','admin']) AND public.can_read_project(project_id, auth.uid()))
)
WITH CHECK (
  public.can_edit_project(project_id, auth.uid())
  OR (public.has_module_perm(auth.uid(), 'tasks', ARRAY['create','edit','admin']) AND public.can_read_project(project_id, auth.uid()))
);

DROP POLICY IF EXISTS roadmap_read ON public.roadmap_item;
DROP POLICY IF EXISTS roadmap_write ON public.roadmap_item;
CREATE POLICY roadmap_read ON public.roadmap_item FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR (project_id IS NOT NULL AND public.can_read_project(project_id, auth.uid()))
  OR (program_id IS NOT NULL AND public.can_read_program(program_id, auth.uid()))
  OR (portfolio_id IS NOT NULL AND public.can_read_portfolio(portfolio_id, auth.uid()))
);
CREATE POLICY roadmap_write ON public.roadmap_item FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR (project_id IS NOT NULL AND public.can_edit_project(project_id, auth.uid()))
  OR (program_id IS NOT NULL AND public.can_edit_program(program_id, auth.uid()))
  OR (portfolio_id IS NOT NULL AND public.can_edit_portfolio(portfolio_id, auth.uid()))
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (project_id IS NOT NULL AND public.can_edit_project(project_id, auth.uid()))
  OR (program_id IS NOT NULL AND public.can_edit_program(program_id, auth.uid()))
  OR (portfolio_id IS NOT NULL AND public.can_edit_portfolio(portfolio_id, auth.uid()))
);

-- Document RLS: creator/project-scope can add file versions; ACL uses read/edit/admin consistently
DROP POLICY IF EXISTS document_read ON public.document;
DROP POLICY IF EXISTS document_insert ON public.document;
DROP POLICY IF EXISTS document_update ON public.document;
DROP POLICY IF EXISTS document_delete ON public.document;
CREATE POLICY document_read ON public.document FOR SELECT TO authenticated
USING (public.can_read_document(id, auth.uid()));
CREATE POLICY document_insert ON public.document FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user(auth.uid())
  AND created_by = auth.uid()
  AND (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'documents', ARRAY['create','admin']))
  AND (project_id IS NULL OR public.can_read_project(project_id, auth.uid()))
  AND (program_id IS NULL OR public.can_read_program(program_id, auth.uid()))
  AND (portfolio_id IS NULL OR public.can_read_portfolio(portfolio_id, auth.uid()))
);
CREATE POLICY document_update ON public.document FOR UPDATE TO authenticated
USING (public.can_write_document(id, auth.uid()))
WITH CHECK (public.can_write_document(id, auth.uid()));
CREATE POLICY document_delete ON public.document FOR DELETE TO authenticated
USING (
  public.can_write_document(id, auth.uid())
  AND (public.is_admin_or_pmo(auth.uid()) OR public.has_module_perm(auth.uid(), 'documents', ARRAY['delete','admin']))
);

DROP POLICY IF EXISTS dv_read ON public.document_version;
DROP POLICY IF EXISTS dv_write ON public.document_version;
CREATE POLICY dv_read ON public.document_version FOR SELECT TO authenticated
USING (public.can_read_document(document_id, auth.uid()));
CREATE POLICY dv_write ON public.document_version FOR ALL TO authenticated
USING (public.can_write_document(document_id, auth.uid()))
WITH CHECK (public.can_write_document(document_id, auth.uid()));

DROP POLICY IF EXISTS dacl_read ON public.document_acl;
DROP POLICY IF EXISTS dacl_write ON public.document_acl;
CREATE POLICY dacl_read ON public.document_acl FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR user_id = auth.uid()
  OR public.can_write_document(document_id, auth.uid())
);
CREATE POLICY dacl_write ON public.document_acl FOR ALL TO authenticated
USING (public.can_write_document(document_id, auth.uid()))
WITH CHECK (public.can_write_document(document_id, auth.uid()));

-- Storage policies for PMO documents: upload only to an existing document the user may write
DROP POLICY IF EXISTS "documents delete admin pmo" ON storage.objects;
DROP POLICY IF EXISTS "documents read via document ACL" ON storage.objects;
DROP POLICY IF EXISTS "documents upload by allowed users" ON storage.objects;
CREATE POLICY "documents read via document access" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.document_version dv
    WHERE dv.storage_path = storage.objects.name
      AND public.can_read_document(dv.document_id, auth.uid())
  )
);
CREATE POLICY "documents upload via document access" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.document d
    WHERE d.id::text = split_part(storage.objects.name, '/', 2)
      AND public.can_write_document(d.id, auth.uid())
  )
);
CREATE POLICY "documents delete via document access" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.document_version dv
    WHERE dv.storage_path = storage.objects.name
      AND public.can_write_document(dv.document_id, auth.uid())
  )
);

-- Keep execution available for RLS helpers used by authenticated clients/policies
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_area(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_area(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_portfolio(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_program(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_document(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_document(uuid, uuid) TO authenticated;