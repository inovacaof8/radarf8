DROP POLICY IF EXISTS portfolio_area_insert ON public.portfolio_area;
DROP POLICY IF EXISTS portfolio_area_update ON public.portfolio_area;
DROP POLICY IF EXISTS portfolio_area_delete ON public.portfolio_area;

CREATE POLICY portfolio_area_insert ON public.portfolio_area FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.can_edit_portfolio(portfolio_id, auth.uid())
    AND public.user_can_manage_area(auth.uid(), area_id)
  )
);

CREATE POLICY portfolio_area_update ON public.portfolio_area FOR UPDATE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.can_edit_portfolio(portfolio_id, auth.uid())
    AND public.user_can_manage_area(auth.uid(), area_id)
  )
)
WITH CHECK (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.can_edit_portfolio(portfolio_id, auth.uid())
    AND public.user_can_manage_area(auth.uid(), area_id)
  )
);

CREATE POLICY portfolio_area_delete ON public.portfolio_area FOR DELETE TO authenticated
USING (
  public.is_admin_or_pmo(auth.uid())
  OR (
    public.can_edit_portfolio(portfolio_id, auth.uid())
    AND public.user_can_manage_area(auth.uid(), area_id)
  )
);