-- ============================================================
-- TEG+ | RPCs para Dashboard (chamadas otimizadas)
-- Executar após 001 e 002
-- ============================================================

-- RPC: Dashboard completo em uma chamada
CREATE OR REPLACE FUNCTION get_dashboard_compras(
  p_periodo TEXT DEFAULT 'mes',
  p_obra_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  data_inicio TIMESTAMPTZ;
  resultado JSON;
BEGIN
  -- Determinar período
  CASE p_periodo
    WHEN 'semana' THEN data_inicio := date_trunc('week', now());
    WHEN 'mes' THEN data_inicio := date_trunc('month', now());
    WHEN 'trimestre' THEN data_inicio := date_trunc('quarter', now());
    WHEN 'ano' THEN data_inicio := date_trunc('year', now());
    ELSE data_inicio := date_trunc('month', now());
  END CASE;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total', COUNT(*),
        'aguardando_aprovacao', COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'aprovadas', COUNT(*) FILTER (WHERE status = 'aprovada'),
        'rejeitadas', COUNT(*) FILTER (WHERE status = 'rejeitada'),
        'valor_total', COALESCE(SUM(valor_estimado), 0),
        'valor_aprovado', COALESCE(SUM(valor_estimado) FILTER (WHERE status = 'aprovada'), 0),
        'ticket_medio', COALESCE(AVG(valor_estimado), 0)
      )
      FROM requisicoes
      WHERE created_at >= data_inicio
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),
    'por_status', (
      SELECT json_agg(json_build_object(
        'status', status,
        'total', cnt,
        'valor', valor
      ))
      FROM (
        SELECT status, COUNT(*) cnt, COALESCE(SUM(valor_estimado), 0) valor
        FROM requisicoes
        WHERE created_at >= data_inicio
          AND (p_obra_id IS NULL OR obra_id = p_obra_id)
        GROUP BY status
      ) s
    ),
    'por_obra', (
      SELECT json_agg(json_build_object(
        'obra_nome', obra_nome,
        'obra_id', obra_id,
        'total', cnt,
        'valor', valor,
        'pendentes', pend
      ))
      FROM (
        SELECT obra_nome, obra_id, COUNT(*) cnt,
               COALESCE(SUM(valor_estimado), 0) valor,
               COUNT(*) FILTER (WHERE status = 'em_aprovacao') pend
        FROM requisicoes
        WHERE created_at >= data_inicio
        GROUP BY obra_nome, obra_id
      ) o
    ),
    'recentes', (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT id, numero, solicitante_nome, obra_nome, descricao,
               valor_estimado, urgencia, status, alcada_nivel, created_at
        FROM requisicoes
        WHERE (p_obra_id IS NULL OR obra_id = p_obra_id)
        ORDER BY created_at DESC
        LIMIT 20
      ) r
    ),
    'aprovacoes_pendentes', (
      SELECT json_agg(json_build_object(
        'id', a.id,
        'requisicao_id', a.requisicao_id,
        'numero', r.numero,
        'descricao', r.descricao,
        'valor', r.valor_estimado,
        'obra', r.obra_nome,
        'solicitante', r.solicitante_nome,
        'nivel', a.nivel,
        'aprovador', a.aprovador_nome,
        'data_limite', a.data_limite,
        'token', a.token
      ))
      FROM aprovacoes a
      JOIN requisicoes r ON r.id = a.requisicao_id
      WHERE a.status = 'pendente'
        AND (p_obra_id IS NULL OR r.obra_id = p_obra_id)
      ORDER BY a.created_at DESC
      LIMIT 10
    )
  ) INTO resultado;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
