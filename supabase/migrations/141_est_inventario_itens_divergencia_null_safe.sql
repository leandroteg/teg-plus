-- ─────────────────────────────────────────────────────────────────────────────
-- 141_est_inventario_itens_divergencia_null_safe.sql
--
-- Antes: divergencia = COALESCE(saldo_contado, 0) - COALESCE(saldo_sistema, 0)
-- Problema: quando o item ainda nao foi contado (saldo_contado IS NULL), a
-- expressao retornava -saldo_sistema. Tela de Inventario mostrava divergencia
-- negativa em vermelho antes do almoxarife digitar qualquer coisa, dando
-- impressao de que o estoque estava todo sumido.
--
-- Agora: divergencia eh NULL ate o saldo_contado ser preenchido. KPIs e a UI
-- ja tratam NULL como 'nao contado' em outras telas (Histórico, KPIs).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.est_inventario_itens
  DROP COLUMN divergencia;

ALTER TABLE public.est_inventario_itens
  ADD COLUMN divergencia numeric
  GENERATED ALWAYS AS (
    CASE
      WHEN saldo_contado IS NULL THEN NULL
      ELSE saldo_contado - COALESCE(saldo_sistema, 0)
    END
  ) STORED;
