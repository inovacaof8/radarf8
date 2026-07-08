REVOKE EXECUTE ON FUNCTION public.notification_user_is_recipient(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notification_user_is_sender(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_read_notification(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_notification(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.notification_user_is_recipient(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notification_user_is_sender(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_notification(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_notification(uuid, uuid) TO authenticated, service_role;