
-- Trigger que força created_by = auth.uid() em qualquer insert na meeting
CREATE OR REPLACE FUNCTION public.meeting_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;
  NEW.created_by := auth.uid();
  IF NEW.organizer_id IS NULL THEN
    NEW.organizer_id := auth.uid();
  END IF;
  IF NEW.manager_id IS NULL THEN
    NEW.manager_id := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_meeting_set_created_by ON public.meeting;
CREATE TRIGGER trg_meeting_set_created_by
BEFORE INSERT ON public.meeting
FOR EACH ROW EXECUTE FUNCTION public.meeting_set_created_by();

-- Relaxar a policy de INSERT: basta estar autenticado (created_by é setado pelo trigger)
DROP POLICY IF EXISTS meeting_insert ON public.meeting;
CREATE POLICY meeting_insert ON public.meeting
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
