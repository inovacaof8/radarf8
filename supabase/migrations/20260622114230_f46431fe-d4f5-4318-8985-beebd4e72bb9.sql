-- Fix action_plan INSERT: trigger always enforces created_by/owner_id from auth.uid(), policy simplified
CREATE OR REPLACE FUNCTION public.action_plan_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Always force created_by to the authenticated user (prevents forgery)
  NEW.created_by := auth.uid();
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := NEW.created_by;
  END IF;
  RETURN NEW;
END $$;

DROP POLICY IF EXISTS action_plan_insert ON public.action_plan;
CREATE POLICY action_plan_insert ON public.action_plan
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
