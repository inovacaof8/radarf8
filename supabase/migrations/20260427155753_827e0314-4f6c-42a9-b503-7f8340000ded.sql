
-- Revoke EXECUTE from anon on helper functions
REVOKE EXECUTE ON FUNCTION public.is_admin_or_pmo(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_reader(uuid)       FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_user_roles()  FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_admin_or_pmo(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_reader(uuid)       TO authenticated;
GRANT  EXECUTE ON FUNCTION public.current_user_roles()  TO authenticated;

-- Remove MV from API exposure: revoke direct privileges, expose via guarded view
REVOKE ALL ON public.mv_portfolio_health FROM anon, authenticated;

CREATE OR REPLACE VIEW public.v_portfolio_health
WITH (security_invoker = true)
AS
SELECT *
FROM public.mv_portfolio_health
WHERE public.is_admin_or_pmo(auth.uid());

GRANT SELECT ON public.v_portfolio_health TO authenticated;
