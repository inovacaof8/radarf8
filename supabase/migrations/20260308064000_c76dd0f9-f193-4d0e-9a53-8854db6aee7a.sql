
-- =============================================
-- ENUM TYPES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'blocked');
CREATE TYPE public.legal_doc_type AS ENUM ('privacy', 'terms', 'cookies');
CREATE TYPE public.environment_type AS ENUM ('development', 'staging', 'production');

-- =============================================
-- FUNCTION: update_updated_at_column
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- TABLE: profiles
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  status public.user_status NOT NULL DEFAULT 'active',
  last_access TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABLE: roles
-- =============================================
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABLE: user_roles
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: permissions
-- =============================================
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module, action)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: role_permissions
-- =============================================
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: audit_logs
-- =============================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL DEFAULT 'Sistema',
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  previous_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: legal_documents
-- =============================================
CREATE TABLE public.legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.legal_doc_type NOT NULL,
  title TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_legal_documents_updated_at
  BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABLE: legal_document_versions
-- =============================================
CREATE TABLE public.legal_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.legal_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  requires_acceptance BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by TEXT NOT NULL DEFAULT 'Sistema'
);

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: legal_acceptances
-- =============================================
CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.legal_documents(id),
  version_id UUID NOT NULL REFERENCES public.legal_document_versions(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TABLE: modules
-- =============================================
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABLE: security_settings (singleton)
-- =============================================
CREATE TABLE public.security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_password_length INTEGER NOT NULL DEFAULT 8,
  require_uppercase BOOLEAN NOT NULL DEFAULT true,
  require_lowercase BOOLEAN NOT NULL DEFAULT true,
  require_numbers BOOLEAN NOT NULL DEFAULT true,
  require_special_chars BOOLEAN NOT NULL DEFAULT true,
  password_history_count INTEGER NOT NULL DEFAULT 3,
  password_expiration_days INTEGER NOT NULL DEFAULT 90,
  max_login_attempts INTEGER NOT NULL DEFAULT 5,
  lockout_duration_minutes INTEGER NOT NULL DEFAULT 30,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
  require_password_change_first_access BOOLEAN NOT NULL DEFAULT true,
  allow_multiple_sessions BOOLEAN NOT NULL DEFAULT false,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_security_settings_updated_at
  BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABLE: system_settings (singleton)
-- =============================================
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL DEFAULT 'Base de Governança de Aplicações',
  app_short_name TEXT NOT NULL DEFAULT 'GovBase',
  app_description TEXT DEFAULT 'Plataforma base corporativa para governança, administração e controle de acesso.',
  primary_color TEXT DEFAULT '#2563EB',
  secondary_color TEXT DEFAULT '#64748B',
  background_color TEXT DEFAULT '#F5F7FA',
  logo_url TEXT DEFAULT '',
  favicon_url TEXT DEFAULT '',
  environment public.environment_type NOT NULL DEFAULT 'development',
  version TEXT NOT NULL DEFAULT '1.0.0',
  footer_text TEXT DEFAULT '© 2026 Base de Governança de Aplicações. Todos os direitos reservados.',
  contact_email TEXT DEFAULT 'admin@govbase.com.br',
  language TEXT DEFAULT 'pt-BR',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TABLE: privacy_settings (singleton)
-- =============================================
CREATE TABLE public.privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_days INTEGER NOT NULL DEFAULT 365,
  show_cookie_banner BOOLEAN NOT NULL DEFAULT true,
  data_categories TEXT[] DEFAULT ARRAY['Identificação', 'Contato', 'Acesso', 'Navegação'],
  dpo_email TEXT DEFAULT 'dpo@govbase.com.br',
  dpo_name TEXT DEFAULT 'Encarregado de Dados',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_privacy_settings_updated_at
  BEFORE UPDATE ON public.privacy_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- SECURITY DEFINER FUNCTION: has_role
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id
      AND r.name = _role
  )
$$;

-- =============================================
-- SECURITY DEFINER FUNCTION: get_user_permissions
-- =============================================
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE(module TEXT, action TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- profiles: users can read own, admins can read/write all
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'));

-- roles: authenticated can read, admins can write
CREATE POLICY "Authenticated can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- user_roles: users see own, admins see all
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- permissions: authenticated can read
CREATE POLICY "Authenticated can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- role_permissions: authenticated can read, admins can write
CREATE POLICY "Authenticated can view role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- audit_logs: admins can read and insert, system can insert
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Authenticated can insert audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- legal_documents: everyone can read, admins can write
CREATE POLICY "Anyone can view legal_documents" ON public.legal_documents
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage legal_documents" ON public.legal_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- legal_document_versions: everyone can read, admins can write
CREATE POLICY "Anyone can view legal_document_versions" ON public.legal_document_versions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage legal_document_versions" ON public.legal_document_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- legal_acceptances: users see own, admins see all
CREATE POLICY "Users can view own acceptances" ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Users can insert own acceptances" ON public.legal_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- modules: authenticated can read, admins can write
CREATE POLICY "Authenticated can view modules" ON public.modules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage modules" ON public.modules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- security_settings: admins only
CREATE POLICY "Admins can view security_settings" ON public.security_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Admins can manage security_settings" ON public.security_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- system_settings: authenticated can read, admins can write
CREATE POLICY "Authenticated can view system_settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage system_settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- privacy_settings: authenticated can read, admins can write
CREATE POLICY "Authenticated can view privacy_settings" ON public.privacy_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage privacy_settings" ON public.privacy_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- =============================================
-- TRIGGER: auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, status, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'active',
    true
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
