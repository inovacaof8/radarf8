-- 1) add manager_id to meeting
ALTER TABLE public.meeting
  ADD COLUMN IF NOT EXISTS manager_id uuid;

-- backfill existing rows: manager = creator
UPDATE public.meeting SET manager_id = created_by WHERE manager_id IS NULL;

-- 2) update can_manage_meeting to include manager_id
CREATE OR REPLACE FUNCTION public.can_manage_meeting(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.meeting m
      WHERE m.id = _meeting_id
        AND (m.created_by = _user_id OR m.organizer_id = _user_id OR m.manager_id = _user_id)
    );
$function$;

-- 3) update can_read_meeting to include manager_id
CREATE OR REPLACE FUNCTION public.can_read_meeting(_meeting_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.meeting m
      WHERE m.id = _meeting_id
        AND (
          m.created_by = _user_id
          OR m.organizer_id = _user_id
          OR m.manager_id = _user_id
          OR (m.project_id IS NOT NULL AND public.can_read_project(m.project_id, _user_id))
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.meeting_participant mp
      WHERE mp.meeting_id = _meeting_id AND mp.user_id = _user_id
    );
$function$;

-- 4) helper for "Meu trabalho > Liderados": pendencias atribuidas a pessoas em reunioes geridas pelo usuario
CREATE OR REPLACE FUNCTION public.get_managed_action_items(_manager_id uuid)
RETURNS TABLE(
  id uuid,
  meeting_id uuid,
  meeting_title text,
  title text,
  description text,
  assignee_id uuid,
  assignee_name text,
  assignee_email text,
  due_date date,
  priority text,
  status text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    ai.id, ai.meeting_id, m.title, ai.title, ai.description,
    ai.assignee_id, p.name, p.email,
    ai.due_date, ai.priority, ai.status, ai.updated_at
  FROM public.meeting_action_item ai
  JOIN public.meeting m ON m.id = ai.meeting_id
  LEFT JOIN public.profiles p ON p.user_id = ai.assignee_id
  WHERE m.manager_id = _manager_id
    AND ai.assignee_id IS NOT NULL
    AND ai.assignee_id <> _manager_id;
$function$;