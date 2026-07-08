-- Add free-text external assignee name to tasks and meeting action items
ALTER TABLE public.task ADD COLUMN IF NOT EXISTS assignee_external_name text;
ALTER TABLE public.meeting_action_item ADD COLUMN IF NOT EXISTS assignee_external_name text;

-- Update RPC to exclude action items already promoted to a project task,
-- so the home page does not duplicate the task and the action item.
CREATE OR REPLACE FUNCTION public.get_managed_action_items(_manager_id uuid)
 RETURNS TABLE(id uuid, meeting_id uuid, meeting_title text, title text, description text, assignee_id uuid, assignee_name text, assignee_email text, due_date date, priority text, status text, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ai.id, ai.meeting_id, m.title, ai.title, ai.description,
    ai.assignee_id,
    COALESCE(p.name, ai.assignee_external_name) AS assignee_name,
    p.email,
    ai.due_date, ai.priority, ai.status, ai.updated_at
  FROM public.meeting_action_item ai
  JOIN public.meeting m ON m.id = ai.meeting_id
  LEFT JOIN public.profiles p ON p.user_id = ai.assignee_id
  WHERE ai.promoted_to_task_id IS NULL
    AND (ai.assignee_id IS NULL OR ai.assignee_id <> _manager_id)
    AND (
      public.is_admin_or_pmo(_manager_id)
      OR m.manager_id = _manager_id
      OR m.organizer_id = _manager_id
      OR m.created_by = _manager_id
    );
$function$;