-- Fix RLS para emissão de NF: compradores também precisam atualizar (#93)
DROP POLICY IF EXISTS fis_snf_update ON fis_solicitacoes_nf;
CREATE POLICY fis_snf_update ON fis_solicitacoes_nf
  FOR UPDATE
  USING (role_at_least('comprador'))
  WITH CHECK (role_at_least('comprador'));
