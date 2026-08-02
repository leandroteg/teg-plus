-- 199_multiempresa_cotacao.sql
-- Multi-empresa (Grupo TEG) — empresa escolhida já na COTAÇÃO.
-- A cotação é onde o fornecedor precisa saber para qual CNPJ emitir proposta e,
-- depois, a NF. A empresa escolhida aqui vira o DEFAULT na emissão do pedido
-- (EmitirPedidoModal), que continua sendo o carimbo oficial (mig 193:
-- cmp_pedidos.empresa_id → herdado por fin_contas_pagar via trigger).
-- Idempotente (IF NOT EXISTS) para rodar em homolog e prod.

ALTER TABLE public.cmp_cotacoes
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.sys_empresas(id);

COMMENT ON COLUMN public.cmp_cotacoes.empresa_id IS
  'Empresa (pessoa jurídica/CNPJ) em nome da qual a cotação é solicitada. Default UI = Matriz (EMP-001). Vira o default de cmp_pedidos.empresa_id na emissão.';

CREATE INDEX IF NOT EXISTS idx_cmp_cotacoes_empresa ON public.cmp_cotacoes(empresa_id);
