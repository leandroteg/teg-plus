-- =============================================================================
-- 064 · Corrige RLS de fin_faturas_cartao para incluir roles administrador/diretor
-- =============================================================================

DROP POLICY IF EXISTS "faturas_admin" ON fin_faturas_cartao;
CREATE POLICY "faturas_admin" ON fin_faturas_cartao
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
