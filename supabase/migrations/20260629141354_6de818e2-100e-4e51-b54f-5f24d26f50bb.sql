CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR EXISTS (SELECT 1 FROM public.project p WHERE p.id = _project_id AND p.manager_id = _user_id)
      OR EXISTS (
        SELECT 1 FROM public.project_member pm
        WHERE pm.project_id = _project_id AND pm.user_id = _user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.task t
        WHERE t.project_id = _project_id AND t.assignee_id = _user_id
      )
    )
$function$;