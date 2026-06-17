-- ─────────────────────────────────────────────────────────────────────────────
-- 148c_remove_trigger_recebimento_duplicado.sql
--
-- Havia dois triggers AFTER INSERT em cmp_recebimento_itens chamando a mesma
-- funcao fn_processar_recebimento_item: trg_processar_recebimento e
-- trg_processar_recebimento_item. Resultado: cada NF gerava DUAS entradas
-- em est_movimentacoes. Mantemos apenas trg_processar_recebimento_item
-- (que ja cobre INSERT e UPDATE).
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_processar_recebimento ON public.cmp_recebimento_itens;

-- Bulk: reclassifica como Servico todos os itens com codigo 02.* (plano de
-- contas: prefixo 02. = despesa/servico; 01. = material/produto).
UPDATE public.est_itens
   SET controle_estoque = false,
       atualizado_em = now()
 WHERE codigo LIKE '02.%'
   AND controle_estoque = true;

-- Excecoes claras no prefixo 01.* (revisadas manualmente em 2026-06-17).
UPDATE public.est_itens
   SET controle_estoque = false,
       atualizado_em = now()
 WHERE codigo IN (
   '01.04.0210','01.01.0176','01.08.0388','01.08.0345','01.08.0395',
   '01.07.0009','01.04.0247','01.04.0244','01.04.0039',
   'ITM-14210453','ITM-14210436'
 )
   AND controle_estoque = true;
