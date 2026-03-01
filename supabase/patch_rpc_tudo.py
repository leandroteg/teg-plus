import psycopg2

conn = psycopg2.connect(
    host='db.uzfjfucrinokeuwpbeie.supabase.co', port=5432,
    dbname='postgres', user='postgres', password='Lm120987!Project',
    sslmode='require', connect_timeout=15
)
conn.autocommit = True
cur = conn.cursor()

# Update the RPC to support 'tudo' (all time) and use >= instead of BETWEEN
cur.execute("""
CREATE OR REPLACE FUNCTION get_dashboard_compras(
  p_periodo TEXT DEFAULT 'trimestre',
  p_obra_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_result JSON;
BEGIN
  CASE p_periodo
    WHEN 'semana'    THEN v_inicio := date_trunc('week',    NOW() AT TIME ZONE 'America/Sao_Paulo');
    WHEN 'mes'       THEN v_inicio := date_trunc('month',   NOW() AT TIME ZONE 'America/Sao_Paulo');
    WHEN 'trimestre' THEN v_inicio := date_trunc('quarter', NOW() AT TIME ZONE 'America/Sao_Paulo');
    WHEN 'ano'       THEN v_inicio := date_trunc('year',    NOW() AT TIME ZONE 'America/Sao_Paulo');
    ELSE                  v_inicio := '2000-01-01'::TIMESTAMPTZ; -- 'tudo'
  END CASE;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total',                  COUNT(*),
        'aguardando_aprovacao',   COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'aprovadas',              COUNT(*) FILTER (WHERE status NOT IN ('pendente','em_aprovacao','rejeitada','cancelada','rascunho')),
        'rejeitadas',             COUNT(*) FILTER (WHERE status IN ('rejeitada','cotacao_rejeitada')),
        'canceladas',             COUNT(*) FILTER (WHERE status = 'cancelada'),
        'valor_total',            COALESCE(SUM(valor_estimado), 0),
        'valor_aprovado',         COALESCE(SUM(valor_estimado) FILTER (WHERE status NOT IN ('pendente','em_aprovacao','rejeitada','cancelada','rascunho')), 0),
        'ticket_medio',           COALESCE(AVG(valor_estimado), 0),
        'tempo_medio_aprovacao_horas', 0
      )
      FROM cmp_requisicoes
      WHERE created_at >= v_inicio
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),
    'por_status', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT status, COUNT(*) AS total, COALESCE(SUM(valor_estimado),0) AS valor
        FROM cmp_requisicoes
        WHERE created_at >= v_inicio AND (p_obra_id IS NULL OR obra_id = p_obra_id)
        GROUP BY status ORDER BY total DESC
      ) t), '[]'::json
    ),
    'por_obra', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT obra_nome, obra_id,
               COUNT(*) AS total,
               COALESCE(SUM(valor_estimado),0) AS valor,
               COUNT(*) FILTER (WHERE status IN ('pendente','em_aprovacao')) AS pendentes
        FROM cmp_requisicoes
        WHERE created_at >= v_inicio AND (p_obra_id IS NULL OR obra_id = p_obra_id)
        GROUP BY obra_nome, obra_id ORDER BY valor DESC
      ) t), '[]'::json
    ),
    'recentes', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT r.id, r.numero, r.solicitante_nome, r.obra_nome, r.obra_id,
               r.descricao, r.valor_estimado, r.urgencia, r.status,
               r.alcada_nivel, r.categoria, r.comprador_id, r.created_at,
               c.nome AS comprador_nome
        FROM cmp_requisicoes r
        LEFT JOIN cmp_compradores c ON c.id = r.comprador_id
        WHERE (p_obra_id IS NULL OR r.obra_id = p_obra_id)
        ORDER BY r.created_at DESC LIMIT 30
      ) t), '[]'::json
    ),
    'aprovacoes_pendentes', COALESCE(
      (SELECT json_agg(row_to_json(t)) FROM (
        SELECT a.id, a.entidade_id AS requisicao_id, a.entidade_numero,
               a.aprovador_nome, a.aprovador_email, a.nivel, a.status, a.token, a.data_limite,
               r.descricao, r.valor_estimado, r.obra_nome, r.urgencia
        FROM apr_aprovacoes a
        JOIN cmp_requisicoes r ON r.id = a.entidade_id
        WHERE a.status = 'pendente' AND a.modulo = 'cmp'
        ORDER BY a.created_at ASC LIMIT 10
      ) t), '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$func$;
""")
print("RPC updated with 'tudo' support")

cur.execute("SELECT get_dashboard_compras('trimestre', NULL)")
result = cur.fetchone()[0]
kpis = result.get('kpis', {})
recentes = result.get('recentes') or []
por_status = result.get('por_status') or []
print(f"trimestre → total={kpis.get('total')}, aprovadas={kpis.get('aprovadas')}, recentes={len(recentes)}")
print(f"por_status: {[s['status'] for s in por_status]}")

cur.execute("SELECT get_dashboard_compras('tudo', NULL)")
result2 = cur.fetchone()[0]
kpis2 = result2.get('kpis', {})
print(f"tudo → total={kpis2.get('total')}, aprovadas={kpis2.get('aprovadas')}")

cur.close()
conn.close()
