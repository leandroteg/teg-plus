-- =============================================================================
-- 069 · Amplia acesso da conciliação de cartões para usuários do Financeiro
-- =============================================================================
--
-- Problema:
-- - A conciliação de cartões precisa enxergar e vincular apontamentos de vários
--   colaboradores.
-- - As policies atuais liberavam esse fluxo completo apenas para cargos
--   administrativos/diretoria, o que bloqueia analistas do Financeiro.
--
-- Solução:
-- - Usuário comum continua vendo/editando apenas os próprios rascunhos.
-- - Usuários com acesso ao módulo financeiro passam a:
--   1. visualizar todos os apontamentos de cartão
--   2. atualizar apontamentos durante a conciliação
--   3. manipular faturas e itens de fatura no fluxo operacional

-- ── fin_apontamentos_cartao: visão total para Financeiro ─────────────────────
DROP POLICY IF EXISTS "apontamentos_select_own" ON fin_apontamentos_cartao;
CREATE POLICY "apontamentos_select_own" ON fin_apontamentos_cartao
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR can_access_modulo('financeiro', auth.uid())
  );

-- ── fin_apontamentos_cartao: conciliação cross-user para Financeiro ──────────
DROP POLICY IF EXISTS "apontamentos_update_own" ON fin_apontamentos_cartao;
CREATE POLICY "apontamentos_update_own" ON fin_apontamentos_cartao
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'rascunho')
    OR can_access_modulo('financeiro', auth.uid())
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'rascunho')
    OR can_access_modulo('financeiro', auth.uid())
  );

-- ── fin_faturas_cartao: operação de upload/processamento para Financeiro ─────
DROP POLICY IF EXISTS "faturas_admin" ON fin_faturas_cartao;
CREATE POLICY "faturas_admin" ON fin_faturas_cartao
  FOR ALL TO authenticated
  USING (
    can_access_modulo('financeiro', auth.uid())
  )
  WITH CHECK (
    can_access_modulo('financeiro', auth.uid())
  );

-- ── fin_itens_fatura_cartao: vínculo/desvínculo para Financeiro ──────────────
DROP POLICY IF EXISTS "itens_fatura_admin" ON fin_itens_fatura_cartao;
CREATE POLICY "itens_fatura_admin" ON fin_itens_fatura_cartao
  FOR ALL TO authenticated
  USING (
    can_access_modulo('financeiro', auth.uid())
  )
  WITH CHECK (
    can_access_modulo('financeiro', auth.uid())
  );
