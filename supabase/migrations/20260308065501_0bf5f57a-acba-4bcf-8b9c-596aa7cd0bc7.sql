DROP POLICY IF EXISTS "Admins can view security_settings" ON security_settings;
CREATE POLICY "Authenticated can view security_settings" ON security_settings FOR SELECT TO authenticated USING (true);