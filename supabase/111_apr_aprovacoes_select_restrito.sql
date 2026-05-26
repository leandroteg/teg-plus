-- 111: SELECT restrito em apr_aprovacoes
-- Antes: 'apr_select' USING(true) -> fila inteira de aprovacoes vaza
-- para qualquer autenticado (incl. RCs, contratos, pagamentos de
-- terceiros). Agora restrito a:
--   * admin (bypass total)
--   * aprovador designado (match aprovador_email x perfil.email)
--   * solicitante de RC (cmp_requisicoes)
--   * solicitante de contrato (con_solicitacoes)
-- Policy anon_approval_select_by_token (aprovacao por link publico)
-- preservada.

DROP POLICY IF EXISTS apr_select ON apr_aprovacoes;

CREATE POLICY apr_select ON apr_aprovacoes
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR lower(coalesce(aprovador_email, '')) = lower(coalesce(
      (SELECT email FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1), '_no_'))
    OR (
      modulo = 'cmp' AND EXISTS (
        SELECT 1 FROM cmp_requisicoes r
        WHERE r.id = apr_aprovacoes.entidade_id
          AND r.solicitante_id = (SELECT id FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1)
      )
    )
    OR (
      modulo = 'con' AND EXISTS (
        SELECT 1 FROM con_solicitacoes s
        WHERE s.id = apr_aprovacoes.entidade_id
          AND s.solicitante_id = (SELECT id FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1)
      )
    )
  );
