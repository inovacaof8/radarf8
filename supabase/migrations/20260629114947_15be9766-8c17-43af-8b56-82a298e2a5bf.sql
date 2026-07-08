
-- 1) Nova permissão
INSERT INTO public.permissions (module, action, description)
VALUES ('ged', 'view_all', 'Visualizar todos os documentos do GED (de todos os usuários)')
ON CONFLICT (module, action) DO NOTHING;

-- 2) Concede para Administrador, PMO e Diretor Geral
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.module = 'ged' AND p.action = 'view_all'
  AND r.name IN ('Administrador','PMO','Diretor Geral')
ON CONFLICT DO NOTHING;

-- 3) Atualiza função de leitura para honrar a nova permissão
CREATE OR REPLACE FUNCTION public.ged_can_view_doc(_doc_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_admin_or_pmo(_user_id)
    OR public.has_module_perm(_user_id, 'ged', ARRAY['view_all'])
    OR public.ged_is_doc_owner(_doc_id, _user_id)
    OR public.ged_has_shared_access(_doc_id, _user_id, ARRAY['read','edit']);
$function$;
