-- 223 — Lote enviado à aprovação sem pendência no AprovAí
--
-- A única política de INSERT em apr_aprovacoes (apr_aprovacoes_modulo_write)
-- exigia acesso ao módulo COMPRAS. Quem trabalha só no Financeiro — caso da
-- Lauany depois que saiu de Compras (02/ago) — clicava "Enviar aprovação" no
-- lote: o UPDATE do lote passava, o INSERT da aprovação era barrado pela RLS e
-- o hook nem checava o erro. Resultado: lote em 'enviado_aprovacao' e AprovAí
-- zerado para o aprovador. Aconteceu com o LP-202608-0004 em 04/ago.
--
-- Criar uma aprovação PENDENTE é só pedir decisão — não decide nada. Quem
-- decide continua preso a apr_update (role_at_least('aprovador')). Então o
-- INSERT passa a valer para qualquer usuário ativo, independente de módulo.
-- Política nova e aditiva: a de Compras continua como está.

CREATE POLICY apr_aprovacoes_insert_ativo ON apr_aprovacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid() AND p.ativo = true
    )
  );
