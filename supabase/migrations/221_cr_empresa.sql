-- 214_cr_empresa.sql
-- Filial pagadora/recebedora em todo lançamento financeiro (pedido do user 04/ago).
-- A CP já tinha empresa_id (multiempresa, migs 193/199); o Contas a Receber
-- ficou de fora e as NFs lançadas caíam em "Sem empresa" no filtro.

ALTER TABLE public.fin_contas_receber
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.sys_empresas(id);

COMMENT ON COLUMN public.fin_contas_receber.empresa_id IS
  'Empresa do grupo que emitiu a NF / vai receber (EMP-001..005).';

CREATE INDEX IF NOT EXISTS idx_fin_cr_empresa ON public.fin_contas_receber(empresa_id);
