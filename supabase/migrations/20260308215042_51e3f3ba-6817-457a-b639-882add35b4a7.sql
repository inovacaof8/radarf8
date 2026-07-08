
-- 1. Fix password_history: remove SELECT policy (hashes should never be readable client-side)
DROP POLICY IF EXISTS "Users can view own password history" ON public.password_history;

-- Update INSERT policy to authenticated only
DROP POLICY IF EXISTS "System can insert password history" ON public.password_history;
CREATE POLICY "Authenticated can insert own password history"
  ON public.password_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin-only SELECT for maintenance
CREATE POLICY "Admins can manage password history"
  ON public.password_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

-- 2. Fix security_settings: restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated can view security_settings" ON public.security_settings;
CREATE POLICY "Admins can view security_settings"
  ON public.security_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'));
