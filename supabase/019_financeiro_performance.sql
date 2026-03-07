-- 019_financeiro_performance.sql
-- Indices compostos para acelerar get_dashboard_financeiro

CREATE INDEX IF NOT EXISTS idx_fin_cp_status_venc
  ON fin_contas_pagar(status, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_fin_cp_status_pgto
  ON fin_contas_pagar(status, data_pagamento);

CREATE INDEX IF NOT EXISTS idx_fin_cp_cc_status
  ON fin_contas_pagar(centro_custo, status);

CREATE INDEX IF NOT EXISTS idx_fin_cp_created
  ON fin_contas_pagar(created_at DESC);

-- Recriar a funcao com statement_timeout de 8 segundos
CREATE OR REPLACE FUNCTION get_dashboard_financeiro(
  p_periodo TEXT DEFAULT '30d'
)
RETURNS JSON AS $$
DECLARE
  dt_inicio DATE;
  result JSON;
BEGIN
  SET LOCAL statement_timeout = '8000';

  dt_inicio := CASE p_periodo
    WHEN '7d'  THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN '30d' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN '90d' THEN CURRENT_DATE - INTERVAL '90 days'
    ELSE CURRENT_DATE - INTERVAL '365 days'
  END;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total_cp',             COUNT(*),
        'cp_a_vencer',          COUNT(*) FILTER (WHERE status IN ('previsto','aprovado','aprovado_pgto') AND data_vencimento >= CURRENT_DATE),
        'cp_vencidas',          COUNT(*) FILTER (WHERE status IN ('previsto','aprovado','aprovado_pgto') AND data_vencimento < CURRENT_DATE),
        'cp_pagas_periodo',     COUNT(*) FILTER (WHERE status IN ('pago','conciliado') AND data_pagamento >= dt_inicio),
        'valor_total_aberto',   COALESCE(SUM(valor_original) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado')), 0),
        'valor_pago_periodo',   COALESCE(SUM(valor_pago) FILTER (WHERE status IN ('pago','conciliado') AND data_pagamento >= dt_inicio), 0),
        'valor_a_vencer_7d',    COALESCE(SUM(valor_original) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7), 0),
        'aguardando_aprovacao', COUNT(*) FILTER (WHERE status = 'aguardando_aprovacao'),
        'total_cr',             (SELECT COUNT(*) FROM fin_contas_receber WHERE status NOT IN ('cancelado')),
        'valor_cr_aberto',      (SELECT COALESCE(SUM(valor_original),0) FROM fin_contas_receber WHERE status NOT IN ('recebido','conciliado','cancelado'))
      )
      FROM fin_contas_pagar
    ),
    'por_status', (
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT status, COUNT(*) as total, COALESCE(SUM(valor_original),0) as valor
        FROM fin_contas_pagar
        GROUP BY status
        ORDER BY total DESC
      ) s
    ),
    'por_centro_custo', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM (
        SELECT centro_custo, COUNT(*) as total,
               COALESCE(SUM(valor_original),0) as valor,
               COALESCE(SUM(valor_pago),0) as pago
        FROM fin_contas_pagar
        WHERE centro_custo IS NOT NULL
        GROUP BY centro_custo
        ORDER BY valor DESC
      ) c
    ),
    'vencimentos_proximos', (
      SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json)
      FROM (
        SELECT id, fornecedor_nome, valor_original, data_vencimento, status, natureza
        FROM fin_contas_pagar
        WHERE status NOT IN ('pago','conciliado','cancelado')
          AND data_vencimento <= CURRENT_DATE + 30
        ORDER BY data_vencimento ASC
        LIMIT 20
      ) v
    ),
    'recentes', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
      FROM (
        SELECT id, fornecedor_nome, valor_original, status, data_vencimento,
               centro_custo, natureza, created_at
        FROM fin_contas_pagar
        ORDER BY created_at DESC
        LIMIT 10
      ) r
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
