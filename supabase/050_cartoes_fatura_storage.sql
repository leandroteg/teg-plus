-- =============================================================================
-- 050 - Storage para faturas de cartao
-- Cria bucket privado e policies para upload manual de faturas (PDF/imagem)
-- consumidas pelo fluxo de Conciliacao de Cartoes via n8n.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'faturas-cartao',
  'faturas-cartao',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "faturas_cartao_storage_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'faturas-cartao');

CREATE POLICY IF NOT EXISTS "faturas_cartao_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'faturas-cartao');

CREATE POLICY IF NOT EXISTS "faturas_cartao_storage_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'faturas-cartao')
  WITH CHECK (bucket_id = 'faturas-cartao');
