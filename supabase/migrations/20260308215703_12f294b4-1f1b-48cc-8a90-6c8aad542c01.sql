
-- Convert ALL restrictive policies to permissive by dropping and recreating them
-- PostgreSQL requires at least one PERMISSIVE policy for rows to be accessible

-- ============ audit_logs ============
DROP POLICY IF EXISTS "Admins can view audit_logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Authenticated can insert own audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert own audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ legal_acceptances ============
DROP POLICY IF EXISTS "Users can insert own acceptances" ON public.legal_acceptances;
CREATE POLICY "Users can insert own acceptances" ON public.legal_acceptances
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own acceptances" ON public.legal_acceptances;
CREATE POLICY "Users can view own acceptances" ON public.legal_acceptances
  FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'Administrador'));

-- ============ legal_document_versions ============
DROP POLICY IF EXISTS "Admins can manage legal_document_versions" ON public.legal_document_versions;
CREATE POLICY "Admins can manage legal_document_versions" ON public.legal_document_versions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Anyone can view legal_document_versions" ON public.legal_document_versions;
CREATE POLICY "Anyone can view legal_document_versions" ON public.legal_document_versions
  FOR SELECT TO authenticated USING (true);

-- ============ legal_documents ============
DROP POLICY IF EXISTS "Admins can manage legal_documents" ON public.legal_documents;
CREATE POLICY "Admins can manage legal_documents" ON public.legal_documents
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Anyone can view legal_documents" ON public.legal_documents;
CREATE POLICY "Anyone can view legal_documents" ON public.legal_documents
  FOR SELECT TO authenticated USING (true);

-- ============ modules ============
DROP POLICY IF EXISTS "Admins can manage modules" ON public.modules;
CREATE POLICY "Admins can manage modules" ON public.modules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Authenticated can view modules" ON public.modules;
CREATE POLICY "Authenticated can view modules" ON public.modules
  FOR SELECT TO authenticated USING (true);

-- ============ permissions ============
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.permissions;
CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Authenticated can view permissions" ON public.permissions;
CREATE POLICY "Authenticated can view permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- ============ privacy_settings ============
DROP POLICY IF EXISTS "Admins can manage privacy_settings" ON public.privacy_settings;
CREATE POLICY "Admins can manage privacy_settings" ON public.privacy_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Authenticated can view privacy_settings" ON public.privacy_settings;
CREATE POLICY "Authenticated can view privacy_settings" ON public.privacy_settings
  FOR SELECT TO authenticated USING (true);

-- ============ profiles ============
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'Administrador'));

-- ============ role_permissions ============
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;
CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Authenticated can view role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated can view role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- ============ roles ============
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Authenticated can view roles" ON public.roles;
CREATE POLICY "Authenticated can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

-- ============ security_settings ============
DROP POLICY IF EXISTS "Admins can manage security_settings" ON public.security_settings;
CREATE POLICY "Admins can manage security_settings" ON public.security_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Admins can view security_settings" ON public.security_settings;
CREATE POLICY "Admins can view security_settings" ON public.security_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'Administrador'));

-- ============ system_settings ============
DROP POLICY IF EXISTS "Admins can manage system_settings" ON public.system_settings;
CREATE POLICY "Admins can manage system_settings" ON public.system_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Authenticated can view system_settings" ON public.system_settings;
CREATE POLICY "Authenticated can view system_settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);

-- ============ user_roles ============
DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
CREATE POLICY "Admins can manage user_roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'Administrador'));

-- ============ password_history ============
DROP POLICY IF EXISTS "Authenticated can insert own password history" ON public.password_history;
CREATE POLICY "Authenticated can insert own password history" ON public.password_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage password history" ON public.password_history;
CREATE POLICY "Admins can manage password history" ON public.password_history
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));
