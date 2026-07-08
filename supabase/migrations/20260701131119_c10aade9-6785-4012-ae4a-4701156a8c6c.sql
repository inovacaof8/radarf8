ALTER TABLE public.workflow_steps DROP CONSTRAINT IF EXISTS workflow_steps_check;
ALTER TABLE public.workflow_steps ADD CONSTRAINT workflow_steps_check CHECK (
  (NOT requires_approval) OR (
    approver_type IS NOT NULL AND (
      (approver_type = 'user' AND approver_user_id IS NOT NULL)
      OR (approver_type = 'area_manager')
      OR (approver_type = 'configured' AND approver_user_id IS NOT NULL)
    )
  )
);