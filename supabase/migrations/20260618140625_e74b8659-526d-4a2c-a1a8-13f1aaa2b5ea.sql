CREATE OR REPLACE FUNCTION public.notification_user_is_recipient(_notification_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_recipient nr
    WHERE nr.notification_id = _notification_id
      AND nr.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.notification_user_is_sender(_notification_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notification n
    WHERE n.id = _notification_id
      AND n.sender_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_notification(_notification_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.notification_user_is_sender(_notification_id, _user_id)
    OR public.notification_user_is_recipient(_notification_id, _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_manage_notification(_notification_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.notification_user_is_sender(_notification_id, _user_id)
$$;

DROP POLICY IF EXISTS n_select ON public.notification;
CREATE POLICY n_select ON public.notification
FOR SELECT
USING (
  public.is_admin_or_pmo(auth.uid())
  OR sender_user_id = auth.uid()
  OR public.notification_user_is_recipient(id, auth.uid())
);

DROP POLICY IF EXISTS nr_select ON public.notification_recipient;
CREATE POLICY nr_select ON public.notification_recipient
FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_admin_or_pmo(auth.uid())
  OR public.notification_user_is_sender(notification_id, auth.uid())
);

DROP POLICY IF EXISTS nr_insert ON public.notification_recipient;
CREATE POLICY nr_insert ON public.notification_recipient
FOR INSERT
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR public.notification_user_is_sender(notification_id, auth.uid())
);

DROP POLICY IF EXISTS nr_update_admin ON public.notification_recipient;
CREATE POLICY nr_update_admin ON public.notification_recipient
FOR UPDATE
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.notification_user_is_sender(notification_id, auth.uid())
);

DROP POLICY IF EXISTS na_select ON public.notification_attachment;
CREATE POLICY na_select ON public.notification_attachment
FOR SELECT
USING (public.can_read_notification(notification_id, auth.uid()));

DROP POLICY IF EXISTS na_modify ON public.notification_attachment;
CREATE POLICY na_modify ON public.notification_attachment
FOR ALL
USING (public.can_manage_notification(notification_id, auth.uid()))
WITH CHECK (public.can_manage_notification(notification_id, auth.uid()));

DROP POLICY IF EXISTS nv_select ON public.notification_version;
CREATE POLICY nv_select ON public.notification_version
FOR SELECT
USING (public.can_read_notification(notification_id, auth.uid()));

DROP POLICY IF EXISTS nv_insert ON public.notification_version;
CREATE POLICY nv_insert ON public.notification_version
FOR INSERT
WITH CHECK (public.can_manage_notification(notification_id, auth.uid()));

DROP POLICY IF EXISTS na_audit_select ON public.notification_audit;
CREATE POLICY na_audit_select ON public.notification_audit
FOR SELECT
USING (public.can_manage_notification(notification_id, auth.uid()));

DROP POLICY IF EXISTS nrl_select ON public.notification_reminder_log;
CREATE POLICY nrl_select ON public.notification_reminder_log
FOR SELECT
USING (public.can_manage_notification(notification_id, auth.uid()));

DROP POLICY IF EXISTS nrl_insert ON public.notification_reminder_log;
CREATE POLICY nrl_insert ON public.notification_reminder_log
FOR INSERT
WITH CHECK (public.can_manage_notification(notification_id, auth.uid()));