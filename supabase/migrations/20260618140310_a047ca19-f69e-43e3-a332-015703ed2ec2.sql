DROP POLICY IF EXISTS n_select ON public.notification;
CREATE POLICY n_select ON public.notification FOR SELECT USING (
  is_admin_or_pmo(auth.uid())
  OR sender_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.notification_recipient r
    WHERE r.notification_id = notification.id
      AND r.user_id = auth.uid()
  )
);