-- Separa telefone e e-mail do fornecedor na cotacao, mantendo fornecedor_contato
-- para compatibilidade com cotacoes antigas e integracoes existentes.

ALTER TABLE public.cmp_cotacao_fornecedores
  ADD COLUMN IF NOT EXISTS fornecedor_telefone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fornecedor_email VARCHAR(255);

COMMENT ON COLUMN public.cmp_cotacao_fornecedores.fornecedor_telefone
  IS 'Telefone do fornecedor informado na cotacao, separado para uso em WhatsApp e automacoes.';

COMMENT ON COLUMN public.cmp_cotacao_fornecedores.fornecedor_email
  IS 'E-mail do fornecedor informado na cotacao, separado do telefone.';
