
-- ENUMS
DO $$ BEGIN CREATE TYPE public.notification_type AS ENUM ('comunicado','orientacao','procedimento','alerta','convocacao','atualizacao','informacao_administrativa','outro'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_priority AS ENUM ('baixa','normal','alta','urgente'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_status AS ENUM ('rascunho','agendada','enviada','cancelada','arquivada'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_delivery_status AS ENUM ('pendente','entregue','nao_entregue'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_ack_status AS ENUM ('nao_lida','visualizada','ciencia_pendente','ciencia_confirmada','ciencia_vencida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_group_type AS ENUM ('permanente','temporario','area','projeto','operacao'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_reminder_frequency AS ENUM ('unico','diario','dois_dias','semanal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================
-- TABLE: notification_group
-- =============================
CREATE TABLE IF NOT EXISTS public.notification_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  area_id uuid REFERENCES public.area(id) ON DELETE SET NULL,
  leader_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  group_type public.notification_group_type NOT NULL DEFAULT 'permanente',
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_group TO authenticated;
GRANT ALL ON public.notification_group TO service_role;
ALTER TABLE public.notification_group ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notification_group_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.notification_group(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_group_member TO authenticated;
GRANT ALL ON public.notification_group_member TO service_role;
ALTER TABLE public.notification_group_member ENABLE ROW LEVEL SECURITY;

-- =============================
-- HELPER FUNCTIONS
-- =============================
CREATE OR REPLACE FUNCTION public.is_leader(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_or_pmo(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.area_manager
      WHERE user_id = _user_id AND status = 'active'
        AND start_date <= CURRENT_DATE
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    )
    OR EXISTS (
      SELECT 1 FROM public.notification_group
      WHERE leader_user_id = _user_id AND status = 'active'
    )
$$;

CREATE OR REPLACE FUNCTION public.user_leadership_user_ids(_leader_id uuid)
RETURNS TABLE(user_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id FROM public.profiles p
  WHERE public.is_admin_or_pmo(_leader_id) AND p.status = 'active'
  UNION
  SELECT uam.user_id
  FROM public.user_area_membership uam
  JOIN public.user_managed_areas(_leader_id) uma ON uma.area_id = uam.area_id
  WHERE uam.status = 'active'
  UNION
  SELECT ngm.user_id
  FROM public.notification_group_member ngm
  JOIN public.notification_group ng ON ng.id = ngm.group_id
  WHERE ng.leader_user_id = _leader_id
    AND ngm.status = 'active'
    AND ng.status = 'active'
$$;

-- POLICIES: notification_group
CREATE POLICY ng_select ON public.notification_group FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR leader_user_id = auth.uid()
  OR created_by = auth.uid()
  OR (area_id IS NOT NULL AND public.user_manages_area(auth.uid(), area_id))
);
CREATE POLICY ng_insert ON public.notification_group FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (area_id IS NULL OR public.user_manages_area(auth.uid(), area_id))
);
CREATE POLICY ng_update ON public.notification_group FOR UPDATE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR leader_user_id = auth.uid()
  OR created_by = auth.uid()
  OR (area_id IS NOT NULL AND public.user_manages_area(auth.uid(), area_id))
);
CREATE POLICY ng_delete ON public.notification_group FOR DELETE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()) OR created_by = auth.uid());

CREATE TRIGGER trg_notification_group_updated_at
BEFORE UPDATE ON public.notification_group
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- POLICIES: notification_group_member
CREATE POLICY ngm_select ON public.notification_group_member FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.notification_group g
    WHERE g.id = group_id
      AND (g.leader_user_id = auth.uid() OR g.created_by = auth.uid()
           OR (g.area_id IS NOT NULL AND public.user_manages_area(auth.uid(), g.area_id)))
  )
);
CREATE POLICY ngm_modify ON public.notification_group_member FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.notification_group g
    WHERE g.id = group_id
      AND (g.leader_user_id = auth.uid() OR g.created_by = auth.uid()
           OR (g.area_id IS NOT NULL AND public.user_manages_area(auth.uid(), g.area_id)))
  )
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.notification_group g
    WHERE g.id = group_id
      AND (g.leader_user_id = auth.uid() OR g.created_by = auth.uid()
           OR (g.area_id IS NOT NULL AND public.user_manages_area(auth.uid(), g.area_id)))
  )
);

-- =============================
-- TABLE: notification
-- =============================
CREATE SEQUENCE IF NOT EXISTS public.notification_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  title text NOT NULL,
  message text NOT NULL,
  notification_type public.notification_type NOT NULL DEFAULT 'comunicado',
  priority public.notification_priority NOT NULL DEFAULT 'normal',
  sender_user_id uuid NOT NULL REFERENCES auth.users(id),
  sender_area_id uuid REFERENCES public.area(id),
  publication_date timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  acknowledgment_deadline timestamptz,
  status public.notification_status NOT NULL DEFAULT 'rascunho',
  requires_acknowledgment boolean NOT NULL DEFAULT true,
  reminder_enabled boolean NOT NULL DEFAULT false,
  reminder_frequency public.notification_reminder_frequency,
  internal_notes text,
  current_version int NOT NULL DEFAULT 1,
  sent_at timestamptz,
  canceled_at timestamptz,
  canceled_by uuid REFERENCES auth.users(id),
  cancellation_reason text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification TO authenticated;
GRANT ALL ON public.notification TO service_role;
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notification_recipient (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notification(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text,
  source_id uuid,
  delivery_status public.notification_delivery_status NOT NULL DEFAULT 'pendente',
  delivered_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  acknowledgment_status public.notification_ack_status NOT NULL DEFAULT 'nao_lida',
  acknowledged_at timestamptz,
  acknowledged_ip text,
  acknowledged_user_agent text,
  acknowledged_version int,
  acknowledged_after_deadline boolean DEFAULT false,
  reminder_count int NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_recipient TO authenticated;
GRANT ALL ON public.notification_recipient TO service_role;
ALTER TABLE public.notification_recipient ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notification_attachment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notification(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_attachment TO authenticated;
GRANT ALL ON public.notification_attachment TO service_role;
ALTER TABLE public.notification_attachment ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notification_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notification(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  change_reason text,
  requires_new_acknowledgment boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, version_number)
);
GRANT SELECT, INSERT ON public.notification_version TO authenticated;
GRANT ALL ON public.notification_version TO service_role;
ALTER TABLE public.notification_version ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notification_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notification(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES auth.users(id),
  recipient_count int NOT NULL DEFAULT 0,
  reminder_type text NOT NULL DEFAULT 'manual',
  channel text NOT NULL DEFAULT 'in_app',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notification_reminder_log TO authenticated;
GRANT ALL ON public.notification_reminder_log TO service_role;
ALTER TABLE public.notification_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notification(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notification_audit TO authenticated;
GRANT ALL ON public.notification_audit TO service_role;
ALTER TABLE public.notification_audit ENABLE ROW LEVEL SECURITY;

-- TRIGGERS & FUNCTIONS for notification
CREATE OR REPLACE FUNCTION public.notification_set_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'NT-' || LPAD(nextval('public.notification_code_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_notification_code BEFORE INSERT ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.notification_set_code();

CREATE TRIGGER trg_notification_updated_at BEFORE UPDATE ON public.notification
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_notification_recipient_updated_at BEFORE UPDATE ON public.notification_recipient
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Immutability of confirmed acknowledgment
CREATE OR REPLACE FUNCTION public.notification_recipient_immutable_ack()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.acknowledgment_status = 'ciencia_confirmada'
     AND OLD.acknowledged_at IS NOT NULL THEN
    IF NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at
       OR NEW.acknowledgment_status <> 'ciencia_confirmada'
       OR NEW.acknowledged_version IS DISTINCT FROM OLD.acknowledged_version THEN
      RAISE EXCEPTION 'A confirmação de ciência não pode ser alterada após registrada.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_nr_immutable_ack BEFORE UPDATE ON public.notification_recipient
FOR EACH ROW EXECUTE FUNCTION public.notification_recipient_immutable_ack();

-- POLICIES: notification
CREATE POLICY n_select ON public.notification FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR sender_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.notification_recipient r WHERE r.notification_id = id AND r.user_id = auth.uid())
);
CREATE POLICY n_insert ON public.notification FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND (public.is_admin_or_pmo(auth.uid()) OR public.is_leader(auth.uid()))
);
CREATE POLICY n_update ON public.notification FOR UPDATE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()) OR sender_user_id = auth.uid());
CREATE POLICY n_delete ON public.notification FOR DELETE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()) AND status = 'rascunho');

-- POLICIES: notification_recipient
CREATE POLICY nr_select ON public.notification_recipient FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
);
CREATE POLICY nr_insert ON public.notification_recipient FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
);
CREATE POLICY nr_update_recipient ON public.notification_recipient FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY nr_update_admin ON public.notification_recipient FOR UPDATE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
);
CREATE POLICY nr_delete_admin ON public.notification_recipient FOR DELETE TO authenticated
USING (public.is_admin_or_pmo(auth.uid()));

-- POLICIES: notification_attachment
CREATE POLICY na_select ON public.notification_attachment FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.notification n
    WHERE n.id = notification_id
      AND (n.sender_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.notification_recipient r WHERE r.notification_id = n.id AND r.user_id = auth.uid()))
  )
);
CREATE POLICY na_modify ON public.notification_attachment FOR ALL TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
) WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
);

-- POLICIES: notification_version
CREATE POLICY nv_select ON public.notification_version FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.notification n
    WHERE n.id = notification_id
      AND (n.sender_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.notification_recipient r WHERE r.notification_id = n.id AND r.user_id = auth.uid()))
  )
);
CREATE POLICY nv_insert ON public.notification_version FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
);

-- POLICIES: notification_reminder_log
CREATE POLICY nrl_select ON public.notification_reminder_log FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
);
CREATE POLICY nrl_insert ON public.notification_reminder_log FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
);

-- POLICIES: notification_audit
CREATE POLICY na_audit_select ON public.notification_audit FOR SELECT TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR EXISTS (SELECT 1 FROM public.notification n WHERE n.id = notification_id AND n.sender_user_id = auth.uid())
);
CREATE POLICY na_audit_insert ON public.notification_audit FOR INSERT TO authenticated
WITH CHECK (true);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_nr_user_status ON public.notification_recipient(user_id, acknowledgment_status);
CREATE INDEX IF NOT EXISTS idx_nr_notification ON public.notification_recipient(notification_id);
CREATE INDEX IF NOT EXISTS idx_n_sender ON public.notification(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_n_status ON public.notification(status);
CREATE INDEX IF NOT EXISTS idx_ngm_group ON public.notification_group_member(group_id);
CREATE INDEX IF NOT EXISTS idx_ngm_user ON public.notification_group_member(user_id);
