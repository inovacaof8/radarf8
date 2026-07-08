
-- ============ Módulo PDCA F8 ============

-- 1) Tabela pdca_weeks
CREATE TABLE public.pdca_weeks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_num INTEGER NOT NULL,
  week_date DATE NOT NULL DEFAULT CURRENT_DATE,
  goal INTEGER NOT NULL DEFAULT 80,
  blockers TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'current',
  pct INTEGER,
  done INTEGER,
  total INTEGER,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdca_weeks TO authenticated;
GRANT ALL ON public.pdca_weeks TO service_role;
ALTER TABLE public.pdca_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdca_weeks_view ON public.pdca_weeks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action = 'view'
  ));

CREATE POLICY pdca_weeks_insert ON public.pdca_weeks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action IN ('create','admin')
  ));

CREATE POLICY pdca_weeks_update ON public.pdca_weeks
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action IN ('edit','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action IN ('edit','admin')
  ));

CREATE POLICY pdca_weeks_delete ON public.pdca_weeks
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action IN ('delete','admin')
  ));

-- 2) Tabela pdca_items
CREATE TABLE public.pdca_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id UUID NOT NULL REFERENCES public.pdca_weeks(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente',
  kind TEXT NOT NULL DEFAULT 'current',
  due DATE,
  ordem INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdca_items TO authenticated;
GRANT ALL ON public.pdca_items TO service_role;
ALTER TABLE public.pdca_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX pdca_items_week_idx ON public.pdca_items(week_id);

CREATE POLICY pdca_items_view ON public.pdca_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action = 'view'
  ));

CREATE POLICY pdca_items_insert ON public.pdca_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action IN ('create','admin')
  ));

CREATE POLICY pdca_items_update ON public.pdca_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action IN ('edit','admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action IN ('edit','admin')
  ));

CREATE POLICY pdca_items_delete ON public.pdca_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.module = 'pdca' AND p.action IN ('delete','admin')
  ));

-- 3) Triggers updated_at
CREATE TRIGGER pdca_weeks_touch BEFORE UPDATE ON public.pdca_weeks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pdca_items_touch BEFORE UPDATE ON public.pdca_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Registrar módulo no catálogo
INSERT INTO public.modules (name, description, slug, is_active, icon)
VALUES ('PDCA F8', 'Placar do Combinado · acompanhamento semanal de combinados e tarefas', 'pdca', true, 'Trophy')
ON CONFLICT (slug) DO NOTHING;

-- 5) Permissões do módulo (view, create, edit, delete, export, admin)
INSERT INTO public.permissions (module, action, description) VALUES
  ('pdca','view','Visualizar PDCA F8'),
  ('pdca','create','Criar registros no PDCA F8'),
  ('pdca','edit','Editar registros do PDCA F8'),
  ('pdca','delete','Excluir registros do PDCA F8'),
  ('pdca','export','Exportar PDF/JSON do PDCA F8'),
  ('pdca','admin','Administrar PDCA F8')
ON CONFLICT (module, action) DO NOTHING;

-- 6) Conceder todas as permissões PDCA ao Administrador
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'Administrador' AND p.module = 'pdca'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 7) Seed: Semana 1 com os 17 combinados iniciais
DO $$
DECLARE wid UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pdca_weeks) THEN
    INSERT INTO public.pdca_weeks (week_num, week_date, goal, status)
    VALUES (1, CURRENT_DATE, 80, 'current')
    RETURNING id INTO wid;

    INSERT INTO public.pdca_items (week_id, text, owner, status, kind, ordem, origin) VALUES
    (wid,'Alvará Ledluz, N-led, Luz Led','Alessandro','pendente','current',1,'combined'),
    (wid,'Ploomes - Finalizar módulo da Licitação','Saulo','pendente','current',2,'combined'),
    (wid,'Ploomes - Treinamento com equipes','Laiz / Saulo','pendente','current',3,'combined'),
    (wid,'Folha Sankhya','Saulo','pendente','current',4,'combined'),
    (wid,'Capacitação Usuários Chaves Sankhya','Márcio / Saulo','pendente','current',5,'combined'),
    (wid,'Prensa Hidráulica','Marcos / Rafael','pendente','current',6,'combined'),
    (wid,'Treinamento Prensa Hidráulica','João Lacerda','pendente','current',7,'combined'),
    (wid,'Reunião Líderes sobre o ponto','Alyne','pendente','current',8,'combined'),
    (wid,'Catálogos','Bruno','pendente','current',9,'combined'),
    (wid,'Gerador','Rafael','pendente','current',10,'combined'),
    (wid,'Certificados Digitais','DP / Faturamento / Contratos / Licitação','pendente','current',11,'combined'),
    (wid,'Inventário Grupo F8','Thiago','pendente','current',12,'combined'),
    (wid,'Inventário Engenharia de Projetos Especiais','João Lacerda','pendente','current',13,'combined'),
    (wid,'Whatsapp Business','Saulo','pendente','current',14,'combined'),
    (wid,'Nota fiscal Azizi para Ledluz','João Armando','pendente','current',15,'combined'),
    (wid,'Compras de bebidas à vista','Marcos','pendente','current',16,'combined'),
    (wid,'Campo de endereço de entrega','Thiago','pendente','current',17,'combined');
  END IF;
END $$;
