-- Atendimento parcial de RC: marca em cada item da requisição qual pedido o cobriu.
-- NULL = item ainda não foi comprado. Preenchido = item já cobrado em um pedido.
-- A RC só vai pra status='pedido_emitido' quando TODOS os itens estão preenchidos.
-- Enquanto sobrar item NULL, a RC continua em 'em_cotacao' com badge "Parcialmente Atendida" derivada.

ALTER TABLE public.cmp_requisicao_itens
  ADD COLUMN IF NOT EXISTS atendido_em_pedido_id uuid
    REFERENCES public.cmp_pedidos(id) ON DELETE SET NULL;

-- Índice para a query do badge (filtra RCs com itens não atendidos)
CREATE INDEX IF NOT EXISTS idx_cmp_requisicao_itens_atendido_em_pedido_id
  ON public.cmp_requisicao_itens (requisicao_id)
  WHERE atendido_em_pedido_id IS NULL;

COMMENT ON COLUMN public.cmp_requisicao_itens.atendido_em_pedido_id IS
  'Pedido que cobriu este item. NULL = ainda não comprado. Quando todos itens da RC preenchidos, RC vai pra pedido_emitido. Enquanto sobrar NULL e tiver ≥1 pedido emitido, RC fica como "parcialmente atendida".';
