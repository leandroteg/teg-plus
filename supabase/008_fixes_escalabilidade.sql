-- ============================================================
-- 008_fixes_escalabilidade.sql
-- Fixes: RPC null arrays, indexes para 50 users, constraints
-- ============================================================

-- ─── 1. Fix cmp_cotacao_fornecedores.valor_total: allow NULL ──
ALTER TABLE cmp_cotacao_fornecedores
  ALTER COLUMN valor_total DROP NOT NULL;

ALTER TABLE cmp_cotacao_fornecedores
  ALTER COLUMN valor_total SET DEFAULT 0;

-- ─── 2. Indexes de performance para 50 usuários simultâneos ───

-- Requisições: filtros mais usados
CREATE INDEX IF NOT EXISTS idx_cmp_req_status_created
  ON cmp_requisicoes (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cmp_req_obra_status
  ON cmp_requisicoes (obra_id, status);

CREATE INDEX IF NOT EXISTS idx_cmp_req_comprador_status
  ON cmp_requisicoes (comprador_id, status);

-- Aprovações: consulta por pendentes muito frequente
CREATE INDEX IF NOT EXISTS idx_apr_aprov_status_modulo
  ON apr_aprovacoes (status, modulo);

CREATE INDEX IF NOT EXISTS idx_apr_aprov_entidade
  ON apr_aprovacoes (entidade_id) WHERE status = 'pendente';

-- Cotações: join frequente
CREATE INDEX IF NOT EXISTS idx_cmp_cot_req_status
  ON cmp_cotacoes (requisicao_id, status);

-- Pedidos: filtro por data de entrega
CREATE INDEX IF NOT EXISTS idx_cmp_ped_status_data
  ON cmp_pedidos (status, data_prevista_entrega);

-- Itens: join com requisição
CREATE INDEX IF NOT EXISTS idx_cmp_itens_req
  ON cmp_requisicao_itens (requisicao_id);

-- ─── 3. Fix RPC get_dashboard_compras: NULL → [] ──────────────
CREATE OR REPLACE FUNCTION get_dashboard_compras(
  p_periodo TEXT DEFAULT 'mes',
  p_obra_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inicio TIMESTAMPTZ;
  v_fim    TIMESTAMPTZ := NOW();
  v_result JSON;
BEGIN
  -- Período
  CASE p_periodo
    WHEN 'semana'    THEN v_inicio := date_trunc('week',  NOW());
    WHEN 'trimestre' THEN v_inicio := date_trunc('quarter', NOW());
    WHEN 'ano'       THEN v_inicio := date_trunc('year',  NOW());
    ELSE                  v_inicio := date_trunc('month', NOW());
  END CASE;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total',                  COUNT(*),
        'aguardando_aprovacao',   COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'aprovadas',              COUNT(*) FILTER (WHERE status IN ('aprovada','em_cotacao','cotacao_enviada','cotacao_aprovada','pedido_emitido','em_entrega','entregue','aguardando_pgto','pago','comprada')),
        'rejeitadas',             COUNT(*) FILTER (WHERE status = 'rejeitada'),
        'valor_total',            COALESCE(SUM(valor_estimado), 0),
        'valor_aprovado',         COALESCE(SUM(valor_estimado) FILTER (WHERE status NOT IN ('pendente','em_aprovacao','rejeitada','cancelada')), 0),
        'ticket_medio',           COALESCE(AVG(valor_estimado), 0),
        'tempo_medio_aprovacao_horas', 0
      )
      FROM cmp_requisicoes
      WHERE created_at BETWEEN v_inicio AND v_fim
        AND (p_obra_id IS NULL OR obra_id = p_obra_id)
    ),

    'por_status', COALESCE(
      (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT status,
                 COUNT(*)              AS total,
                 COALESCE(SUM(valor_estimado), 0) AS valor
          FROM cmp_requisicoes
          WHERE created_at BETWEEN v_inicio AND v_fim
            AND (p_obra_id IS NULL OR obra_id = p_obra_id)
          GROUP BY status
          ORDER BY total DESC
        ) t
      ),
      '[]'::json
    ),

    'por_obra', COALESCE(
      (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT obra_nome,
                 obra_id,
                 COUNT(*)              AS total,
                 COALESCE(SUM(valor_estimado), 0) AS valor,
                 COUNT(*) FILTER (WHERE status = 'em_aprovacao') AS pendentes
          FROM cmp_requisicoes
          WHERE created_at BETWEEN v_inicio AND v_fim
            AND (p_obra_id IS NULL OR obra_id = p_obra_id)
          GROUP BY obra_nome, obra_id
          ORDER BY valor DESC
        ) t
      ),
      '[]'::json
    ),

    'recentes', COALESCE(
      (
        SELECT json_agg(row_to_json(t))
        FROM (
          SELECT r.id, r.numero, r.solicitante_nome, r.obra_nome, r.obra_id,
                 r.descricao, r.valor_estimado, r.urgencia, r.status,
                 r.alcada_nivel, r.categoria, r.comprador_id,
                 r.created_at,
                 c.nome AS comprador_nome
          FROM cmp_requisicoes r
          LEFT JOIN cmp_compradores c ON c.id = r.comprador_id
          WHERE (p_obra_id IS NULL OR r.obra_id = p_obra_id)
          ORDER BY r.created_at DESC
          LIMIT 30
        ) t
      ),
      '[]'::json
    ),

    'aprovacoes_pendentes', COALESCE(
      (
        SELECT json_agg(row_to_json(t))
        FROM (
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
        ) t
      ),
      '[]'::json
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ─── 4. Fix RC-IMP-911 cotação sem valor ─────────────────────
DO $$
DECLARE
  v_req_id UUID;
  v_cot_id UUID;
BEGIN
  SELECT id INTO v_req_id FROM cmp_requisicoes WHERE numero = 'RC-IMP-911';
  IF v_req_id IS NOT NULL THEN
    SELECT id INTO v_cot_id FROM cmp_cotacoes WHERE requisicao_id = v_req_id LIMIT 1;
    IF v_cot_id IS NULL THEN
      INSERT INTO cmp_cotacoes (requisicao_id, status, fornecedor_selecionado_nome, valor_selecionado)
      VALUES (v_req_id, 'concluida', 'EVOLUA', 0)
      RETURNING id INTO v_cot_id;
      INSERT INTO cmp_cotacao_fornecedores (cotacao_id, fornecedor_nome, valor_total, selecionado)
      VALUES (v_cot_id, 'EVOLUA', 0, TRUE);
    END IF;
  END IF;
END $$;

-- ─── 5. RLS anon read para tabelas abertas que ficaram sem ────
-- (cmp_categorias e cmp_compradores têm rls_enabled=false, OK)
-- Garante leitura anon em sys_obras (sem RLS = aberta, OK)

-- ─── 6. Comentário descritivo para documentação ───────────────
COMMENT ON FUNCTION get_dashboard_compras IS
  'Dashboard KPIs com arrays vazios garantidos (COALESCE). Otimizado para 50 usuários.';


-- ─── 7. RPC atualizado com suporte a periodo='tudo' ──────────────
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
    ELSE                  v_inicio := '2000-01-01'::TIMESTAMPTZ;
  END CASE;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total',                  COUNT(*),
        'aguardando_aprovacao',   COUNT(*) FILTER (WHERE status = 'em_aprovacao'),
        'aprovadas',              COUNT(*) FILTER (WHERE status NOT IN ('pendente','em_aprovacao','rejeitada','cotacao_rejeitada','cancelada','rascunho')),
        'rejeitadas',             COUNT(*) FILTER (WHERE status IN ('rejeitada','cotacao_rejeitada')),
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
