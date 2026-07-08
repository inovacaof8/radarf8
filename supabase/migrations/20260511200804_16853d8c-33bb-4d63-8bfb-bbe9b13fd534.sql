
-- =====================================================================
-- GED Module: Enums
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE public.ged_document_type AS ENUM ('Certidão','Atestado de capacidade técnica','Laudo','INMETRO','Outro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.ged_document_origin AS ENUM ('Parceiro','Própria instituição');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.ged_document_status AS ENUM ('Vigente','Vencido','Substituído','Inativo');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.ged_index_status AS ENUM ('Pendente','Indexado','Erro','Não aplicável');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =====================================================================
-- Helper: GED access role check
-- =====================================================================
CREATE OR REPLACE FUNCTION public.ged_can_view(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_pmo(_uid)
    OR public.has_role(_uid, 'Gestor')
    OR public.has_role(_uid, 'Leitor');
$$;

CREATE OR REPLACE FUNCTION public.ged_can_manage(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_pmo(_uid)
    OR public.has_role(_uid, 'Gestor');
$$;

-- =====================================================================
-- Auxiliary tables: Partners, Products, Institutions
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ged_partner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  document text,
  contact_email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ged_partner ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ged_product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ged_product ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ged_institution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ged_institution ENABLE ROW LEVEL SECURITY;

CREATE POLICY ged_partner_read   ON public.ged_partner   FOR SELECT USING (public.ged_can_view(auth.uid()));
CREATE POLICY ged_partner_write  ON public.ged_partner   FOR ALL    USING (public.ged_can_manage(auth.uid())) WITH CHECK (public.ged_can_manage(auth.uid()));
CREATE POLICY ged_product_read   ON public.ged_product   FOR SELECT USING (public.ged_can_view(auth.uid()));
CREATE POLICY ged_product_write  ON public.ged_product   FOR ALL    USING (public.ged_can_manage(auth.uid())) WITH CHECK (public.ged_can_manage(auth.uid()));
CREATE POLICY ged_inst_read      ON public.ged_institution FOR SELECT USING (public.ged_can_view(auth.uid()));
CREATE POLICY ged_inst_write     ON public.ged_institution FOR ALL    USING (public.ged_can_manage(auth.uid())) WITH CHECK (public.ged_can_manage(auth.uid()));

-- =====================================================================
-- Main: ged_document
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ged_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo_documento ged_document_type NOT NULL,
  origem_documento ged_document_origin NOT NULL,
  parceiro_id uuid REFERENCES public.ged_partner(id) ON DELETE SET NULL,
  produto_id uuid REFERENCES public.ged_product(id) ON DELETE SET NULL,
  instituicao_id uuid REFERENCES public.ged_institution(id) ON DELETE SET NULL,
  numero_documento text,
  orgao_emissor text,
  data_emissao date,
  data_validade date,
  status ged_document_status NOT NULL DEFAULT 'Vigente',
  descricao text,
  tags text[] NOT NULL DEFAULT '{}',
  observacoes text,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ged_document_partner_required CHECK (
    origem_documento <> 'Parceiro' OR parceiro_id IS NOT NULL
  )
);
ALTER TABLE public.ged_document ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ged_document_status ON public.ged_document(status);
CREATE INDEX IF NOT EXISTS idx_ged_document_parceiro ON public.ged_document(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_ged_document_produto ON public.ged_document(produto_id);
CREATE INDEX IF NOT EXISTS idx_ged_document_tipo ON public.ged_document(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_ged_document_tags ON public.ged_document USING GIN(tags);

CREATE POLICY ged_document_read   ON public.ged_document FOR SELECT USING (public.ged_can_view(auth.uid()));
CREATE POLICY ged_document_insert ON public.ged_document FOR INSERT WITH CHECK (public.ged_can_manage(auth.uid()));
CREATE POLICY ged_document_update ON public.ged_document FOR UPDATE USING (public.ged_can_manage(auth.uid())) WITH CHECK (public.ged_can_manage(auth.uid()));
CREATE POLICY ged_document_delete ON public.ged_document FOR DELETE USING (public.is_admin_or_pmo(auth.uid()));

-- =====================================================================
-- ged_document_version
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ged_document_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.ged_document(id) ON DELETE CASCADE,
  numero_versao integer NOT NULL,
  arquivo_url text NOT NULL,
  nome_arquivo text,
  tamanho_arquivo bigint,
  tipo_arquivo text,
  hash_arquivo text,
  motivo_nova_versao text,
  versao_atual boolean NOT NULL DEFAULT false,
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_id, numero_versao)
);
ALTER TABLE public.ged_document_version ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ged_dv_documento ON public.ged_document_version(documento_id);
-- only one current per document
CREATE UNIQUE INDEX IF NOT EXISTS uq_ged_dv_one_current
  ON public.ged_document_version(documento_id) WHERE versao_atual = true;

CREATE POLICY ged_dv_read   ON public.ged_document_version FOR SELECT USING (public.ged_can_view(auth.uid()));
CREATE POLICY ged_dv_write  ON public.ged_document_version FOR ALL USING (public.ged_can_manage(auth.uid())) WITH CHECK (public.ged_can_manage(auth.uid()));

-- =====================================================================
-- ged_document_index (AI search)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.ged_document_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.ged_document(id) ON DELETE CASCADE,
  versao_documento_id uuid REFERENCES public.ged_document_version(id) ON DELETE SET NULL,
  texto_indexado text,
  resumo_ia text,
  palavras_chave text[] NOT NULL DEFAULT '{}',
  entidades_identificadas jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding jsonb,
  status_indexacao ged_index_status NOT NULL DEFAULT 'Pendente',
  indexado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_id)
);
ALTER TABLE public.ged_document_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY ged_di_read  ON public.ged_document_index FOR SELECT USING (public.ged_can_view(auth.uid()));
CREATE POLICY ged_di_write ON public.ged_document_index FOR ALL USING (public.ged_can_manage(auth.uid())) WITH CHECK (public.ged_can_manage(auth.uid()));

-- =====================================================================
-- updated_at triggers
-- =====================================================================
CREATE TRIGGER trg_ged_partner_updated   BEFORE UPDATE ON public.ged_partner   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ged_product_updated   BEFORE UPDATE ON public.ged_product   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ged_inst_updated      BEFORE UPDATE ON public.ged_institution FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ged_doc_updated       BEFORE UPDATE ON public.ged_document   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ged_di_updated        BEFORE UPDATE ON public.ged_document_index FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- Storage bucket
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ged-documents', 'ged-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: only GED users can read; only managers can write
CREATE POLICY "ged storage read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ged-documents' AND public.ged_can_view(auth.uid()));

CREATE POLICY "ged storage insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ged-documents' AND public.ged_can_manage(auth.uid()));

CREATE POLICY "ged storage update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'ged-documents' AND public.ged_can_manage(auth.uid()));

CREATE POLICY "ged storage delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ged-documents' AND public.is_admin_or_pmo(auth.uid()));

-- =====================================================================
-- Register module in catalog
-- =====================================================================
INSERT INTO public.modules (name, description, slug, is_active, icon)
VALUES ('GED', 'Gestão eletrônica de documentos técnicos', 'ged', true, 'FolderArchive')
ON CONFLICT DO NOTHING;
