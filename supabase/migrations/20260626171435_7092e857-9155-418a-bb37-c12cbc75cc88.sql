
-- Grants for RBAC tables so the Permissions UI can read/write through PostgREST
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
