-- ─────────────────────────────────────────────────────────────────────────────
-- 20260804000001_fin_documentos_aceita_adiantamento.sql
--
-- "Falha ao anexar" no adiantamento: o arquivo SUBIA para o storage e o registro
-- em fin_documentos era barrado — entity_type só aceitava cp/cr/pedido.
-- (O campo `tipo` também não tem 'doc_financeiro'; o código passou a usar 'outro'.)
--
-- Inclui o resgate dos anexos que ficaram órfãos no bucket: o id do adiantamento
-- está no próprio path (adiantamento/<id>/<arquivo>).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fin_documentos DROP CONSTRAINT IF EXISTS fin_documentos_entity_type_check;
ALTER TABLE public.fin_documentos ADD CONSTRAINT fin_documentos_entity_type_check
  CHECK (entity_type::text = ANY (ARRAY['cp','cr','pedido','adiantamento']::text[]));

INSERT INTO public.fin_documentos (entity_type, entity_id, tipo, nome_arquivo, arquivo_url, mime_type, tamanho_bytes, uploaded_at)
SELECT 'adiantamento',
       (split_part(o.name, '/', 2))::uuid,
       'outro',
       split_part(o.name, '/', 3),
       'https://uzfjfucrinokeuwpbeie.supabase.co/storage/v1/object/public/financeiro-docs/' || o.name,
       o.metadata->>'mimetype',
       (o.metadata->>'size')::bigint,
       o.created_at
FROM storage.objects o
WHERE o.bucket_id = 'financeiro-docs'
  AND o.name LIKE 'adiantamento/%'
  AND split_part(o.name, '/', 2) ~ '^[0-9a-f-]{36}$'
  AND EXISTS (SELECT 1 FROM desp_adiantamentos a WHERE a.id = (split_part(o.name, '/', 2))::uuid)
  AND NOT EXISTS (
    SELECT 1 FROM fin_documentos d
    WHERE d.entity_type = 'adiantamento' AND d.arquivo_url LIKE '%' || o.name
  );
