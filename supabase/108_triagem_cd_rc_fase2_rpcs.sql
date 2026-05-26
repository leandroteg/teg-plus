-- 108: triagem CD para RC (fase 2 - acoes do triador)
-- 2 RPCs SECURITY DEFINER:
--   cmp_rc_triagem_atender_item: registra atendimento (parcial/total) de
--     um item da RC com saida do CD para a base da obra. Quando todos os
--     itens estiverem totalmente atendidos -> status RC = 'atendida_cd'.
--   cmp_rc_triagem_liberar: muda RC de em_triagem_cd para em_aprovacao
--     e cria apr_aprovacoes com o validador tecnico da categoria.

CREATE OR REPLACE FUNCTION public.cmp_rc_triagem_atender_item(
  p_item_id uuid,
  p_quantidade numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item     cmp_requisicao_itens%ROWTYPE;
  v_rc       cmp_requisicoes%ROWTYPE;
  v_source   uuid;
  v_dest     uuid;
  v_saldo    numeric;
  v_resp_nome text;
  v_resp_id  uuid;
  v_restante numeric;
  v_pendentes int;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade invalida';
  END IF;

  SELECT * INTO v_item FROM cmp_requisicao_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item da RC nao encontrado'; END IF;
  IF v_item.est_item_id IS NULL THEN
    RAISE EXCEPTION 'Item sem catalogo de estoque nao pode ser atendido; libere ao Compras';
  END IF;

  SELECT * INTO v_rc FROM cmp_requisicoes WHERE id = v_item.requisicao_id;
  IF v_rc.status <> 'em_triagem_cd'::status_requisicao THEN
    RAISE EXCEPTION 'RC nao esta em triagem (status=%)', v_rc.status;
  END IF;

  v_restante := v_item.quantidade - COALESCE(v_item.qtd_atendida_cd, 0);
  IF p_quantidade > v_restante THEN
    RAISE EXCEPTION 'Quantidade % excede o pendente %', p_quantidade, v_restante;
  END IF;

  -- Destino: base da obra (sys_obras.base_id) ou base_destino_id da RC
  v_dest := COALESCE(v_rc.base_destino_id, (SELECT base_id FROM sys_obras WHERE id = v_rc.obra_id));
  IF v_dest IS NULL THEN
    RAISE EXCEPTION 'RC sem base de destino (canteiro) definida';
  END IF;

  -- Source: CD que faz triagem
  SELECT id INTO v_source FROM est_bases WHERE faz_triagem = true AND ativa = true LIMIT 1;
  IF v_source IS NULL THEN RAISE EXCEPTION 'Nenhum CD de triagem configurado'; END IF;

  -- Saldo no CD
  SELECT COALESCE(saldo, 0) INTO v_saldo
  FROM est_saldos WHERE item_id = v_item.est_item_id AND base_id = v_source;
  IF COALESCE(v_saldo, 0) < p_quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente no CD (disponivel %, pedido %)', COALESCE(v_saldo, 0), p_quantidade;
  END IF;

  SELECT nome, id INTO v_resp_nome, v_resp_id
  FROM sys_perfis WHERE auth_id = auth.uid() LIMIT 1;

  -- Movimentacao de saida do CD + entrada no canteiro
  INSERT INTO est_movimentacoes (tipo, item_id, base_id, base_destino_id, quantidade, responsavel_nome, responsavel_id, observacao, obra_nome)
  VALUES ('transferencia_out', v_item.est_item_id, v_source, v_dest, p_quantidade, v_resp_nome, v_resp_id, 'Atendimento RC ' || v_rc.numero, v_rc.obra_nome);

  INSERT INTO est_movimentacoes (tipo, item_id, base_id, base_destino_id, quantidade, responsavel_nome, responsavel_id, observacao, obra_nome)
  VALUES ('transferencia_in', v_item.est_item_id, v_dest, v_source, p_quantidade, v_resp_nome, v_resp_id, 'Atendimento RC ' || v_rc.numero, v_rc.obra_nome);

  -- Atualiza qtd atendida pelo CD
  UPDATE cmp_requisicao_itens
     SET qtd_atendida_cd = COALESCE(qtd_atendida_cd, 0) + p_quantidade,
         atendimento_cd_em = now()
   WHERE id = p_item_id;

  -- Se todos os itens estao totalmente atendidos, RC fica atendida_cd
  SELECT count(*) FILTER (WHERE COALESCE(qtd_atendida_cd, 0) < quantidade)
    INTO v_pendentes
  FROM cmp_requisicao_itens WHERE requisicao_id = v_rc.id;

  IF v_pendentes = 0 THEN
    UPDATE cmp_requisicoes
       SET status = 'atendida_cd'::status_requisicao
     WHERE id = v_rc.id;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cmp_rc_triagem_atender_item(uuid, numeric) TO authenticated;


CREATE OR REPLACE FUNCTION public.cmp_rc_triagem_liberar(p_rc_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rc          cmp_requisicoes%ROWTYPE;
  v_validador   record;
  v_alcada      record;
  v_aprov       record;
  v_validador_id uuid;
  v_pendentes   int;
BEGIN
  SELECT * INTO v_rc FROM cmp_requisicoes WHERE id = p_rc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC nao encontrada'; END IF;
  IF v_rc.status <> 'em_triagem_cd'::status_requisicao THEN
    RAISE EXCEPTION 'RC nao esta em triagem (status=%)', v_rc.status;
  END IF;

  -- Confirma que sobrou item para comprar
  SELECT count(*) FILTER (WHERE COALESCE(qtd_atendida_cd, 0) < quantidade)
    INTO v_pendentes
  FROM cmp_requisicao_itens WHERE requisicao_id = v_rc.id;
  IF v_pendentes = 0 THEN
    RAISE EXCEPTION 'Todos os itens ja foram atendidos pelo CD; nada a comprar';
  END IF;

  -- Resolve validador tecnico da categoria
  IF v_rc.categoria IS NOT NULL THEN
    SELECT validador_tecnico_id INTO v_validador_id
    FROM cmp_categorias WHERE codigo = v_rc.categoria;
    IF v_validador_id IS NOT NULL THEN
      SELECT nome, email INTO v_validador FROM sys_perfis WHERE id = v_validador_id;
    END IF;
  END IF;

  -- Fallback: aprovador padrao da alcada 1
  SELECT prazo_horas, aprovador_padrao_id INTO v_alcada
    FROM apr_alcadas WHERE nivel = 1 AND ativo LIMIT 1;
  IF v_validador_id IS NULL THEN
    SELECT nome, email INTO v_aprov FROM sys_usuarios WHERE id = v_alcada.aprovador_padrao_id;
  END IF;

  -- Promove RC e cria aprovacao
  UPDATE cmp_requisicoes
     SET status = 'em_aprovacao'::status_requisicao
   WHERE id = p_rc_id;

  INSERT INTO apr_aprovacoes (
    modulo, tipo_aprovacao, entidade_id, entidade_numero,
    aprovador_nome, aprovador_email, nivel, status, data_limite,
    observacao
  ) VALUES (
    'cmp', 'requisicao_compra', v_rc.id, v_rc.numero,
    COALESCE(v_validador.nome, v_aprov.nome, v_rc.solicitante_nome),
    COALESCE(v_validador.email, v_aprov.email, 'pendente@teguniao.com.br'),
    1, 'pendente',
    now() + (COALESCE(v_alcada.prazo_horas, 48) || ' hours')::interval,
    'Liberada pelo CD apos triagem'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cmp_rc_triagem_liberar(uuid) TO authenticated;
