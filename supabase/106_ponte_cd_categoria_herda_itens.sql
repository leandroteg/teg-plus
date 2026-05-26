-- 106: ponte CD->Compras herda categoria dos itens da solicitacao
-- Substitui o default fixo COMPRAS_EXTRA por mapeamento das categorias do
-- est_itens. Solicitacao homogenea (todos itens da mesma cmp_categoria) -> usa
-- a mapeada. Heterogenea ou itens livres (sem est_item_id) -> COMPRAS_EXTRA.

CREATE OR REPLACE FUNCTION public.est_to_cmp_categoria(p_est_cat text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE lower(unaccent(coalesce(p_est_cat, '')))
    WHEN 'aco'                          THEN 'ACO'
    WHEN 'alimentacao'                  THEN 'ALIMENTACAO_CANTEIRO'
    WHEN 'alojamento'                   THEN 'ITENS_ALOJAMENTO'
    WHEN 'concreto'                     THEN 'CONCRETO'
    WHEN 'epi/epc'                      THEN 'EPI_EPC_UNIFORME'
    WHEN 'equipamentos'                 THEN 'EQUIPAMENTOS'
    WHEN 'ferramental'                  THEN 'FERRAMENTAS'
    WHEN 'imobilizado'                  THEN 'AQUISICAO_ATIVOS'
    WHEN 'locacao de imoveis'           THEN 'LOCACAO_IMOVEIS'
    WHEN 'material de escritorio'       THEN 'MAT_ESCRITORIO_SEDE'
    WHEN 'material de limpeza'          THEN 'PRODUTOS_LIMPEZA'
    WHEN 'material de obra'             THEN 'OUTROS_MAT_OBRA'
    WHEN 'material eletrico'            THEN 'OUTROS_MAT_OBRA'
    WHEN 'pecas para manutencao'        THEN 'MANUT_FROTA'
    WHEN 'servicos de obra e logistica' THEN 'SERV_OBRA_LOG'
    WHEN 'ti'                           THEN 'SOFTWARE_HARDWARE_TI'
    WHEN 'uso e consumo'                THEN 'MAT_ESCRITORIO_CD'
    WHEN 'almoxarifado geral'           THEN 'OUTROS_MAT_OBRA'
    WHEN 'farmacia e medicamentos'      THEN 'COMPRAS_EXTRA'
    ELSE 'COMPRAS_EXTRA'
  END;
$function$;

-- Garante extensao unaccent (idempotente)
CREATE EXTENSION IF NOT EXISTS unaccent;

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
  v_categoria text;
  v_qt_cat int;
  v_qt_livre int;
  v_validador_id uuid;
  v_validador record;
BEGIN
  SELECT * INTO v_sol FROM est_solicitacoes WHERE id = p_solicitacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitacao nao encontrada'; END IF;
  IF v_sol.cmp_requisicao_id IS NOT NULL THEN RAISE EXCEPTION 'Solicitacao ja encaminhada para compras'; END IF;

  SELECT count(*) INTO v_pend
  FROM est_solicitacao_itens i
  WHERE i.solicitacao_id = p_solicitacao_id
    AND (i.quantidade - COALESCE(i.quantidade_atendida, 0)) > 0;
  IF v_pend = 0 THEN RAISE EXCEPTION 'Nao ha itens pendentes para encaminhar'; END IF;

  -- Resolve categoria herdando dos itens da solicitacao:
  -- 1) itens com est_item_id -> mapeia est_itens.categoria via est_to_cmp_categoria
  -- 2) Se TODAS as linhas (sem itens livres) resultarem na mesma cmp_categoria -> usa.
  -- 3) Caso contrario (heterogenea ou tem item livre) -> COMPRAS_EXTRA.
  SELECT count(*) FILTER (WHERE it.item_id IS NULL),
         count(DISTINCT est_to_cmp_categoria(ei.categoria)) FILTER (WHERE it.item_id IS NOT NULL)
    INTO v_qt_livre, v_qt_cat
  FROM est_solicitacao_itens it
  LEFT JOIN est_itens ei ON ei.id = it.item_id
  WHERE it.solicitacao_id = p_solicitacao_id
    AND (it.quantidade - COALESCE(it.quantidade_atendida, 0)) > 0;

  IF v_qt_livre = 0 AND v_qt_cat = 1 THEN
    SELECT est_to_cmp_categoria(ei.categoria) INTO v_categoria
    FROM est_solicitacao_itens it
    JOIN est_itens ei ON ei.id = it.item_id
    WHERE it.solicitacao_id = p_solicitacao_id
      AND (it.quantidade - COALESCE(it.quantidade_atendida, 0)) > 0
    LIMIT 1;
  ELSE
    v_categoria := 'COMPRAS_EXTRA';
  END IF;

  v_numero := 'RC-' || to_char(now(), 'YYYYMM') || '-' ||
              lpad((floor(random() * 100000))::int::text, 5, '0');

  -- Resolve validador da categoria escolhida
  SELECT validador_tecnico_id INTO v_validador_id
  FROM cmp_categorias WHERE codigo = v_categoria;
  IF v_validador_id IS NOT NULL THEN
    SELECT nome, email INTO v_validador FROM sys_perfis WHERE id = v_validador_id;
  END IF;

  INSERT INTO cmp_requisicoes (
    numero, solicitante_id, solicitante_nome, obra_nome, obra_id,
    descricao, justificativa, urgencia, status, alcada_nivel, valor_estimado, centro_custo,
    base_destino_id, categoria
  ) VALUES (
    v_numero, v_sol.solicitante_id, v_sol.solicitante_nome, v_sol.obra_nome, v_sol.obra_id,
    'Encaminhado da ' || v_sol.numero || ' (triagem CD) - itens sem saldo em estoque',
    'Encaminhamento da triagem do CD (' || v_sol.numero || ')',
    COALESCE(v_sol.urgencia, 'normal')::urgencia_tipo,
    'em_aprovacao'::status_requisicao,
    1, 0, v_sol.centro_custo,
    v_sol.base_destino_id, v_categoria
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
  IF v_validador_id IS NULL THEN
    SELECT nome, email INTO v_aprov FROM sys_usuarios WHERE id = v_alcada.aprovador_padrao_id;
  END IF;

  INSERT INTO apr_aprovacoes (
    modulo, tipo_aprovacao, entidade_id, entidade_numero,
    aprovador_nome, aprovador_email, nivel, status, data_limite
  ) VALUES (
    'cmp', 'requisicao_compra', v_rc_id, v_numero,
    COALESCE(v_validador.nome, v_aprov.nome, v_sol.solicitante_nome),
    COALESCE(v_validador.email, v_aprov.email, 'pendente@teguniao.com.br'),
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
