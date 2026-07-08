CREATE OR REPLACE FUNCTION public.workflow_resolve_approver(_step_id uuid, _demand_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE s public.workflow_steps; d public.workflow_demands; _r uuid; _area uuid;
BEGIN
  SELECT * INTO s FROM public.workflow_steps WHERE id=_step_id;
  SELECT * INTO d FROM public.workflow_demands WHERE id=_demand_id;
  IF s.approver_type IN ('user','configured') THEN
    RETURN s.approver_user_id;
  ELSIF s.approver_type = 'area_manager' THEN
    -- Gestor da área da PESSOA (responsável atual; se ausente, criador)
    SELECT p.primary_area_id INTO _area FROM public.profiles p
     WHERE p.user_id = COALESCE(d.current_responsible_id, d.created_by);
    IF _area IS NULL THEN RETURN NULL; END IF;
    SELECT am.user_id INTO _r FROM public.area_manager am
     WHERE am.area_id=_area AND am.status='active'
       AND am.start_date <= CURRENT_DATE AND (am.end_date IS NULL OR am.end_date>=CURRENT_DATE)
       AND am.user_id IS DISTINCT FROM COALESCE(d.current_responsible_id, d.created_by)
     ORDER BY am.start_date DESC LIMIT 1;
    RETURN _r;
  END IF;
  RETURN NULL;
END $function$;