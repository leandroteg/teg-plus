-- 027: RPC para buscar aprovações pendentes com requisições e cotações em uma única chamada
-- Substitui 3 queries sequenciais do frontend por 1 RPC

CREATE OR REPLACE FUNCTION get_aprovacoes_pendentes_compras()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resultado JSON;
BEGIN
  SELECT json_agg(row_to_json(t))
  INTO resultado
  FROM (
    SELECT
      a.id,
      a.entidade_id,
      a.aprovador_nome,
      a.aprovador_email,
      a.nivel,
      a.status,
      a.observacao,
      a.token,
      a.data_limite,
      a.created_at,
      -- Requisição inline
      json_build_object(
        'id', r.id,
        'numero', r.numero,
        'solicitante_nome', r.solicitante_nome,
        'obra_nome', r.obra_nome,
        'descricao', r.descricao,
        'valor_estimado', r.valor_estimado,
        'urgencia', r.urgencia,
        'status', r.status,
        'alcada_nivel', r.alcada_nivel,
        'categoria', r.categoria,
        'created_at', r.created_at
      ) AS requisicao,
      -- Cotação inline (pode ser null)
      CASE WHEN c.id IS NOT NULL THEN
        json_build_object(
          'fornecedor_nome', COALESCE(c.fornecedor_selecionado_nome, 'N/A'),
          'valor', COALESCE(c.valor_selecionado, 0),
          'prazo_dias', COALESCE(
            (SELECT cf.prazo_entrega_dias FROM cmp_cotacao_fornecedores cf WHERE cf.cotacao_id = c.id LIMIT 1),
            0
          ),
          'total_cotados', (SELECT COUNT(*) FROM cmp_cotacao_fornecedores cf WHERE cf.cotacao_id = c.id)
        )
      ELSE NULL END AS cotacao_resumo
    FROM apr_aprovacoes a
    INNER JOIN cmp_requisicoes r ON r.id = a.entidade_id
    LEFT JOIN cmp_cotacoes c ON c.requisicao_id = a.entidade_id AND c.status = 'concluida'
    WHERE a.status = 'pendente'
      AND a.modulo = 'cmp'
    ORDER BY a.created_at DESC
  ) t;

  RETURN COALESCE(resultado, '[]'::json);
END;
$$;
