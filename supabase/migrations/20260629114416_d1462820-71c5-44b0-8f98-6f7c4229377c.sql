
CREATE OR REPLACE FUNCTION public.ged_can_view_doc(_doc_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_global_reader(_user_id)
    OR public.ged_is_doc_owner(_doc_id, _user_id)
    OR public.ged_has_shared_access(_doc_id, _user_id, ARRAY['read','edit']);
$function$;
