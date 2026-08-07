-- 247: coluna conta_destino_id em fin_movimentacoes_tesouraria
--
-- A tabela em prod nasceu antes da 049_tesouraria_foundation e o
-- CREATE TABLE IF NOT EXISTS da 049 não acrescenta colunas — prod ficou
-- sem conta_destino_id. O hook useCriarMovimentacao manda esse campo em
-- TODO insert (null quando não é transferência), então o PostgREST
-- rejeitava o payload inteiro e NENHUM lançamento manual era criado.

ALTER TABLE public.fin_movimentacoes_tesouraria
  ADD COLUMN IF NOT EXISTS conta_destino_id UUID
    REFERENCES public.fin_contas_bancarias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_mov_tes_conta_destino
  ON public.fin_movimentacoes_tesouraria (conta_destino_id, data_movimentacao DESC);
