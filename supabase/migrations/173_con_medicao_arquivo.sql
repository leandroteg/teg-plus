-- Anexo de documento na medição de contrato (planilha de medição / BM / NF).
--
-- Permite anexar um arquivo no "Enviar ao Financeiro" da medição (tela Gestão de
-- Contratos → aba Medições). O arquivo fica na própria medição; a conta a pagar/
-- receber gerada por con_faturar_medicao já referencia a medição (medicao_id), e o
-- Financeiro lê este documento AO VIVO por esse vínculo — sem duplicar URL na conta
-- nem alterar a RPC. Por isso até medições já enviadas podem receber o anexo depois.
--
-- Bucket de storage reaproveitado: contratos-anexos (mesmo do arquivo do contrato),
-- prefixo medicoes/<medicao_id>/.

ALTER TABLE public.con_medicoes
  ADD COLUMN IF NOT EXISTS arquivo_url  text,
  ADD COLUMN IF NOT EXISTS arquivo_nome text;
