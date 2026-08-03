-- ─────────────────────────────────────────────────────────────────────────────
-- 201: Bucket p/ comprovantes de apontamentos de cartão corporativo
-- O modal de Novo Apontamento tinha o campo de comprovante como placeholder
-- (sem upload). Bucket público (URL direta em comprovante_url, mesmo padrão
-- do bucket notas-fiscais usado pelo Financeiro).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('cartoes-comprovantes', 'cartoes-comprovantes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "cartoes-comprovantes-read" ON storage.objects;
CREATE POLICY "cartoes-comprovantes-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cartoes-comprovantes');

DROP POLICY IF EXISTS "cartoes-comprovantes-write" ON storage.objects;
CREATE POLICY "cartoes-comprovantes-write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cartoes-comprovantes');

DROP POLICY IF EXISTS "cartoes-comprovantes-delete" ON storage.objects;
CREATE POLICY "cartoes-comprovantes-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cartoes-comprovantes');
