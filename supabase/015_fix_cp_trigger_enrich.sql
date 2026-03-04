-- =============================================================================
-- Migration 015: Fix CP trigger + backfill enriched fields
-- TEG+ ERP – Supabase PostgreSQL
-- Created: 2026-03-04
--
-- Fixes:
--   1. Update trigger criar_cp_ao_emitir_pedido to also copy
--      classe_financeira and projeto_id from cmp_requisicoes
--   2. Backfill existing fin_contas_pagar records with missing fields
-- =============================================================================

-- 1. Update trigger to copy all relevant fields from requisicao
CREATE OR REPLACE FUNCTION criar_cp_ao_emitir_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_req      cmp_requisicoes%ROWTYPE;
  v_data_venc DATE;
BEGIN
  IF EXISTS (SELECT 1 FROM fin_contas_pagar WHERE pedido_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_req
  FROM cmp_requisicoes
  WHERE id = NEW.requisicao_id;

  v_data_venc := COALESCE(NEW.data_prevista_entrega::DATE + 30, CURRENT_DATE + 30);

  INSERT INTO fin_contas_pagar (
    pedido_id,
    requisicao_id,
    fornecedor_nome,
    valor_original,
    data_emissao,
    data_vencimento,
    data_vencimento_orig,
    status,
    centro_custo,
    classe_financeira,
    projeto_id,
    descricao,
    natureza
  ) VALUES (
    NEW.id,
    NEW.requisicao_id,
    NEW.fornecedor_nome,
    NEW.valor_total,
    CURRENT_DATE,
    v_data_venc,
    v_data_venc,
    'previsto',
    v_req.centro_custo,
    v_req.classe_financeira,
    v_req.projeto_id,
    v_req.descricao,
    'material'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill existing records
UPDATE fin_contas_pagar cp
SET
  centro_custo = r.centro_custo,
  classe_financeira = r.classe_financeira,
  projeto_id = r.projeto_id
FROM cmp_requisicoes r
WHERE cp.requisicao_id = r.id
  AND (cp.centro_custo IS NULL OR cp.classe_financeira IS NULL OR cp.projeto_id IS NULL);
