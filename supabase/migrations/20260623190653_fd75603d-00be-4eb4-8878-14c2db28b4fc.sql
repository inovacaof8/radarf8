-- Fix meeting RLS so insert().select() works for every authorized user
-- and keep visibility/participant management aligned with profile permissions and hierarchy.

CREATE OR REPLACE FUNCTION public.can_read_meeting(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR public.has_module_perm(_user_id, 'meetings', ARRAY['view','edit','admin'])
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.meeting m
        WHERE m.id = _meeting_id
          AND (
            m.created_by = _user_id
            OR m.organizer_id = _user_id
            OR m.manager_id = _user_id
            OR (m.project_id IS NOT NULL AND public.can_read_project(m.project_id, _user_id))
            OR (m.program_id IS NOT NULL AND public.can_read_program(m.program_id, _user_id))
            OR (m.portfolio_id IS NOT NULL AND public.can_read_portfolio(m.portfolio_id, _user_id))
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.meeting_participant mp
        WHERE mp.meeting_id = _meeting_id
          AND mp.user_id = _user_id
      )
    )
$function$;

CREATE OR REPLACE FUNCTION public.can_manage_meeting(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_admin_or_pmo(_user_id)
      OR (
        public.has_module_perm(_user_id, 'meetings', ARRAY['edit','admin'])
        AND EXISTS (
          SELECT 1
          FROM public.meeting m
          WHERE m.id = _meeting_id
            AND (
              m.created_by = _user_id
              OR m.organizer_id = _user_id
              OR m.manager_id = _user_id
            )
        )
      )
    )
$function$;

DROP POLICY IF EXISTS meeting_read ON public.meeting;
CREATE POLICY meeting_read
ON public.meeting
FOR SELECT
TO authenticated
USING (
  public.is_active_user(auth.uid())
  AND (
    public.is_admin_or_pmo(auth.uid())
    OR public.has_module_perm(auth.uid(), 'meetings', ARRAY['view','edit','admin'])
  )
  AND (
    public.is_admin_or_pmo(auth.uid())
    OR created_by = auth.uid()
    OR organizer_id = auth.uid()
    OR manager_id = auth.uid()
    OR (project_id IS NOT NULL AND public.can_read_project(project_id, auth.uid()))
    OR (program_id IS NOT NULL AND public.can_read_program(program_id, auth.uid()))
    OR (portfolio_id IS NOT NULL AND public.can_read_portfolio(portfolio_id, auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.meeting_participant mp
      WHERE mp.meeting_id = meeting.id
        AND mp.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS meeting_insert ON public.meeting;
CREATE POLICY meeting_insert
ON public.meeting
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_active_user(auth.uid())
  AND public.has_module_perm(auth.uid(), 'meetings', ARRAY['create','admin'])
  AND created_by = auth.uid()
  AND (organizer_id IS NULL OR organizer_id = auth.uid())
  AND (
    manager_id IS NULL
    OR manager_id = auth.uid()
    OR public.is_admin_or_pmo(auth.uid())
    OR manager_id IN (SELECT user_id FROM public.user_leadership_user_ids(auth.uid()))
  )
  AND (project_id IS NULL OR public.can_read_project(project_id, auth.uid()) OR public.is_admin_or_pmo(auth.uid()))
  AND (program_id IS NULL OR public.can_read_program(program_id, auth.uid()) OR public.is_admin_or_pmo(auth.uid()))
  AND (portfolio_id IS NULL OR public.can_read_portfolio(portfolio_id, auth.uid()) OR public.is_admin_or_pmo(auth.uid()))
);

DROP POLICY IF EXISTS meeting_update ON public.meeting;
CREATE POLICY meeting_update
ON public.meeting
FOR UPDATE
TO authenticated
USING (
  public.is_active_user(auth.uid())
  AND (
    public.is_admin_or_pmo(auth.uid())
    OR (
      public.has_module_perm(auth.uid(), 'meetings', ARRAY['edit','admin'])
      AND (
        created_by = auth.uid()
        OR organizer_id = auth.uid()
        OR manager_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  public.is_active_user(auth.uid())
  AND (
    public.is_admin_or_pmo(auth.uid())
    OR (
      public.has_module_perm(auth.uid(), 'meetings', ARRAY['edit','admin'])
      AND (
        created_by = auth.uid()
        OR organizer_id = auth.uid()
        OR manager_id = auth.uid()
      )
    )
  )
  AND (
    manager_id IS NULL
    OR manager_id = auth.uid()
    OR public.is_admin_or_pmo(auth.uid())
    OR manager_id IN (SELECT user_id FROM public.user_leadership_user_ids(auth.uid()))
  )
  AND (project_id IS NULL OR public.can_read_project(project_id, auth.uid()) OR public.is_admin_or_pmo(auth.uid()))
  AND (program_id IS NULL OR public.can_read_program(program_id, auth.uid()) OR public.is_admin_or_pmo(auth.uid()))
  AND (portfolio_id IS NULL OR public.can_read_portfolio(portfolio_id, auth.uid()) OR public.is_admin_or_pmo(auth.uid()))
);

DROP POLICY IF EXISTS meeting_delete ON public.meeting;
CREATE POLICY meeting_delete
ON public.meeting
FOR DELETE
TO authenticated
USING (
  public.is_active_user(auth.uid())
  AND (
    public.is_admin_or_pmo(auth.uid())
    OR (
      public.has_module_perm(auth.uid(), 'meetings', ARRAY['delete','admin'])
      AND (
        created_by = auth.uid()
        OR organizer_id = auth.uid()
        OR manager_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS mp_write ON public.meeting_participant;
DROP POLICY IF EXISTS mp_insert ON public.meeting_participant;
DROP POLICY IF EXISTS mp_update ON public.meeting_participant;
DROP POLICY IF EXISTS mp_delete ON public.meeting_participant;

CREATE POLICY mp_insert
ON public.meeting_participant
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_meeting(meeting_id, auth.uid())
  AND (
    public.is_admin_or_pmo(auth.uid())
    OR user_id = auth.uid()
    OR user_id IN (SELECT user_id FROM public.user_leadership_user_ids(auth.uid()))
  )
);

CREATE POLICY mp_update
ON public.meeting_participant
FOR UPDATE
TO authenticated
USING (public.can_manage_meeting(meeting_id, auth.uid()))
WITH CHECK (
  public.can_manage_meeting(meeting_id, auth.uid())
  AND (
    public.is_admin_or_pmo(auth.uid())
    OR user_id = auth.uid()
    OR user_id IN (SELECT user_id FROM public.user_leadership_user_ids(auth.uid()))
  )
);

CREATE POLICY mp_delete
ON public.meeting_participant
FOR DELETE
TO authenticated
USING (public.can_manage_meeting(meeting_id, auth.uid()));