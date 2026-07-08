CREATE OR REPLACE FUNCTION public.user_can_manage_area(_user_id uuid, _area_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.user_manages_area(_user_id, _area_id)
    OR (
      public.has_role(_user_id, 'Gestor')
      AND EXISTS (
        SELECT 1
        FROM public.user_area_membership uam
        WHERE uam.user_id = _user_id
          AND uam.area_id = _area_id
          AND uam.status = 'active'
          AND uam.start_date <= CURRENT_DATE
          AND (uam.end_date IS NULL OR uam.end_date >= CURRENT_DATE)
      )
    )
$$;