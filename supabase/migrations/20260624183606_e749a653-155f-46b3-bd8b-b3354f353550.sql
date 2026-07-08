CREATE OR REPLACE FUNCTION public.users_visible_to(_user_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin/PMO veem todos os usuários ativos
  SELECT p.user_id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND public.is_admin_or_pmo(_user_id)
  UNION
  -- Demais: usuários que compartilham qualquer área visível (gerenciada ou de membership) com o solicitante
  SELECT DISTINCT p.user_id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND NOT public.is_admin_or_pmo(_user_id)
    AND (
      -- Mesmo solicitante sempre se vê
      p.user_id = _user_id
      -- Por primary_area do alvo dentro das áreas visíveis do solicitante
      OR (
        p.primary_area_id IS NOT NULL
        AND p.primary_area_id IN (SELECT area_id FROM public.user_visible_areas(_user_id))
      )
      -- Por membership ativo do alvo em qualquer área visível do solicitante
      OR EXISTS (
        SELECT 1
        FROM public.user_area_membership uam
        WHERE uam.user_id = p.user_id
          AND uam.status = 'active'
          AND uam.start_date <= CURRENT_DATE
          AND (uam.end_date IS NULL OR uam.end_date >= CURRENT_DATE)
          AND uam.area_id IN (SELECT area_id FROM public.user_visible_areas(_user_id))
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.users_visible_to(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.users_visible_to(uuid) TO service_role;