-- =============================================================================
-- 065 · Corrige RLS de conciliação para incluir roles administrador/diretor
-- =============================================================================

-- ── fin_itens_fatura_cartao ────────────────────────────────────────────────
DROP POLICY IF EXISTS "itens_fatura_admin" ON fin_itens_fatura_cartao;
CREATE POLICY "itens_fatura_admin" ON fin_itens_fatura_cartao
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'gerente', 'administrador', 'diretor')
        AND ativo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sys_perfis
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'gerente', 'administrador', 'diretor')
        AND ativo = true
    )
  );

-- ── fin_apontamentos_cartao (update cross-user) ────────────────────────────
DROP POLICY IF EXISTS "apontamentos_update_own" ON fin_apontamentos_cartao;
CREATE POLICY "apontamentos_update_own" ON fin_apontamentos_cartao
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sys_perfis
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'gerente', 'administrador', 'diretor')
        AND ativo = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sys_perfis
      WHERE auth_id = auth.uid()
        AND role IN ('admin', 'gerente', 'administrador', 'diretor')
        AND ativo = true
    )
  );
