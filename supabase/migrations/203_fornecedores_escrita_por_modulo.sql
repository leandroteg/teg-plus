-- 203_fornecedores_escrita_por_modulo.sql
-- Cadastro/edição de fornecedor barrado por RLS p/ papel requisitante (03/ago:
-- "new row violates row-level security policy for table cmp_fornecedores" no
-- Pagamento Extraordinário). As telas que cadastram fornecedor inline (Pedido
-- Direto/Compras, Pagamento Extraordinário/Financeiro, Cadastros) já são
-- gateadas por módulo — a RLS passa a espelhar isso.
-- Escrita: quem acessa módulo compras OU financeiro (além dos papéis ≥ gestor
-- das policies existentes, que permanecem). DELETE segue só gerente+.
-- Idempotente.

DROP POLICY IF EXISTS cmp_forn_insert_modulo ON public.cmp_fornecedores;
CREATE POLICY cmp_forn_insert_modulo ON public.cmp_fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_modulo('compras', auth.uid())
    OR public.can_access_modulo('financeiro', auth.uid())
  );

DROP POLICY IF EXISTS cmp_forn_update_modulo ON public.cmp_fornecedores;
CREATE POLICY cmp_forn_update_modulo ON public.cmp_fornecedores
  FOR UPDATE TO authenticated
  USING (
    public.can_access_modulo('compras', auth.uid())
    OR public.can_access_modulo('financeiro', auth.uid())
  )
  WITH CHECK (
    public.can_access_modulo('compras', auth.uid())
    OR public.can_access_modulo('financeiro', auth.uid())
  );

-- Anexos de documentos do fornecedor (Cartão CNPJ etc.) acompanham a mesma regra.
DROP POLICY IF EXISTS cmp_forn_anexos_insert_modulo ON public.cmp_fornecedor_anexos;
CREATE POLICY cmp_forn_anexos_insert_modulo ON public.cmp_fornecedor_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_modulo('compras', auth.uid())
    OR public.can_access_modulo('financeiro', auth.uid())
  );

DROP POLICY IF EXISTS cmp_forn_anexos_update_modulo ON public.cmp_fornecedor_anexos;
CREATE POLICY cmp_forn_anexos_update_modulo ON public.cmp_fornecedor_anexos
  FOR UPDATE TO authenticated
  USING (
    public.can_access_modulo('compras', auth.uid())
    OR public.can_access_modulo('financeiro', auth.uid())
  )
  WITH CHECK (
    public.can_access_modulo('compras', auth.uid())
    OR public.can_access_modulo('financeiro', auth.uid())
  );
