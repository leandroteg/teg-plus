-- ─────────────────────────────────────────────────────────────────────────────
-- 149_con_criar_solicitacao_unificado.sql
--
-- RPC unica para criar con_solicitacoes a partir das 3 origens:
--   1) Nova manual (NovaSolicitacao.tsx)
--   2) Banner RC aprovada (RequisicaoDetalhe.tsx)
--   3) Compra recorrente no pedido (Pedidos.tsx)
--
-- Numeracao: sequence con_solicitacoes_numero_seq -> SOL-CON-YYYY-NNNN
-- Idempotente quando recebe requisicao_origem_id nao-nula:
--   reaproveita solicitacao existente nao-cancelada vinculada a mesma RC.
--
-- Reescreve cmp_criar_solicitacao_contrato_from_rc para delegar nesta nova RPC.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.con_solicitacoes_numero_seq START 1;

-- Alinha a sequence ao maior numero existente (idempotente em deploys repetidos).
SELECT setval('public.con_solicitacoes_numero_seq', greatest(1,
  (SELECT coalesce(max(substring(numero from '\d+$')::int),0)
     FROM public.con_solicitacoes WHERE numero LIKE 'SOL-CON-%')
), false);

CREATE OR REPLACE FUNCTION public.con_criar_solicitacao(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_requisicao_origem_id uuid := (p_payload->>'requisicao_origem_id')::uuid;
  v_existente_id uuid;
  v_nova_id uuid;
  v_numero text;
  v_seq bigint;
BEGIN
  IF v_requisicao_origem_id IS NOT NULL THEN
    SELECT id INTO v_existente_id
    FROM con_solicitacoes
    WHERE requisicao_origem_id = v_requisicao_origem_id
      AND coalesce(status, '') <> 'cancelado'
    LIMIT 1;

    IF v_existente_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true, 'reused', true,
        'id', v_existente_id,
        'numero', (SELECT numero FROM con_solicitacoes WHERE id = v_existente_id)
      );
    END IF;
  END IF;

  v_seq := nextval('con_solicitacoes_numero_seq');
  v_numero := 'SOL-CON-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  INSERT INTO con_solicitacoes (
    numero,
    solicitante_id, solicitante_nome, departamento,
    obra_id, centro_custo, classe_financeira,
    tipo_contraparte, contraparte_id, contraparte_nome,
    contraparte_cnpj, contraparte_telefone, contraparte_email,
    contraparte_endereco, contraparte_representante_nome,
    contraparte_representante_cpf, contraparte_representante_cargo,
    fornecedor_cadastrado, contrato_vigente_fornecedor,
    tipo_contrato, categoria_contrato, grupo_contrato, subtipo_contrato,
    tipo_solicitacao,
    objeto, descricao_escopo, justificativa,
    valor_estimado, valor_mensal, recorrente,
    forma_pagamento, prazo_meses,
    data_inicio_prevista, data_fim_prevista, data_necessidade,
    indice_reajuste, urgencia,
    documentos_ref,
    etapa_atual, status, observacoes,
    responsavel_id, responsavel_nome, responsavel_aprovacao,
    requisicao_origem_id
  )
  SELECT
    v_numero,
    nullif(p->>'solicitante_id','')::uuid,
    coalesce(p->>'solicitante_nome','Sistema'),
    p->>'departamento',
    nullif(p->>'obra_id','')::uuid,
    p->>'centro_custo',
    p->>'classe_financeira',
    coalesce(p->>'tipo_contraparte','fornecedor'),
    nullif(p->>'contraparte_id','')::uuid,
    coalesce(p->>'contraparte_nome','A definir'),
    p->>'contraparte_cnpj',
    p->>'contraparte_telefone',
    p->>'contraparte_email',
    p->>'contraparte_endereco',
    p->>'contraparte_representante_nome',
    p->>'contraparte_representante_cpf',
    p->>'contraparte_representante_cargo',
    p->>'fornecedor_cadastrado',
    p->>'contrato_vigente_fornecedor',
    coalesce(p->>'tipo_contrato','despesa'),
    coalesce(p->>'categoria_contrato','prestacao_servico'),
    coalesce(p->>'grupo_contrato','prestacao_servicos'),
    p->>'subtipo_contrato',
    coalesce(p->>'tipo_solicitacao','elaboracao_contrato'),
    coalesce(p->>'objeto','Contrato'),
    p->>'descricao_escopo',
    p->>'justificativa',
    nullif(p->>'valor_estimado','')::numeric,
    nullif(p->>'valor_mensal','')::numeric,
    coalesce((p->>'recorrente')::boolean, false),
    p->>'forma_pagamento',
    nullif(p->>'prazo_meses','')::int,
    nullif(p->>'data_inicio_prevista','')::date,
    nullif(p->>'data_fim_prevista','')::date,
    nullif(p->>'data_necessidade','')::date,
    p->>'indice_reajuste',
    coalesce(p->>'urgencia','normal'),
    coalesce(p->'documentos_ref', '[]'::jsonb),
    coalesce(p->>'etapa_atual','solicitacao'),
    coalesce(p->>'status','rascunho'),
    p->>'observacoes',
    nullif(p->>'responsavel_id','')::uuid,
    p->>'responsavel_nome',
    p->>'responsavel_aprovacao',
    v_requisicao_origem_id
  FROM (SELECT p_payload AS p) src
  RETURNING id INTO v_nova_id;

  RETURN jsonb_build_object('ok', true, 'reused', false, 'id', v_nova_id, 'numero', v_numero);
END;
$function$;

-- cmp_criar_solicitacao_contrato_from_rc passa a delegar na nova RPC.
CREATE OR REPLACE FUNCTION public.cmp_criar_solicitacao_contrato_from_rc(
  p_requisicao_id uuid,
  p_observacao text DEFAULT NULL,
  p_responsavel_nome text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_rc RECORD;
  v_pedido RECORD;
  v_payload jsonb;
BEGIN
  SELECT id, numero, descricao, justificativa, valor_estimado,
         categoria, obra_nome, obra_id, solicitante_id, solicitante_nome,
         centro_custo
  INTO v_rc
  FROM cmp_requisicoes WHERE id = p_requisicao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'requisicao nao encontrada');
  END IF;

  SELECT fornecedor_id, fornecedor_nome, valor_total
  INTO v_pedido
  FROM cmp_pedidos
  WHERE requisicao_id = p_requisicao_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  v_payload := jsonb_build_object(
    'solicitante_id', v_rc.solicitante_id,
    'solicitante_nome', v_rc.solicitante_nome,
    'departamento', 'Compras',
    'obra_id', v_rc.obra_id,
    'centro_custo', v_rc.centro_custo,
    'contraparte_id', v_pedido.fornecedor_id,
    'contraparte_nome', coalesce(v_pedido.fornecedor_nome, 'A definir'),
    'tipo_contraparte', CASE WHEN v_pedido.fornecedor_id IS NOT NULL THEN 'fornecedor' ELSE NULL END,
    'tipo_solicitacao', 'elaboracao_contrato',
    'objeto', coalesce(v_rc.descricao, 'Contrato a partir da RC ' || v_rc.numero),
    'justificativa', v_rc.justificativa,
    'valor_estimado', coalesce(v_pedido.valor_total, v_rc.valor_estimado),
    'urgencia', 'normal',
    'etapa_atual', 'preparar_minuta',
    'status', 'em_andamento',
    'observacoes', coalesce(
      'Solicitacao gerada a partir da RC ' || v_rc.numero ||
        coalesce(' - ' || p_observacao, ''),
      'Solicitacao gerada a partir de RC.'
    ),
    'responsavel_nome', p_responsavel_nome,
    'requisicao_origem_id', p_requisicao_id
  );

  RETURN public.con_criar_solicitacao(v_payload);
END;
$function$;
