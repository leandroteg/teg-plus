-- 193_multiempresa_pedido_cp.sql
-- Multi-empresa (Grupo TEG) — 1ª etapa no núcleo transacional.
-- Objetivo: permitir definir a EMPRESA (pessoa jurídica / CNPJ) na EMISSÃO do
-- pedido de compra e propagar essa empresa para o Financeiro (Contas a Pagar).
--
-- Decisões (2026-07-17):
--   • Captura na emissão do pedido (Compras). Default = Matriz (EMP-001), editável.
--   • empresa_id carimbado em cmp_pedidos e em cada fin_contas_pagar do pedido.
--   • Como a CP nasce por vários caminhos (emissão via cotação, recebimento de
--     pedido direto, etc.), um trigger garante que TODA CP com pedido_id herde a
--     empresa do pedido quando não vier preenchida.
-- Idempotente (IF NOT EXISTS / CREATE OR REPLACE) para rodar em homolog e prod.

-- ── 1. Coluna empresa_id ─────────────────────────────────────────────────────
ALTER TABLE public.cmp_pedidos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.sys_empresas(id);

ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.sys_empresas(id);

COMMENT ON COLUMN public.cmp_pedidos.empresa_id IS
  'Empresa (pessoa jurídica/CNPJ) que emite o pedido. Definida na emissão. Default UI = Matriz (EMP-001).';
COMMENT ON COLUMN public.fin_contas_pagar.empresa_id IS
  'Empresa da conta a pagar. Para CP de pedido, herdada de cmp_pedidos.empresa_id (trigger fin_cp_herda_empresa_pedido).';

CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_empresa      ON public.cmp_pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fin_contas_pagar_empresa ON public.fin_contas_pagar(empresa_id);

-- ── 2. Trigger: CP herda a empresa do pedido ─────────────────────────────────
-- BEFORE INSERT/UPDATE: se a CP aponta pra um pedido e ainda não tem empresa,
-- copia a empresa do cmp_pedidos. Não sobrescreve empresa já informada.
CREATE OR REPLACE FUNCTION public.fin_cp_herda_empresa_pedido()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.empresa_id IS NULL AND NEW.pedido_id IS NOT NULL THEN
    SELECT p.empresa_id INTO NEW.empresa_id
    FROM public.cmp_pedidos p
    WHERE p.id = NEW.pedido_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_cp_herda_empresa_pedido ON public.fin_contas_pagar;
CREATE TRIGGER trg_fin_cp_herda_empresa_pedido
  BEFORE INSERT OR UPDATE OF pedido_id, empresa_id ON public.fin_contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.fin_cp_herda_empresa_pedido();

-- ── 3. Backfill NÃO automático ───────────────────────────────────────────────
-- Registros históricos ficam com empresa_id NULL (= "não informado", tratado
-- como Matriz nos relatórios). Backfill em massa deve ser decisão explícita.
