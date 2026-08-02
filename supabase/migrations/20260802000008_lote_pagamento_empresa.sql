-- Multi-empresa nos lotes de pagamento: 1 lote = 1 empresa pagadora.
-- A criacao de lote no front passa a dividir a selecao por empresa da CP;
-- aqui: coluna + backfill dos lotes cujas CPs sao todas da mesma empresa.
ALTER TABLE public.fin_lotes_pagamento
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.sys_empresas(id);
CREATE INDEX IF NOT EXISTS idx_fin_lotes_empresa ON public.fin_lotes_pagamento(empresa_id);

-- Backfill: lote herda a empresa quando TODAS as suas CPs tem a mesma
UPDATE public.fin_lotes_pagamento l
SET empresa_id = sub.empresa_unica
FROM (
  SELECT li.lote_id, min(cp.empresa_id::text)::uuid AS empresa_unica
  FROM public.fin_lote_itens li
  JOIN public.fin_contas_pagar cp ON cp.id = li.cp_id
  GROUP BY li.lote_id
  HAVING count(DISTINCT cp.empresa_id) = 1 AND count(*) FILTER (WHERE cp.empresa_id IS NULL) = 0
) sub
WHERE l.id = sub.lote_id AND l.empresa_id IS NULL;
