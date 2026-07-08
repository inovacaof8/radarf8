
-- =========================================================
-- 1) NOVAS ROLES (Administrador já existe)
-- =========================================================
INSERT INTO public.roles (name, description, is_system, is_active)
SELECT v.name, v.description, true, true
FROM (VALUES
  ('PMO',     'Equipe de PMO — gestão transversal de portfólios, programas e projetos'),
  ('Gestor',  'Gerente de projeto — gerencia projetos sob sua responsabilidade'),
  ('Membro',  'Membro de equipe — executa tarefas em projetos onde está alocado'),
  ('Leitor',  'Acesso somente leitura a portfólios, programas e projetos')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.name = v.name);

-- =========================================================
-- 2) HELPERS
-- =========================================================
-- Retorna lista de nomes de roles do usuário corrente
CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(r.name), ARRAY[]::text[])
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
$$;

-- Atalhos booleanos de papel
CREATE OR REPLACE FUNCTION public.is_admin_or_pmo(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _uid AND r.name IN ('Administrador','PMO')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_reader(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _uid AND r.name = 'Leitor'
  )
$$;

-- =========================================================
-- 3) HIERARQUIA: PORTFOLIO / PROGRAM / PROJECT
-- =========================================================
CREATE TABLE public.portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  objective text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','encerrado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolio(id) ON DELETE RESTRICT,
  name text NOT NULL,
  benefits text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','encerrado')),
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.project (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid REFERENCES public.program(id) ON DELETE SET NULL,
  portfolio_id uuid REFERENCES public.portfolio(id) ON DELETE SET NULL,
  code text UNIQUE,
  name text NOT NULL,
  description text,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'iniciacao' CHECK (status IN (
    'iniciacao','planejamento','execucao','monitoramento','encerramento','cancelado'
  )),
  health text NOT NULL DEFAULT 'verde' CHECK (health IN ('verde','amarelo','vermelho')),
  start_date date,
  end_date date,
  baseline_end_date date,
  budget_planned numeric(14,2),
  budget_spent numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_project_portfolio ON public.project(portfolio_id);
CREATE INDEX idx_project_program ON public.project(program_id);
CREATE INDEX idx_project_manager ON public.project(manager_id);

CREATE TABLE public.project_member (
  project_id uuid NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_project text NOT NULL DEFAULT 'membro',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX idx_project_member_user ON public.project_member(user_id);

-- =========================================================
-- 4) CRONOGRAMA / TAREFAS / RISCOS
-- =========================================================
CREATE TABLE public.phase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  name text NOT NULL,
  ordering int NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_phase_project ON public.phase(project_id);

CREATE TABLE public.task (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.phase(id) ON DELETE SET NULL,
  parent_task_id uuid REFERENCES public.task(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  progress int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'backlog' CHECK (status IN (
    'backlog','em_andamento','bloqueada','concluida','cancelada'
  )),
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa','media','alta','critica')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_task_project ON public.task(project_id);
CREATE INDEX idx_task_assignee ON public.task(assignee_id);
CREATE INDEX idx_task_status ON public.task(status);

CREATE TABLE public.task_dependency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_id uuid NOT NULL REFERENCES public.task(id) ON DELETE CASCADE,
  successor_id   uuid NOT NULL REFERENCES public.task(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'FS' CHECK (type IN ('FS','SS','FF','SF')),
  lag_days int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (predecessor_id, successor_id)
);

CREATE TABLE public.risk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.project(id) ON DELETE CASCADE,
  description text NOT NULL,
  probability int CHECK (probability BETWEEN 1 AND 5),
  impact int CHECK (impact BETWEEN 1 AND 5),
  exposure int GENERATED ALWAYS AS (COALESCE(probability,0) * COALESCE(impact,0)) STORED,
  response text,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','mitigado','aceito','encerrado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_risk_project ON public.risk(project_id);

-- =========================================================
-- 5) GED
-- =========================================================
CREATE TABLE public.document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.project(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.program(id) ON DELETE SET NULL,
  portfolio_id uuid REFERENCES public.portfolio(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  current_version_id uuid,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho','em_aprovacao','aprovado','arquivado'
  )),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_project ON public.document(project_id);

CREATE TABLE public.document_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.document(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  file_size_bytes bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no)
);

ALTER TABLE public.document
  ADD CONSTRAINT document_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.document_version(id) ON DELETE SET NULL;

CREATE TABLE public.document_approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.document_version(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step int NOT NULL,
  decision text NOT NULL DEFAULT 'pendente' CHECK (decision IN ('pendente','aprovado','rejeitado')),
  comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_approval_approver ON public.document_approval(approver_id, decision);

CREATE TABLE public.document_acl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.document(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('read','edit','approve','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id, permission)
);

-- =========================================================
-- 6) ROADMAP
-- =========================================================
CREATE TABLE public.roadmap_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES public.portfolio(id) ON DELETE SET NULL,
  program_id uuid REFERENCES public.program(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.project(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  swimlane text,
  bucket text NOT NULL DEFAULT 'proximo' CHECK (bucket IN ('agora','proximo','depois','entregue')),
  start_date date,
  end_date date,
  ordering int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 7) TRIGGERS DE updated_at
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'portfolio','program','project','phase','task','risk',
    'document','roadmap_item'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();',
      t
    );
  END LOOP;
END $$;

-- =========================================================
-- 8) RLS
-- =========================================================
ALTER TABLE public.portfolio        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_member   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependency  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acl     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_item     ENABLE ROW LEVEL SECURITY;

-- ---------- PORTFOLIO ----------
CREATE POLICY portfolio_read ON public.portfolio FOR SELECT USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.is_reader(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project p
    JOIN public.project_member pm ON pm.project_id = p.id
    WHERE p.portfolio_id = portfolio.id AND pm.user_id = auth.uid()
  )
);
CREATE POLICY portfolio_admin_pmo_all ON public.portfolio FOR ALL
  USING (public.is_admin_or_pmo(auth.uid()))
  WITH CHECK (public.is_admin_or_pmo(auth.uid()));

-- ---------- PROGRAM ----------
CREATE POLICY program_read ON public.program FOR SELECT USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.is_reader(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project p
    JOIN public.project_member pm ON pm.project_id = p.id
    WHERE p.program_id = program.id AND pm.user_id = auth.uid()
  )
);
CREATE POLICY program_admin_pmo_all ON public.program FOR ALL
  USING (public.is_admin_or_pmo(auth.uid()))
  WITH CHECK (public.is_admin_or_pmo(auth.uid()));

-- ---------- PROJECT ----------
CREATE POLICY project_read ON public.project FOR SELECT USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.is_reader(auth.uid())
  OR project.manager_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project_member pm
    WHERE pm.project_id = project.id AND pm.user_id = auth.uid()
  )
);
CREATE POLICY project_insert ON public.project FOR INSERT WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'Gestor'
  )
);
CREATE POLICY project_update ON public.project FOR UPDATE USING (
  public.is_admin_or_pmo(auth.uid()) OR project.manager_id = auth.uid()
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid()) OR project.manager_id = auth.uid()
);
CREATE POLICY project_delete ON public.project FOR DELETE USING (
  public.is_admin_or_pmo(auth.uid())
);

-- ---------- PROJECT MEMBER ----------
CREATE POLICY pm_read ON public.project_member FOR SELECT USING (
  public.is_admin_or_pmo(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.project p
    WHERE p.id = project_member.project_id AND p.manager_id = auth.uid()
  )
);
CREATE POLICY pm_write ON public.project_member FOR ALL USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project p
    WHERE p.id = project_member.project_id AND p.manager_id = auth.uid()
  )
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.project p
    WHERE p.id = project_member.project_id AND p.manager_id = auth.uid()
  )
);

-- ---------- PHASE / TASK / RISK / DEPENDENCY (herdam do projeto) ----------
CREATE POLICY phase_read ON public.phase FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.project p WHERE p.id = phase.project_id)
);
CREATE POLICY phase_write ON public.phase FOR ALL USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = phase.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = phase.project_id AND pm.user_id = auth.uid())
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = phase.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = phase.project_id AND pm.user_id = auth.uid())
);

CREATE POLICY task_read ON public.task FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.project p WHERE p.id = task.project_id)
);
CREATE POLICY task_write ON public.task FOR ALL USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = task.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = task.project_id AND pm.user_id = auth.uid())
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = task.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = task.project_id AND pm.user_id = auth.uid())
);

CREATE POLICY risk_read ON public.risk FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.project p WHERE p.id = risk.project_id)
);
CREATE POLICY risk_write ON public.risk FOR ALL USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = risk.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = risk.project_id AND pm.user_id = auth.uid())
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = risk.project_id AND p.manager_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = risk.project_id AND pm.user_id = auth.uid())
);

CREATE POLICY td_read ON public.task_dependency FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.task t WHERE t.id = task_dependency.predecessor_id)
);
CREATE POLICY td_write ON public.task_dependency FOR ALL USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.task t
    JOIN public.project p ON p.id = t.project_id
    WHERE t.id = task_dependency.predecessor_id
      AND (p.manager_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.task t
    JOIN public.project p ON p.id = t.project_id
    WHERE t.id = task_dependency.predecessor_id
      AND (p.manager_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.project_member pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid()))
  )
);

-- ---------- DOCUMENT ----------
CREATE POLICY document_read ON public.document FOR SELECT USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_acl a
    WHERE a.document_id = document.id AND a.user_id = auth.uid()
  )
  OR (document.project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.project_member pm
    WHERE pm.project_id = document.project_id AND pm.user_id = auth.uid()
  ))
);
CREATE POLICY document_insert ON public.document FOR INSERT WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (document.project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.project_member pm
    WHERE pm.project_id = document.project_id AND pm.user_id = auth.uid()
  ))
);
CREATE POLICY document_update ON public.document FOR UPDATE USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_acl a
    WHERE a.document_id = document.id AND a.user_id = auth.uid() AND a.permission IN ('edit','admin')
  )
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_acl a
    WHERE a.document_id = document.id AND a.user_id = auth.uid() AND a.permission IN ('edit','admin')
  )
);
CREATE POLICY document_delete ON public.document FOR DELETE USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_acl a
    WHERE a.document_id = document.id AND a.user_id = auth.uid() AND a.permission = 'admin'
  )
);

-- ---------- DOCUMENT VERSION ----------
CREATE POLICY dv_read ON public.document_version FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.document d WHERE d.id = document_version.document_id)
);
CREATE POLICY dv_write ON public.document_version FOR ALL USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_acl a
    WHERE a.document_id = document_version.document_id AND a.user_id = auth.uid() AND a.permission IN ('edit','admin')
  )
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_acl a
    WHERE a.document_id = document_version.document_id AND a.user_id = auth.uid() AND a.permission IN ('edit','admin')
  )
);

-- ---------- DOCUMENT APPROVAL ----------
CREATE POLICY da_read ON public.document_approval FOR SELECT USING (
  public.is_admin_or_pmo(auth.uid())
  OR approver_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.document_version dv
    JOIN public.document d ON d.id = dv.document_id
    WHERE dv.id = document_approval.version_id
      AND (d.created_by = auth.uid()
           OR EXISTS (SELECT 1 FROM public.document_acl a WHERE a.document_id = d.id AND a.user_id = auth.uid()))
  )
);
CREATE POLICY da_insert ON public.document_approval FOR INSERT WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_version dv
    JOIN public.document d ON d.id = dv.document_id
    WHERE dv.id = document_approval.version_id
      AND (d.created_by = auth.uid()
           OR EXISTS (SELECT 1 FROM public.document_acl a
                      WHERE a.document_id = d.id AND a.user_id = auth.uid() AND a.permission IN ('edit','admin')))
  )
);
CREATE POLICY da_update ON public.document_approval FOR UPDATE USING (
  approver_id = auth.uid() OR public.is_admin_or_pmo(auth.uid())
) WITH CHECK (
  approver_id = auth.uid() OR public.is_admin_or_pmo(auth.uid())
);

-- ---------- DOCUMENT ACL ----------
CREATE POLICY dacl_read ON public.document_acl FOR SELECT USING (
  public.is_admin_or_pmo(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.document d
    WHERE d.id = document_acl.document_id AND d.created_by = auth.uid()
  )
);
CREATE POLICY dacl_write ON public.document_acl FOR ALL USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_acl a
    WHERE a.document_id = document_acl.document_id AND a.user_id = auth.uid() AND a.permission = 'admin'
  )
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.document_acl a
    WHERE a.document_id = document_acl.document_id AND a.user_id = auth.uid() AND a.permission = 'admin'
  )
);

-- ---------- ROADMAP ----------
CREATE POLICY roadmap_read ON public.roadmap_item FOR SELECT USING (true);
CREATE POLICY roadmap_write ON public.roadmap_item FOR ALL
  USING (public.is_admin_or_pmo(auth.uid()))
  WITH CHECK (public.is_admin_or_pmo(auth.uid()));

-- =========================================================
-- 9) MATERIALIZED VIEW: mv_portfolio_health
-- =========================================================
CREATE MATERIALIZED VIEW public.mv_portfolio_health AS
SELECT
  p.id AS portfolio_id,
  p.name,
  COUNT(DISTINCT prj.id) AS projects_total,
  COUNT(DISTINCT prj.id) FILTER (WHERE prj.health = 'vermelho') AS projects_red,
  COUNT(DISTINCT prj.id) FILTER (WHERE prj.health = 'amarelo') AS projects_yellow,
  COUNT(DISTINCT prj.id) FILTER (WHERE prj.health = 'verde')   AS projects_green,
  COALESCE(SUM(DISTINCT prj.budget_planned), 0) AS budget_planned,
  COALESCE(SUM(DISTINCT prj.budget_spent), 0)   AS budget_spent,
  COALESCE(ROUND(AVG(
    CASE WHEN prj.status = 'encerramento' THEN 100
         ELSE (SELECT COALESCE(AVG(progress), 0)::int FROM public.task t WHERE t.project_id = prj.id)
    END
  )::numeric, 1), 0) AS avg_progress
FROM public.portfolio p
LEFT JOIN public.project prj
  ON (prj.portfolio_id = p.id)
  OR (prj.program_id IN (SELECT id FROM public.program WHERE portfolio_id = p.id))
GROUP BY p.id, p.name;

CREATE UNIQUE INDEX mv_portfolio_health_pk ON public.mv_portfolio_health (portfolio_id);

-- =========================================================
-- 10) STORAGE: bucket privado 'documents' + policies
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents read via document ACL"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.document_version dv
    JOIN public.document d ON d.id = dv.document_id
    WHERE dv.storage_path = storage.objects.name
      AND (
        public.is_admin_or_pmo(auth.uid())
        OR EXISTS (SELECT 1 FROM public.document_acl a WHERE a.document_id = d.id AND a.user_id = auth.uid())
        OR (d.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.project_member pm WHERE pm.project_id = d.project_id AND pm.user_id = auth.uid()
        ))
      )
  )
);

CREATE POLICY "documents upload by allowed users"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "documents delete admin pmo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND public.is_admin_or_pmo(auth.uid())
);
