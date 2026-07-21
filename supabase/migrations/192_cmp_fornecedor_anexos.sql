-- ─────────────────────────────────────────────────────────────────────────────
-- 192_cmp_fornecedor_anexos.sql
--
-- Anexos de documentos no cadastro de fornecedor + base para a regra
-- "CNPJ exige Cartão CNPJ atualizado" (enforço no frontend nesta fase — homolog
-- instável; bloqueio hard no banco fica como evolução).
--
-- Decisões (ver conversa 2026-07-17):
--   • Bloqueio: só no cadastro NOVO de CNPJ (14 dígitos). Legados (1.284) seguem
--     funcionando e aparecem como "pendente" para regularização gradual.
--   • Validade do Cartão CNPJ: 90 dias (exige data_emissao no upload).
--   • Tipos: Cartão CNPJ (obrigatório) + CND Federal, FGTS, Trabalhista,
--     Contrato Social, Outro (disponíveis, não obrigatórios).
--
-- Migration PURAMENTE ADITIVA: não altera cmp_fornecedores nem sua RLS, então
-- nenhum insert/update existente pode quebrar em prod.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Bucket privado (leitura via signed URL server-side)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fornecedores-docs', 'fornecedores-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fornecedores-docs-read" ON storage.objects;
CREATE POLICY "fornecedores-docs-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fornecedores-docs');

DROP POLICY IF EXISTS "fornecedores-docs-write" ON storage.objects;
CREATE POLICY "fornecedores-docs-write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fornecedores-docs');

DROP POLICY IF EXISTS "fornecedores-docs-delete" ON storage.objects;
CREATE POLICY "fornecedores-docs-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fornecedores-docs');

-- 2) Tabela de anexos
CREATE TABLE IF NOT EXISTS public.cmp_fornecedor_anexos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id   uuid NOT NULL REFERENCES public.cmp_fornecedores(id) ON DELETE CASCADE,
  tipo            text NOT NULL DEFAULT 'outro'
                    CHECK (tipo IN ('cartao_cnpj','cnd_federal','fgts','trabalhista','contrato_social','outro')),
  storage_path    text NOT NULL UNIQUE,
  nome            text NOT NULL,
  mime            text,
  tamanho_bytes   bigint,
  data_emissao    date,            -- exigida para cartao_cnpj (regra dos 90 dias)
  criado_em       timestamptz NOT NULL DEFAULT now(),
  criado_por_nome text,
  atualizado_por_nome text
);

CREATE INDEX IF NOT EXISTS idx_cmp_forn_anexos_fornecedor
  ON public.cmp_fornecedor_anexos (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_cmp_forn_anexos_tipo
  ON public.cmp_fornecedor_anexos (fornecedor_id, tipo);

-- 3) RLS espelhando cmp_fornecedores (read: todos autenticados; escrita: comprador+)
ALTER TABLE public.cmp_fornecedor_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cmp_forn_anexos_read   ON public.cmp_fornecedor_anexos;
DROP POLICY IF EXISTS cmp_forn_anexos_insert ON public.cmp_fornecedor_anexos;
DROP POLICY IF EXISTS cmp_forn_anexos_update ON public.cmp_fornecedor_anexos;
DROP POLICY IF EXISTS cmp_forn_anexos_delete ON public.cmp_fornecedor_anexos;

CREATE POLICY cmp_forn_anexos_read ON public.cmp_fornecedor_anexos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY cmp_forn_anexos_insert ON public.cmp_fornecedor_anexos
  FOR INSERT TO authenticated WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY cmp_forn_anexos_update ON public.cmp_fornecedor_anexos
  FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador'))
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY cmp_forn_anexos_delete ON public.cmp_fornecedor_anexos
  FOR DELETE TO authenticated USING (public.role_at_least('comprador'));

-- 4) Auditoria (criado_por_nome / atualizado_por_nome) — a migration 121 rodou
-- num DO block só sobre tabelas já existentes; esta é nova, então liga o trigger
-- genérico manualmente (função pública já existe).
DROP TRIGGER IF EXISTS tg_audit_user_cmp_fornecedor_anexos ON public.cmp_fornecedor_anexos;
CREATE TRIGGER tg_audit_user_cmp_fornecedor_anexos
  BEFORE INSERT OR UPDATE ON public.cmp_fornecedor_anexos
  FOR EACH ROW EXECUTE FUNCTION public._tg_stamp_audit_user();

-- 5) View de regularização: fornecedores CNPJ e status do Cartão CNPJ (90 dias).
-- security_invoker: respeita a RLS de quem consulta (leitura é liberada mesmo assim).
CREATE OR REPLACE VIEW public.cmp_fornecedores_doc_status
WITH (security_invoker = true) AS
SELECT
  f.id,
  f.razao_social,
  f.nome_fantasia,
  f.cnpj,
  (length(regexp_replace(COALESCE(f.cnpj,''), '\D', '', 'g')) = 14) AS is_cnpj,
  EXISTS (
    SELECT 1 FROM public.cmp_fornecedor_anexos a
    WHERE a.fornecedor_id = f.id
      AND a.tipo = 'cartao_cnpj'
      AND (a.data_emissao IS NULL OR a.data_emissao >= current_date - INTERVAL '90 days')
  ) AS cartao_cnpj_ok,
  (SELECT max(a.data_emissao) FROM public.cmp_fornecedor_anexos a
     WHERE a.fornecedor_id = f.id AND a.tipo = 'cartao_cnpj') AS cartao_cnpj_emissao
FROM public.cmp_fornecedores f
WHERE f.ativo;

GRANT SELECT ON public.cmp_fornecedores_doc_status TO authenticated;

COMMENT ON TABLE public.cmp_fornecedor_anexos IS
  'Documentos anexados ao fornecedor (Cartão CNPJ, certidões, contrato social). Cartão CNPJ exigido no cadastro NOVO de CNPJ (regra de 90 dias, enforço frontend).';
COMMENT ON VIEW public.cmp_fornecedores_doc_status IS
  'Status de documentação por fornecedor CNPJ. is_cnpj AND NOT cartao_cnpj_ok = pendente de regularização.';
