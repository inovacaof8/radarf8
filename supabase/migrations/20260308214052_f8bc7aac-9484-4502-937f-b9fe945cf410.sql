
-- Password history table for reuse prevention
CREATE TABLE public.password_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own password history"
  ON public.password_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert password history"
  ON public.password_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_password_history_user_id ON public.password_history(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_profiles_status ON public.profiles(status);
