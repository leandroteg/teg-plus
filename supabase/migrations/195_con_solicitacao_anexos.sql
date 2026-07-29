-- ─────────────────────────────────────────────────────────────────────────────
-- 195_con_solicitacao_anexos.sql
--
-- Anexo de documentos na Nova Solicitação de Contrato (Etapa 2, após Valor/Forma
-- de Pagamento). Duas categorias:
--   • fornecedor    → Cartão CNPJ, CNH, CPF, Comprovante de Endereço
--   • complementar  → Proposta Comercial, Ordem de Compra, Especificações Técnicas
--
-- Obrigatórios para ENVIAR (enforço no frontend nesta fase):
--   Cartão CNPJ + (CNH ou CPF) + (Proposta Comercial ou Ordem de Compra).
--   Rascunho não exige nada.
--
-- Documentos incluem dado pessoal (CPF/CNH/comprovante) → bucket PRIVADO, leitura
-- só via signed URL. Espelha o padrão da migration 192 (fornecedores-docs).
--
-- Migration PURAMENTE ADITIVA: não altera con_solicitacoes nem sua RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Bucket privado (leitura via signed URL server-side)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-solicitacao-docs', 'contratos-solicitacao-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "con-sol-docs-read" ON storage.objects;
CREATE POLICY "con-sol-docs-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contratos-solicitacao-docs');

DROP POLICY IF EXISTS "con-sol-docs-write" ON storage.objects;
CREATE POLICY "con-sol-docs-write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos-solicitacao-docs');

DROP POLICY IF EXISTS "con-sol-docs-delete" ON storage.objects;
CREATE POLICY "con-sol-docs-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contratos-solicitacao-docs');

-- 2) Tabela de anexos
CREATE TABLE IF NOT EXISTS public.con_solicitacao_anexos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id  uuid NOT NULL REFERENCES public.con_solicitacoes(id) ON DELETE CASCADE,
  categoria       text NOT NULL DEFAULT 'complementar'
                    CHECK (categoria IN ('fornecedor','complementar')),
  tipo            text NOT NULL DEFAULT 'outro'
                    CHECK (tipo IN (
                      'cartao_cnpj','cnh','cpf','comprovante_endereco',
                      'proposta_comercial','ordem_compra','especificacoes_tecnicas','outro')),
  storage_path    text NOT NULL UNIQUE,
  nome            text NOT NULL,
  mime            text,
  tamanho_bytes   bigint,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  criado_por_nome text,
  atualizado_por_nome text
);

CREATE INDEX IF NOT EXISTS idx_con_sol_anexos_solicitacao
  ON public.con_solicitacao_anexos (solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_con_sol_anexos_categoria
  ON public.con_solicitacao_anexos (solicitacao_id, categoria);

-- 3) RLS — leitura/escrita para autenticados (módulo já é protegido no app; bucket
-- privado guarda o arquivo). WITH CHECK (true) evita falha silenciosa de insert
-- do requisitante (o upload é feito no cliente após a RPC criar a solicitação).
ALTER TABLE public.con_solicitacao_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS con_sol_anexos_read   ON public.con_solicitacao_anexos;
DROP POLICY IF EXISTS con_sol_anexos_insert ON public.con_solicitacao_anexos;
DROP POLICY IF EXISTS con_sol_anexos_delete ON public.con_solicitacao_anexos;

CREATE POLICY con_sol_anexos_read ON public.con_solicitacao_anexos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY con_sol_anexos_insert ON public.con_solicitacao_anexos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY con_sol_anexos_delete ON public.con_solicitacao_anexos
  FOR DELETE TO authenticated USING (true);

-- 4) Auditoria — tabela nova (mig 121 só cobriu tabelas já existentes), liga o
-- trigger genérico manualmente (função pública já existe).
DROP TRIGGER IF EXISTS tg_audit_user_con_solicitacao_anexos ON public.con_solicitacao_anexos;
CREATE TRIGGER tg_audit_user_con_solicitacao_anexos
  BEFORE INSERT OR UPDATE ON public.con_solicitacao_anexos
  FOR EACH ROW EXECUTE FUNCTION public._tg_stamp_audit_user();

COMMENT ON TABLE public.con_solicitacao_anexos IS
  'Documentos anexados na solicitação de contrato. categoria fornecedor|complementar. Obrigatórios p/ enviar (enforço frontend): cartao_cnpj + (cnh|cpf) + (proposta_comercial|ordem_compra). Bucket privado contratos-solicitacao-docs.';
