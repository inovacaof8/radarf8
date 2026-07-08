
-- Fix: .insert().select() retornava 42501 para portfolio/program/project porque
-- a SELECT policy delegava para can_read_* que faz EXISTS na própria tabela
-- (a linha recém-inserida não fica visível dentro do RETURNING). Adiciona check
-- direto em owner/manager para destravar o RETURNING.

DROP POLICY IF EXISTS portfolio_read ON public.portfolio;
CREATE POLICY portfolio_read ON public.portfolio
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.can_read_portfolio(id, auth.uid())
  );

DROP POLICY IF EXISTS program_read ON public.program;
CREATE POLICY program_read ON public.program
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.can_read_program(id, auth.uid())
  );

DROP POLICY IF EXISTS project_read ON public.project;
CREATE POLICY project_read ON public.project
  FOR SELECT TO authenticated
  USING (
    manager_id = auth.uid()
    OR public.can_read_project(id, auth.uid())
  );
