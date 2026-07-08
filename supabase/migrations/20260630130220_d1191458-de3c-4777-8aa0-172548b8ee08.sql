-- Fast-path direto na policy SELECT da meeting para criador/organizador/gestor.
-- Evita a falha no INSERT ... RETURNING quando o cliente usa .insert().select(),
-- onde a chamada à função can_read_meeting não resolve corretamente sobre o NEW.

DROP POLICY IF EXISTS meeting_read ON public.meeting;

CREATE POLICY meeting_read ON public.meeting
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR organizer_id = auth.uid()
  OR manager_id = auth.uid()
  OR public.can_read_meeting(id, auth.uid())
);