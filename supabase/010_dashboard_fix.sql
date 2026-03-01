-- ============================================================
-- 010_dashboard_fix.sql
-- Corrige get_dashboard_compras:
--   1. DEFAULT 'trimestre' (era 'mes')
--   2. Suporte ao período 'tudo' (v_inicio = 2000-01-01)
--   3. Filtro >= v_inicio (era BETWEEN)
--   4. Adiciona 'mes' explícito no CASE
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_compras(
  p_periodo TEXT DEFAULT 'trimestre',
  p_obra_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Mapeia período para data de início
  CASE p_periodo
    WHEN 'semana'    THEN v_inicio := date_trunc('week',    NOW() AT TIME ZONE 'America/Sao_Paulo');
    WHEN 'mes'       THEN v_inicio := date_trunc('month',   NOW() AT TIME ZONE 'America/Sao_Paulo');
    WHEN 'trimestre' THEN v_inicio := date_trunc('quarter', NOW() AT TIME ZONE 'America/Sao_Paulo');
    WHEN 'ano'       THEN v_inicio := date_trunc('year',    NOW() AT TIME ZONE 'America/Sao_Paulo');
    ELSE                  v_inicio := '2000-01-01'::TIMESTAMPTZ;   -- 'tudo' e qualquer outro
  END CASE;

  SELECT json_build_object(

    -- ── KPIs ────────────────────────────────────────────────
    'kpis', (
      SELECT json_build_object(
        'total',                    COUNT(*),
        'aguardando_aprovacao',     COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'aprovadas',                COUNT(*) FILTER (WHERE status IN (
                                      'aprovada','em_cotacao','cotacao_enviada',
                                      'cotacao_aprovada','pedido_emitido','em_entrega',
                                      'entregue','aguardando_pgto','pago','comprada'
                                    )),
        'rejeitadas',               COUNT(*) FILTER (WHERE status IN ('rejeitada','cotacao_rejeitada')),
        'valor_total',              COALESCE(SUM(valor_estimado), 0),
        'valor_aprovado',           COALESCE(SUM(valor_estimado) FILTER (WHERE status NOT IN
                                      ('pendente','em_aprovacao','rejeitada','cancelada','rascunho')), 0),
        'ticket_medio',             COALESCE(AVG(valor_estimado), 0),
        'tempo_medio_aprovacao_horas', 0,
        -- aliases para compatibilidade com frontend
        'total_requisicoes',        COUNT(*),
        'total_pendentes',          COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'total_aprovadas',          COUNT(*) FILTER (WHERE status IN (
                                      'aprovada','em_cotacao','cotacao_enviada',
                                      'cotacao_aprovada','pedido_emitido','em_entrega',
                                      'entregue','aguardando_pgto','pago','comprada'
                                    )),
        'total_em_cotacao',         COUNT(*) FILTER (WHERE status = 'em_cotacao'),
        'total_compradas',          COUNT(*) FILTER (WHERE status = 'comprada'),
        'valor_total_periodo',      COALESCE(SUM(valor_estimado), 0)
      )
      FROM cmp_requisicoes
      WHERE created_at >= v_inicio
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),

    -- ── Por status ───────────────────────────────────────────
    'por_status', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT status,
               COUNT(*) AS total,
               COALESCE(SUM(valor_estimado), 0) AS valor,
               ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS percentual
        FROM cmp_requisicoes
        WHERE created_at >= v_inicio
          AND (p_obra_id IS NULL OR obra_id = p_obra_id)
        GROUP BY status
        ORDER BY total DESC
      ) t),
      '[]'::json
    ),

    -- ── Por obra ─────────────────────────────────────────────
    'por_obra', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT obra_nome, obra_id,
               COUNT(*) AS total,
               COALESCE(SUM(valor_estimado), 0) AS valor,
               COUNT(*) FILTER (WHERE status IN ('pendente','em_aprovacao')) AS pendentes
        FROM cmp_requisicoes
        WHERE created_at >= v_inicio
          AND (p_obra_id IS NULL OR obra_id = p_obra_id)
        GROUP BY obra_nome, obra_id
        ORDER BY valor DESC
      ) t),
      '[]'::json
    ),

    -- ── Recentes (últimas 30, sem filtro de período) ─────────
    'recentes', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT r.id, r.numero, r.solicitante_nome, r.obra_nome, r.obra_id,
               r.descricao, r.valor_estimado, r.urgencia, r.status,
               r.alcada_nivel, r.categoria, r.comprador_id, r.created_at,
               c.nome AS comprador_nome
        FROM cmp_requisicoes r
        LEFT JOIN cmp_compradores c ON c.id = r.comprador_id
        WHERE (p_obra_id IS NULL OR r.obra_id = p_obra_id)
        ORDER BY r.created_at DESC
        LIMIT 30
      ) t),
      '[]'::json
    ),

    -- ── Aprovações pendentes ──────────────────────────────────
    'aprovacoes_pendentes', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT a.id, a.entidade_id AS requisicao_id,
               a.entidade_numero, a.aprovador_nome, a.aprovador_email,
               a.nivel, a.status, a.token, a.data_limite,
               r.descricao, r.valor_estimado, r.obra_nome, r.urgencia
        FROM apr_aprovacoes a
        JOIN cmp_requisicoes r ON r.id = a.entidade_id
        WHERE a.status = 'pendente'
          AND a.modulo = 'cmp'
        ORDER BY a.created_at ASC
        LIMIT 10
      ) t),
      '[]'::json
    )

  ) INTO v_result;

  RETURN v_result;
END;
$func$;

-- Grant de execução para todos os papéis autenticados
GRANT EXECUTE ON FUNCTION get_dashboard_compras(TEXT, UUID) TO anon, authenticated, service_role;

-- Verificação: testar os 3 períodos principais
SELECT
  'trimestre' AS periodo,
  (get_dashboard_compras('trimestre', NULL) -> 'kpis' ->> 'total')::int AS total,
  (get_dashboard_compras('trimestre', NULL) -> 'kpis' ->> 'total_compradas')::int AS compradas
UNION ALL
SELECT
  'tudo',
  (get_dashboard_compras('tudo', NULL) -> 'kpis' ->> 'total')::int,
  (get_dashboard_compras('tudo', NULL) -> 'kpis' ->> 'total_compradas')::int
UNION ALL
SELECT
  'mes',
  (get_dashboard_compras('mes', NULL) -> 'kpis' ->> 'total')::int,
  (get_dashboard_compras('mes', NULL) -> 'kpis' ->> 'total_compradas')::int;
