-- 207_financeiro_docs_bucket.sql
-- Bucket para anexos de documentos financeiros (NF, boleto, outros) ligados a
-- uma CP — usado pela Nova Previsão de Pagamento e pela Solicitação
-- Extraordinária. O código apontava para 'tesouraria-extratos', bucket que
-- NUNCA existiu: todo upload falhava em silêncio (a falha só aparecia como
-- texto nas observações). Público, mesmo padrão de notas-fiscais/pedidos-anexos,
-- porque as telas leem por getPublicUrl.

INSERT INTO storage.buckets (id, name, public)
VALUES ('financeiro-docs', 'financeiro-docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "financeiro-docs-read" ON storage.objects;
CREATE POLICY "financeiro-docs-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'financeiro-docs');

DROP POLICY IF EXISTS "financeiro-docs-write" ON storage.objects;
CREATE POLICY "financeiro-docs-write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'financeiro-docs');

DROP POLICY IF EXISTS "financeiro-docs-delete" ON storage.objects;
CREATE POLICY "financeiro-docs-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'financeiro-docs');
