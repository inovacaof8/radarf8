
-- ============ SETTINGS (singleton) ============
CREATE TABLE public.onboarding_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled boolean NOT NULL DEFAULT true,
  passing_score int NOT NULL DEFAULT 5,
  total_questions int NOT NULL DEFAULT 7,
  exempt_role_names text[] NOT NULL DEFAULT ARRAY['Administrador']::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.onboarding_settings TO authenticated;
GRANT ALL ON public.onboarding_settings TO service_role;
ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all authenticated read settings" ON public.onboarding_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages settings" ON public.onboarding_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'Administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'Administrador'));

INSERT INTO public.onboarding_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ============ PROGRESS ============
CREATE TABLE public.onboarding_progress (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  current_section text,
  sections_viewed text[] NOT NULL DEFAULT ARRAY[]::text[],
  time_spent_seconds int NOT NULL DEFAULT 0,
  attempts int NOT NULL DEFAULT 0,
  best_score int,
  best_total int,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_progress TO authenticated;
GRANT ALL ON public.onboarding_progress TO service_role;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own progress" ON public.onboarding_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_pmo(auth.uid()));
CREATE POLICY "owner inserts own progress" ON public.onboarding_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner updates own progress" ON public.onboarding_progress
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_onboarding_progress_updated
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ QUIZ ATTEMPTS ============
CREATE TABLE public.onboarding_quiz_attempt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  score int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 7,
  passed boolean NOT NULL DEFAULT false,
  duration_seconds int
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_quiz_attempt TO authenticated;
GRANT ALL ON public.onboarding_quiz_attempt TO service_role;
ALTER TABLE public.onboarding_quiz_attempt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own attempts" ON public.onboarding_quiz_attempt
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_pmo(auth.uid()));
CREATE POLICY "owner inserts own attempts" ON public.onboarding_quiz_attempt
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner updates own attempts" ON public.onboarding_quiz_attempt
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ QUIZ ANSWERS ============
CREATE TABLE public.onboarding_quiz_answer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.onboarding_quiz_attempt(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  selected_index int NOT NULL,
  is_correct boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.onboarding_quiz_answer TO authenticated;
GRANT ALL ON public.onboarding_quiz_answer TO service_role;
ALTER TABLE public.onboarding_quiz_answer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own answers" ON public.onboarding_quiz_answer
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.onboarding_quiz_attempt a
            WHERE a.id = attempt_id
              AND (a.user_id = auth.uid() OR public.is_admin_or_pmo(auth.uid())))
  );
CREATE POLICY "owner inserts own answers" ON public.onboarding_quiz_answer
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.onboarding_quiz_attempt a
            WHERE a.id = attempt_id AND a.user_id = auth.uid())
  );

CREATE INDEX idx_onb_attempt_user ON public.onboarding_quiz_attempt(user_id);
CREATE INDEX idx_onb_answer_attempt ON public.onboarding_quiz_answer(attempt_id);

-- ============ HELPER FUNCTION ============
CREATE OR REPLACE FUNCTION public.onboarding_required(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _settings public.onboarding_settings;
  _user_roles text[];
  _completed timestamptz;
BEGIN
  SELECT * INTO _settings FROM public.onboarding_settings WHERE id = true;
  IF _settings IS NULL OR NOT _settings.enabled THEN
    RETURN false;
  END IF;

  SELECT array_agg(r.name) INTO _user_roles
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = _user_id;

  IF _user_roles IS NULL THEN
    RETURN false; -- usuário sem papel definido não é bloqueado
  END IF;

  -- isento se possui algum papel listado em exempt_role_names
  IF _user_roles && _settings.exempt_role_names THEN
    RETURN false;
  END IF;

  SELECT completed_at INTO _completed
  FROM public.onboarding_progress WHERE user_id = _user_id;

  RETURN _completed IS NULL;
END;
$$;
