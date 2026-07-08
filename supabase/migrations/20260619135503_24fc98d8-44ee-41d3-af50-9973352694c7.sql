
-- tarefas: adiciona override para Admin/PMO
DROP POLICY IF EXISTS tarefas_select ON public.tarefas;
DROP POLICY IF EXISTS tarefas_insert ON public.tarefas;
DROP POLICY IF EXISTS tarefas_update ON public.tarefas;
DROP POLICY IF EXISTS tarefas_delete ON public.tarefas;

CREATE POLICY tarefas_select ON public.tarefas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()));

CREATE POLICY tarefas_insert ON public.tarefas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()));

CREATE POLICY tarefas_update ON public.tarefas
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()));

CREATE POLICY tarefas_delete ON public.tarefas
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()));

-- fab_drawings: adiciona override para Admin/PMO
DROP POLICY IF EXISTS fab_drawings_select ON public.fab_drawings;
DROP POLICY IF EXISTS fab_drawings_insert ON public.fab_drawings;
DROP POLICY IF EXISTS fab_drawings_update ON public.fab_drawings;
DROP POLICY IF EXISTS fab_drawings_delete ON public.fab_drawings;

CREATE POLICY fab_drawings_select ON public.fab_drawings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()));

CREATE POLICY fab_drawings_insert ON public.fab_drawings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()));

CREATE POLICY fab_drawings_update ON public.fab_drawings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()));

CREATE POLICY fab_drawings_delete ON public.fab_drawings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_or_pmo(auth.uid()));
