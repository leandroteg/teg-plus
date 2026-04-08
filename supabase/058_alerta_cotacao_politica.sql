-- =============================================================================
-- Migration 058: Enhance get_alerta_cotacao with policy-based validation
-- TEG+ ERP – Supabase PostgreSQL
-- Created: 2026-03-23
--
-- Issue #164: Highlight cotações with insufficient number of fornecedores
-- Policy tiers:
--   <= R$500:   1 cotação mínima
--   <= R$2.000: 2 cotações mínimas
--   > R$2.000:  3 cotações mínimas
--
-- Returns additional fields:
--   cotacoes_count  - actual number of fornecedores in the cotação
--   cotacoes_minimo - policy minimum based on value tier
--   cotacoes_insuficientes - boolean: true when count < minimum
-- =============================================================================

CREATE OR REPLACE FUNCTION get_alerta_cotacao(p_requisicao_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result           JSONB;
  v_valor            NUMERIC;
  v_cotacao_id       UUID;
  v_sem_minimas      BOOLEAN;
  v_justificativa    TEXT;
  v_forn_count       INT;
  v_minimo           INT;
BEGIN
  -- Get the requisição value (from items total or valor_estimado)
  SELECT COALESCE(
    (SELECT SUM(ri.quantidade * ri.valor_unitario_estimado)
     FROM cmp_requisicao_itens ri
     WHERE ri.requisicao_id = p_requisicao_id),
    r.valor_estimado
  ) INTO v_valor
  FROM cmp_requisicoes r
  WHERE r.id = p_requisicao_id;

  -- Determine the policy minimum based on value tier
  v_minimo := CASE
    WHEN v_valor IS NULL THEN 1
    WHEN v_valor <= 500   THEN 1
    WHEN v_valor <= 2000  THEN 2
    ELSE 3
  END;

  -- Get the cotação and its manual flag
  SELECT c.id, COALESCE(c.sem_cotacoes_minimas, false), c.justificativa_sem_cotacoes
  INTO v_cotacao_id, v_sem_minimas, v_justificativa
  FROM cmp_cotacoes c
  WHERE c.requisicao_id = p_requisicao_id
  ORDER BY c.created_at DESC
  LIMIT 1;

  -- Count fornecedores in the cotação
  IF v_cotacao_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_forn_count
    FROM cmp_cotacao_fornecedores cf
    WHERE cf.cotacao_id = v_cotacao_id;
  ELSE
    v_forn_count := 0;
  END IF;

  v_result := jsonb_build_object(
    'sem_cotacoes_minimas',   v_sem_minimas,
    'justificativa',          v_justificativa,
    'cotacoes_count',         v_forn_count,
    'cotacoes_minimo',        v_minimo,
    'cotacoes_insuficientes', (v_cotacao_id IS NOT NULL AND v_forn_count < v_minimo)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;
