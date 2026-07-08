REVOKE EXECUTE ON FUNCTION public.can_read_project(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_read_portfolio(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_read_program(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_read_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_portfolio(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_program(uuid, uuid) TO authenticated;