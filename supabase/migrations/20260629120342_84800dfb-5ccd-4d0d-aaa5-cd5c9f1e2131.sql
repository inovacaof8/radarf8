-- Revisão bruta de visibilidade para Diretor Geral, GED e pendências top-down

-- 1) Helper central: leitor global ativo (Administrador, PMO ou Diretor Geral)
CREATE OR REPLACE FUNCTION public.is_global_reader(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_active_user(_uid)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = _uid
        AND r.name IN ('Administrador','PMO','Diretor Geral')
    );
$function$;

-- 2) GED: visualização por documento passa a honrar leitor global e permissão GED view_all
CREATE OR REPLACE FUNCTION public.ged_can_view_doc(_doc_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_active_user(_user_id)
    AND (
      public.is_global_reader(_user_id)
      OR public.has_module_perm(_user_id, 'ged', ARRAY['view_all'])
      OR public.ged_is_doc_owner(_doc_id, _user_id)
      OR public.ged_has_shared_access(_doc_id, _user_id, ARRAY['read','edit'])
    );
$function$;

DROP POLICY IF EXISTS ged_document_read ON public.ged_document;
CREATE POLICY ged_document_read
ON public.ged_document
FOR SELECT
TO authenticated
USING (public.ged_can_view_doc(id, auth.uid()));

DROP POLICY IF EXISTS ged_dv_read ON public.ged_document_version;
CREATE POLICY ged_dv_read
ON public.ged_document_version
FOR SELECT
TO authenticated
USING (public.ged_can_view_doc(documento_id, auth.uid()));

DROP POLICY IF EXISTS ged_di_read ON public.ged_document_index;
CREATE POLICY ged_di_read
ON public.ged_document_index
FOR SELECT
TO authenticated
USING (public.ged_can_view_doc(documento_id, auth.uid()));

-- 3) Storage do GED: download só para quem pode ver o documento correspondente ao primeiro segmento do caminho
DROP POLICY IF EXISTS "ged storage read" ON storage.objects;
CREATE POLICY "ged storage read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ged-documents'
  AND (
    public.ged_can_view(auth.uid())
    AND (
      CASE
        WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.ged_can_view_doc(((storage.foldername(name))[1])::uuid, auth.uid())
        ELSE false
      END
    )
  )
);

-- 4) Liderados: considera Diretor Geral como global e inclui área principal + subáreas geridas
CREATE OR REPLACE FUNCTION public.user_leadership_user_ids(_leader_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.user_id
  FROM public.profiles p
  WHERE p.status = 'active'
    AND public.is_global_reader(_leader_id)

  UNION

  SELECT p.user_id
  FROM public.profiles p
  JOIN public.user_managed_areas(_leader_id) uma ON uma.area_id = p.primary_area_id
  WHERE p.status = 'active'
    AND NOT public.is_global_reader(_leader_id)

  UNION

  SELECT uam.user_id
  FROM public.user_area_membership uam
  JOIN public.user_managed_areas(_leader_id) uma ON uma.area_id = uam.area_id
  JOIN public.profiles p ON p.user_id = uam.user_id AND p.status = 'active'
  WHERE NOT public.is_global_reader(_leader_id)
    AND uam.status = 'active'
    AND uam.start_date <= CURRENT_DATE
    AND (uam.end_date IS NULL OR uam.end_date >= CURRENT_DATE)

  UNION

  SELECT ngm.user_id
  FROM public.notification_group_member ngm
  JOIN public.notification_group ng ON ng.id = ngm.group_id
  JOIN public.profiles p ON p.user_id = ngm.user_id AND p.status = 'active'
  WHERE ng.leader_user_id = _leader_id
    AND ngm.status = 'active'
    AND ng.status = 'active';
$function$;

-- 5) Pendências de reunião: leitor global vê todas; gestores veem itens atribuídos a usuários visíveis abaixo deles
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
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    ai.id,
    ai.meeting_id,
    m.title,
    ai.title,
    ai.description,
    ai.assignee_id,
    COALESCE(p.name, ai.assignee_external_name) AS assignee_name,
    p.email,
    ai.due_date,
    ai.priority,
    ai.status,
    ai.updated_at
  FROM public.meeting_action_item ai
  JOIN public.meeting m ON m.id = ai.meeting_id
  LEFT JOIN public.profiles p ON p.user_id = ai.assignee_id
  WHERE ai.promoted_to_task_id IS NULL
    AND (ai.assignee_id IS NULL OR ai.assignee_id <> _manager_id)
    AND (
      public.is_global_reader(_manager_id)
      OR m.manager_id = _manager_id
      OR m.organizer_id = _manager_id
      OR m.created_by = _manager_id
      OR (
        ai.assignee_id IS NOT NULL
        AND ai.assignee_id IN (SELECT v.user_id FROM public.users_visible_to(_manager_id) v)
      )
    );
$function$;

-- 6) Reuniões: política usa a função central que já contempla Diretor Geral
DROP POLICY IF EXISTS meeting_read ON public.meeting;
CREATE POLICY meeting_read
ON public.meeting
FOR SELECT
TO authenticated
USING (public.can_read_meeting(id, auth.uid()));

-- 7) Pendências de Meu Dia: gestores/Diretor Geral podem visualizar tarefas atribuídas aos seus usuários visíveis
DROP POLICY IF EXISTS tarefas_select ON public.tarefas;
CREATE POLICY tarefas_select
ON public.tarefas
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR auth.uid() = created_by
  OR public.is_global_reader(auth.uid())
  OR user_id IN (SELECT v.user_id FROM public.users_visible_to(auth.uid()) v)
);

-- 8) Aprovações pendentes: Diretor Geral consegue ver aprovações dos liderados quando filtrar por pessoas/áreas
DROP POLICY IF EXISTS da_read ON public.document_approval;
CREATE POLICY da_read
ON public.document_approval
FOR SELECT
TO authenticated
USING (
  public.is_global_reader(auth.uid())
  OR approver_id = auth.uid()
  OR approver_id IN (SELECT v.user_id FROM public.users_visible_to(auth.uid()) v)
  OR EXISTS (
    SELECT 1
    FROM public.document_version dv
    JOIN public.document d ON d.id = dv.document_id
    WHERE dv.id = document_approval.version_id
      AND (
        d.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.document_acl a
          WHERE a.document_id = d.id
            AND a.user_id = auth.uid()
        )
      )
  )
);