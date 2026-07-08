
-- Fix permissive RLS policy on audit_logs
DROP POLICY "Authenticated can insert audit_logs" ON public.audit_logs;

CREATE POLICY "Authenticated can insert own audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
