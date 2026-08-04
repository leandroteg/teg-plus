-- Adiantamento: chave PIX do favorecido + anexos.
-- Anexos reaproveitam fin_documentos (entity_type='adiantamento') e o bucket
-- financeiro-docs, mesmo padrao da Previsao de Pagamento (mig 207).
ALTER TABLE public.desp_adiantamentos ADD COLUMN IF NOT EXISTS chave_pix text;

COMMENT ON COLUMN public.desp_adiantamentos.chave_pix IS
  'Chave PIX do favorecido — evita cadastrar colaborador como fornecedor para pagar.';
