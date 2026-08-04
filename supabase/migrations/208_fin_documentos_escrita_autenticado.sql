-- 208_fin_documentos_escrita_autenticado.sql
-- Anexo de documento financeiro falhava para o usuário final (04/ago: "Nova
-- Previsão de Pagamento salva mas retorna erro ao anexar"). O arquivo subia ao
-- bucket financeiro-docs, mas o INSERT em fin_documentos batia na RLS: a única
-- policy de escrita (fin_docs_write) era TO service_role, e o frontend escreve
-- como `authenticated`.
--
-- Passa a espelhar a regra já usada em cmp_fornecedores (mig 203): escreve quem
-- acessa o módulo financeiro OU compras. Leitura segue liberada p/ autenticado.
-- DELETE fica restrito a gerente+ (documento fiscal não some por acidente).
-- Idempotente.

DROP POLICY IF EXISTS fin_docs_insert_modulo ON public.fin_documentos;
CREATE POLICY fin_docs_insert_modulo ON public.fin_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_modulo('financeiro', auth.uid())
    OR public.can_access_modulo('compras', auth.uid())
  );

DROP POLICY IF EXISTS fin_docs_update_modulo ON public.fin_documentos;
CREATE POLICY fin_docs_update_modulo ON public.fin_documentos
  FOR UPDATE TO authenticated
  USING (
    public.can_access_modulo('financeiro', auth.uid())
    OR public.can_access_modulo('compras', auth.uid())
  )
  WITH CHECK (
    public.can_access_modulo('financeiro', auth.uid())
    OR public.can_access_modulo('compras', auth.uid())
  );

DROP POLICY IF EXISTS fin_docs_delete_gerente ON public.fin_documentos;
CREATE POLICY fin_docs_delete_gerente ON public.fin_documentos
  FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));
