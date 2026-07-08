DROP POLICY IF EXISTS action_plan_select ON public.action_plan;

CREATE POLICY action_plan_select
ON public.action_plan
FOR SELECT
TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR public.is_reader(auth.uid())
  OR owner_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_action_plan_member(id, auth.uid(), NULL)
  OR public.manages_action_plan_area(id, auth.uid())
);

CREATE OR REPLACE FUNCTION public.action_plan_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.created_by := auth.uid();
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := NEW.created_by;
  END IF;
  RETURN NEW;
END
$function$;

DROP POLICY IF EXISTS action_plan_insert ON public.action_plan;

CREATE POLICY action_plan_insert
ON public.action_plan
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND (owner_id IS NULL OR owner_id = auth.uid() OR public.is_admin_or_pmo(auth.uid()))
);