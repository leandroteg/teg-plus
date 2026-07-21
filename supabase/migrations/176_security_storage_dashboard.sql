-- 176_security_storage_dashboard.sql
-- Fase 4 (parcial via SQL): Storage hardening + notas de dashboard Auth.
--
-- DASHBOARD MANUAL (nao aplicavel via migration):
--   Supabase Dashboard -> Authentication -> Providers -> Email
--   -> Habilitar "Leaked password protection" (HaveIBeenPwned)
--
-- Bucket endomarketing: leitura publica intencional (imagens de IA no mural).
-- Advisor public_bucket_allows_listing e aceito para esse bucket.

-- fro-checklist-fotos: restringe listagem/leitura via API a usuarios do modulo frotas
DROP POLICY IF EXISTS "fro_checklist_fotos_select" ON storage.objects;
CREATE POLICY "fro_checklist_fotos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fro-checklist-fotos'
    AND public.can_access_modulo('frotas', auth.uid())
  );

-- service_role e uploads n8n/backend continuam com acesso total ao bucket
DROP POLICY IF EXISTS "fro_checklist_fotos_service" ON storage.objects;
CREATE POLICY "fro_checklist_fotos_service" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'fro-checklist-fotos')
  WITH CHECK (bucket_id = 'fro-checklist-fotos');
