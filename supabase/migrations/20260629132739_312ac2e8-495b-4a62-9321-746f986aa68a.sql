CREATE OR REPLACE FUNCTION public.can_read_portfolio(_portfolio_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR EXISTS (SELECT 1 FROM public.portfolio p WHERE p.id = _portfolio_id AND p.owner_id = _user_id)
      OR (
        public.has_module_perm(_user_id, 'portfolio', ARRAY['view','edit','admin'])
        AND EXISTS (
          SELECT 1 FROM public.portfolio_area pa
          WHERE pa.portfolio_id = _portfolio_id
            AND public.user_can_access_area(_user_id, pa.area_id)
        )
      )
      OR (
        public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
        AND EXISTS (SELECT 1 FROM public.project p WHERE p.portfolio_id = _portfolio_id AND p.manager_id = _user_id)
      )
      OR (
        public.has_module_perm(_user_id, 'project', ARRAY['view','edit','admin'])
        AND EXISTS (
          SELECT 1 FROM public.project p
          JOIN public.project_member pm ON pm.project_id = p.id
          WHERE p.portfolio_id = _portfolio_id AND pm.user_id = _user_id
        )
      )
    )
$function$;