-- 102: base de destino na RC + propagacao na ponte CD->Compras
-- Permite saber para qual base (canteiro) o material vai, para gatear o recebimento.

ALTER TABLE cmp_requisicoes
  ADD COLUMN IF NOT EXISTS base_destino_id uuid REFERENCES est_bases(id);

-- est_encaminhar_solicitacao_compras passa a propagar base_destino_id da solicitacao.
-- (corpo completo na migracao 101; aqui so a alteracao do INSERT que adiciona base_destino_id)
CREATE OR REPLACE FUNCTION public.est_encaminhar_solicitacao_compras(p_solicitacao_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sol     est_solicitacoes%ROWTYPE;
  v_numero  text;
  v_rc_id   uuid;
  v_pend    int;
  v_alcada  record;
  v_aprov   record;
BEGIN
  SELECT * INTO v_sol FROM est_solicitacoes WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitacao nao encontrada';
  END IF;
  IF v_sol.cmp_requisicao_id IS NOT NULL THEN
    RAISE EXCEPTION 'Solicitacao ja encaminhada para compras';
  END IF;

  SELECT count(*) INTO v_pend
  FROM est_solicitacao_itens i
  WHERE i.solicitacao_id = p_solicitacao_id
    AND (i.quantidade - COALESCE(i.quantidade_atendida, 0)) > 0;
  IF v_pend = 0 THEN
    RAISE EXCEPTION 'Nao ha itens pendentes para encaminhar';
  END IF;

  v_numero := 'RC-' || to_char(now(), 'YYYYMM') || '-' ||
              lpad((floor(random() * 100000))::int::text, 5, '0');

  INSERT INTO cmp_requisicoes (
    numero, solicitante_id, solicitante_nome, obra_nome, obra_id,
    descricao, justificativa, urgencia, status, alcada_nivel, valor_estimado, centro_custo,
    base_destino_id
  ) VALUES (
    v_numero, v_sol.solicitante_id, v_sol.solicitante_nome, v_sol.obra_nome, v_sol.obra_id,
    'Encaminhado da ' || v_sol.numero || ' (triagem CD) - itens sem saldo em estoque',
    'Encaminhamento da triagem do CD (' || v_sol.numero || ')',
    COALESCE(v_sol.urgencia, 'normal')::urgencia_tipo,
    'em_aprovacao'::status_requisicao,
    1, 0, v_sol.centro_custo,
    v_sol.base_destino_id
  ) RETURNING id INTO v_rc_id;

  INSERT INTO cmp_requisicao_itens (
    requisicao_id, descricao, quantidade, unidade, valor_unitario_estimado,
    est_item_id, est_item_codigo, destino_operacional
  )
  SELECT v_rc_id,
    COALESCE(NULLIF(it.descricao_livre, ''), ei.descricao, 'Item'),
    (it.quantidade - COALESCE(it.quantidade_atendida, 0)),
    COALESCE(NULLIF(it.unidade, ''), ei.unidade::text, 'un'),
    0,
    it.item_id, ei.codigo, 'estoque'
  FROM est_solicitacao_itens it
  LEFT JOIN est_itens ei ON ei.id = it.item_id
  WHERE it.solicitacao_id = p_solicitacao_id
    AND (it.quantidade - COALESCE(it.quantidade_atendida, 0)) > 0;

  SELECT prazo_horas, aprovador_padrao_id INTO v_alcada
    FROM apr_alcadas WHERE nivel = 1 AND ativo LIMIT 1;
  SELECT nome, email INTO v_aprov
    FROM sys_usuarios WHERE id = v_alcada.aprovador_padrao_id;

  INSERT INTO apr_aprovacoes (
    modulo, tipo_aprovacao, entidade_id, entidade_numero,
    aprovador_nome, aprovador_email, nivel, status, data_limite
  ) VALUES (
    'cmp', 'requisicao_compra', v_rc_id, v_numero,
    COALESCE(v_aprov.nome, v_sol.solicitante_nome),
    COALESCE(v_aprov.email, 'pendente@teguniao.com.br'),
    1, 'pendente',
    now() + (COALESCE(v_alcada.prazo_horas, 48) || ' hours')::interval
  );

  UPDATE est_solicitacoes
     SET status = 'encaminhada_compras'::est_status_solicitacao,
         cmp_requisicao_id = v_rc_id,
         atualizado_em = now()
   WHERE id = p_solicitacao_id;

  RETURN v_rc_id;
END;
$function$;
