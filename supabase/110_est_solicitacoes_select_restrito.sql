-- 110: SELECT restrito em est_solicitacoes / est_solicitacao_itens
-- Antes: USING(true) -> qualquer autenticado via tudo (vazamento informacional).
-- Agora: dono (solicitante_id) OU triador (lotado em CD com faz_triagem) OU admin.
-- Helper is_triador() (SECURITY DEFINER) consultado pelas duas policies.

CREATE OR REPLACE FUNCTION public.is_triador()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM sys_perfis p
    JOIN est_bases b ON b.id = p.base_id
    WHERE p.auth_id = auth.uid()
      AND p.ativo = true
      AND b.faz_triagem = true
  );
$function$;
GRANT EXECUTE ON FUNCTION public.is_triador() TO authenticated;

DROP POLICY IF EXISTS auth_read_sol ON est_solicitacoes;
DROP POLICY IF EXISTS est_sol_select ON est_solicitacoes;
CREATE POLICY est_sol_select ON est_solicitacoes
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_triador()
    OR solicitante_id = (SELECT id FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1)
  );

DROP POLICY IF EXISTS auth_read_sol_itens ON est_solicitacao_itens;
DROP POLICY IF EXISTS est_si_select ON est_solicitacao_itens;
CREATE POLICY est_si_select ON est_solicitacao_itens
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_triador()
    OR EXISTS (
      SELECT 1 FROM est_solicitacoes s
      WHERE s.id = est_solicitacao_itens.solicitacao_id
        AND s.solicitante_id = (SELECT id FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1)
    )
  );
