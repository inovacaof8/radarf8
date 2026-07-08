
-- Insert default roles
INSERT INTO public.roles (name, description, is_system, is_active) VALUES
  ('Administrador', 'Acesso total ao sistema', true, true),
  ('Operador', 'Acesso operacional ao sistema', true, true),
  ('Visualizador', 'Acesso somente leitura', true, true)
ON CONFLICT DO NOTHING;

-- Insert default system_settings
INSERT INTO public.system_settings (app_name, app_short_name, version, environment, footer_text)
SELECT 'Base de Governança', 'GovBase', '1.0.0', 'development', '© 2026 GovBase — Todos os direitos reservados'
WHERE NOT EXISTS (SELECT 1 FROM public.system_settings);

-- Insert default security_settings
INSERT INTO public.security_settings (
  min_password_length, require_uppercase, require_lowercase, require_numbers,
  require_special_chars, max_login_attempts, lockout_duration_minutes,
  session_timeout_minutes, password_expiration_days, password_history_count,
  mfa_enabled, allow_multiple_sessions, require_password_change_first_access
)
SELECT 8, true, true, true, true, 5, 15, 30, 90, 5, false, false, true
WHERE NOT EXISTS (SELECT 1 FROM public.security_settings);

-- Insert default privacy_settings
INSERT INTO public.privacy_settings (retention_days, show_cookie_banner, dpo_name, dpo_email)
SELECT 365, true, '', ''
WHERE NOT EXISTS (SELECT 1 FROM public.privacy_settings);
