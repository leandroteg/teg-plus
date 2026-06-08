-- ─────────────────────────────────────────────────────────────────────────────
-- 126_cmp_criar_solicitacao_contrato_from_rc.sql
--
-- RPC que cria uma con_solicitacoes (solicitacao de elaboracao de contrato)
-- a partir de uma cmp_requisicoes. Herda dados do solicitante, fornecedor
-- vinculado (do pedido emitido, se houver), valor, escopo etc.
--
-- Trigger NAO automatico. O comprador (ou o solicitante) decide chamar via
-- botao "Solicitar elaboracao de contrato" — assim evita poluir Contratos
-- com toda RC aprovada do dia.
--
-- Idempotente: se ja existe con_solicitacoes com requisicao_origem_id =
-- p_requisicao_id e status != cancelado, retorna o id existente.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cmp_criar_solicitacao_contrato_from_rc(
  p_requisicao_id uuid,
  p_observacao    text DEFAULT NULL,
  p_responsavel_nome text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_existente_id uuid;
  v_nova_id uuid;
  v_numero text;
  v_rc RECORD;
  v_pedido RECORD;
BEGIN
  -- 0) RC existe?
  SELECT id, numero, descricao, justificativa, valor_estimado,
         categoria, obra_nome, obra_id, solicitante_id, solicitante_nome,
         centro_custo
  INTO v_rc
  FROM cmp_requisicoes
  WHERE id = p_requisicao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'requisicao nao encontrada');
  END IF;

  -- 1) Idempotencia: ja existe solicitacao ativa pra essa RC?
  SELECT id INTO v_existente_id
  FROM con_solicitacoes
  WHERE requisicao_origem_id = p_requisicao_id
    AND coalesce(status, '') <> 'cancelado'
  LIMIT 1;

  IF v_existente_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reused', true, 'id', v_existente_id);
  END IF;

  -- 2) Tenta achar pedido emitido da RC pra herdar fornecedor
  SELECT fornecedor_id, fornecedor_nome, valor_total
  INTO v_pedido
  FROM cmp_pedidos
  WHERE requisicao_id = p_requisicao_id
  ORDER BY criado_em DESC NULLS LAST
  LIMIT 1;

  -- 3) Gera numero (CON-YYYYMM-NNNN)
  v_numero := 'CON-' || to_char(now(), 'YYYYMM') || '-' || lpad(
    (
      SELECT coalesce(max(substring(numero from '\d+$')::int), 0) + 1
      FROM con_solicitacoes
      WHERE numero LIKE 'CON-' || to_char(now(), 'YYYYMM') || '-%'
    )::text, 4, '0'
  );

  -- 4) Insert
  INSERT INTO con_solicitacoes (
    numero,
    solicitante_id,
    solicitante_nome,
    departamento,
    obra_id,
    contraparte_id,
    contraparte_nome,
    objeto,
    descricao_escopo,
    justificativa,
    valor_estimado,
    centro_custo,
    urgencia,
    etapa_atual,
    status,
    observacoes,
    responsavel_nome,
    requisicao_origem_id,
    tipo_contraparte,
    tipo_solicitacao
  ) VALUES (
    v_numero,
    v_rc.solicitante_id,
    v_rc.solicitante_nome,
    'Compras',
    v_rc.obra_id,
    v_pedido.fornecedor_id,
    coalesce(v_pedido.fornecedor_nome, 'A definir'),
    coalesce(v_rc.descricao, 'Contrato a partir da RC ' || v_rc.numero),
    v_rc.justificativa,
    coalesce(v_pedido.valor_total, v_rc.valor_estimado),
    v_rc.centro_custo,
    'normal',
    'preparar_minuta',
    'em_andamento',
    coalesce(
      'Solicitacao gerada a partir da RC ' || v_rc.numero ||
        coalesce(' - ' || p_observacao, ''),
      'Solicitacao gerada a partir de RC.'
    ),
    p_responsavel_nome,
    p_requisicao_id,
    CASE WHEN v_pedido.fornecedor_id IS NOT NULL THEN 'fornecedor' ELSE NULL END,
    'elaboracao_contrato'
  )
  RETURNING id INTO v_nova_id;

  RETURN jsonb_build_object('ok', true, 'reused', false, 'id', v_nova_id, 'numero', v_numero);
END;
$function$;

COMMENT ON FUNCTION public.cmp_criar_solicitacao_contrato_from_rc(uuid, text, text) IS
  'Cria con_solicitacoes (solicitacao de elaboracao de contrato) a partir de uma RC. Idempotente: reaproveita solicitacao existente nao-cancelada. Herda fornecedor do pedido emitido (se houver).';
