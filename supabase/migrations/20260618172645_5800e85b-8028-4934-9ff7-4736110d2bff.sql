
-- 1. change_log: restrict to authenticated
DROP POLICY IF EXISTS change_log_read ON public.change_log;
DROP POLICY IF EXISTS change_log_insert ON public.change_log;
CREATE POLICY change_log_read ON public.change_log FOR SELECT TO authenticated USING (public.is_admin_or_pmo(auth.uid()) OR changed_by = auth.uid());
CREATE POLICY change_log_insert ON public.change_log FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid() OR changed_by IS NULL);
REVOKE ALL ON public.change_log FROM anon;

-- 2. password_history: remove admin SELECT (keep insert)
DROP POLICY IF EXISTS "Admins can manage password history" ON public.password_history;

-- 3. document_version: require auth + ACL
DROP POLICY IF EXISTS dv_read ON public.document_version;
CREATE POLICY dv_read ON public.document_version FOR SELECT TO authenticated USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.is_document_creator(document_id, auth.uid())
  OR public.has_document_acl(document_id, auth.uid(), ARRAY['view','edit','admin'])
);
REVOKE ALL ON public.document_version FROM anon;

-- 4. phase: require auth + project read
DROP POLICY IF EXISTS phase_read ON public.phase;
CREATE POLICY phase_read ON public.phase FOR SELECT TO authenticated USING (public.can_read_project(project_id, auth.uid()));
REVOKE ALL ON public.phase FROM anon;

-- 5. risk: require auth + project read
DROP POLICY IF EXISTS risk_read ON public.risk;
CREATE POLICY risk_read ON public.risk FOR SELECT TO authenticated USING (public.can_read_project(project_id, auth.uid()));
REVOKE ALL ON public.risk FROM anon;

-- 6. task: require auth + project read
DROP POLICY IF EXISTS task_read ON public.task;
CREATE POLICY task_read ON public.task FOR SELECT TO authenticated USING (public.can_read_project(project_id, auth.uid()));
REVOKE ALL ON public.task FROM anon;

-- 7. task_dependency: require auth via task project read
DROP POLICY IF EXISTS td_read ON public.task_dependency;
CREATE POLICY td_read ON public.task_dependency FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.task t WHERE t.id = task_dependency.predecessor_id AND public.can_read_project(t.project_id, auth.uid()))
);
REVOKE ALL ON public.task_dependency FROM anon;

-- 8. roadmap_item: require auth
DROP POLICY IF EXISTS roadmap_read ON public.roadmap_item;
CREATE POLICY roadmap_read ON public.roadmap_item FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.roadmap_item FROM anon;

-- 9. notification_audit: restrict insert
DROP POLICY IF EXISTS na_audit_insert ON public.notification_audit;
CREATE POLICY na_audit_insert ON public.notification_audit FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND (
    public.notification_user_is_sender(notification_id, auth.uid())
    OR public.notification_user_is_recipient(notification_id, auth.uid())
  )
);
