
-- Auto-assign created_by from auth.uid() and simplify INSERT policy
CREATE OR REPLACE FUNCTION public.action_plan_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := NEW.created_by;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_action_plan_set_created_by ON public.action_plan;
CREATE TRIGGER trg_action_plan_set_created_by
BEFORE INSERT ON public.action_plan
FOR EACH ROW EXECUTE FUNCTION public.action_plan_set_created_by();

DROP POLICY IF EXISTS action_plan_insert ON public.action_plan;
CREATE POLICY action_plan_insert ON public.action_plan
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    created_by = auth.uid()
    OR public.is_admin_or_pmo(auth.uid())
  )
);
