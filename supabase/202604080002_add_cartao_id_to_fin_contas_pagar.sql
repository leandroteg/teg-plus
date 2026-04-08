ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS cartao_id UUID REFERENCES public.fin_cartoes_credito(id);

CREATE INDEX IF NOT EXISTS idx_fin_cp_cartao
  ON public.fin_contas_pagar (cartao_id);
