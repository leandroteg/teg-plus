-- 133: renegociacao do valor total do fornecedor escolhido em esclarecimento
--
-- Complementa a migration 132 (troca de fornecedor). Aqui o comprador NAO troca
-- de fornecedor: ele mantem o mesmo fornecedor selecionado e atualiza apenas o
-- valor_total — caso tipico, conseguiu desconto ao renegociar antes de reenviar
-- a cotacao ao aprovador. O antes/depois fica em cmp_historico_status pra o
-- aprovador enxergar a alteracao.
--
-- Restricoes:
--   - RC tem que estar em status='cotacao_em_esclarecimento'
--   - cotacao tem que estar em status='concluida'
--   - fornecedor informado tem que pertencer a cotacao E estar selecionado=true
--     (pra trocar de fornecedor o caminho continua sendo a RPC da mig 132)
--   - novo valor > 0 e diferente do atual (no-op explicito se igual)
--   - usuario precisa ter acesso ao modulo 'compras' (can_access_modulo)

CREATE OR REPLACE FUNCTION public.cmp_renegociar_valor_em_esclarecimento(
  p_cotacao_id uuid,
  p_fornecedor_id uuid,
  p_novo_valor_total numeric,
  p_observacao text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_req_id uuid;
  v_req_status text;
  v_cot_status text;
  v_autor_id uuid;
  v_autor_nome text;
  v_sel_id uuid;
  v_sel_nome text;
  v_valor_anterior numeric;
  v_forn_nome text;
  v_forn_selecionado boolean;
  v_forn_valor numeric;
BEGIN
  -- 1) Identifica o autor
  SELECT id, nome INTO v_autor_id, v_autor_nome
    FROM sys_perfis WHERE auth_id = auth.uid();
  IF v_autor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou sem perfil cadastrado';
  END IF;

  -- 2) Bloqueia se usuário não tem acesso ao módulo de compras
  IF NOT public.can_access_modulo(auth.uid(), 'compras') THEN
    RAISE EXCEPTION 'Sem permissão para alterar cotações de compras';
  END IF;

  -- 3) Recupera estado atual da cotação + RC + fornecedor selecionado
  SELECT c.requisicao_id, c.status::text, c.fornecedor_selecionado_id,
         c.fornecedor_selecionado_nome, c.valor_selecionado
    INTO v_req_id, v_cot_status, v_sel_id, v_sel_nome, v_valor_anterior
    FROM cmp_cotacoes c
   WHERE c.id = p_cotacao_id;

  IF v_req_id IS NULL THEN
    RAISE EXCEPTION 'Cotação % não encontrada', p_cotacao_id;
  END IF;
  IF v_cot_status IS DISTINCT FROM 'concluida' THEN
    RAISE EXCEPTION 'Cotação não está concluída (status atual: %)', v_cot_status;
  END IF;

  SELECT status::text INTO v_req_status
    FROM cmp_requisicoes WHERE id = v_req_id;
  IF v_req_status IS DISTINCT FROM 'cotacao_em_esclarecimento' THEN
    RAISE EXCEPTION 'RC não está em esclarecimento de cotação (status atual: %)', v_req_status;
  END IF;

  -- 4) Valida que o fornecedor pertence à cotação e está selecionado
  SELECT fornecedor_nome, selecionado, valor_total
    INTO v_forn_nome, v_forn_selecionado, v_forn_valor
    FROM cmp_cotacao_fornecedores
   WHERE id = p_fornecedor_id AND cotacao_id = p_cotacao_id;
  IF v_forn_nome IS NULL THEN
    RAISE EXCEPTION 'Fornecedor % não pertence a esta cotação', p_fornecedor_id;
  END IF;
  IF v_forn_selecionado IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Fornecedor informado não é o selecionado da cotação. Para trocar o fornecedor, use o fluxo de troca.';
  END IF;

  -- 5) Valida novo valor
  IF p_novo_valor_total IS NULL OR p_novo_valor_total <= 0 THEN
    RAISE EXCEPTION 'Novo valor total deve ser maior que zero';
  END IF;

  -- 6) No-op explícito se valor não mudou
  IF v_forn_valor = p_novo_valor_total THEN
    RETURN jsonb_build_object(
      'changed', false,
      'valor_anterior', v_forn_valor,
      'valor_selecionado', v_forn_valor,
      'fornecedor_selecionado_id', v_sel_id,
      'fornecedor_selecionado_nome', v_sel_nome
    );
  END IF;

  -- 7) Atualiza valor no fornecedor e no cabeçalho da cotação
  UPDATE cmp_cotacao_fornecedores
     SET valor_total = p_novo_valor_total
   WHERE id = p_fornecedor_id;

  UPDATE cmp_cotacoes
     SET valor_selecionado = p_novo_valor_total,
         updated_at = now()
   WHERE id = p_cotacao_id;

  -- 8) Registra no histórico (dados_extra.tipo = 'renegociacao_valor_esclarecimento')
  INSERT INTO cmp_historico_status (
    requisicao_id, status_anterior, status_novo,
    responsavel_nome, responsavel_tipo, observacao, dados_extra
  ) VALUES (
    v_req_id,
    v_req_status,
    v_req_status,
    COALESCE(v_autor_nome, 'Sistema'),
    'comprador',
    format('Valor renegociado em esclarecimento: R$ %s → R$ %s (obs: %s)',
           to_char(v_valor_anterior, 'FM999G999G990D00'),
           to_char(p_novo_valor_total, 'FM999G999G990D00'),
           COALESCE(NULLIF(p_observacao, ''), '—')),
    jsonb_build_object(
      'tipo', 'renegociacao_valor_esclarecimento',
      'antes', jsonb_build_object(
        'fornecedor_id', p_fornecedor_id,
        'fornecedor_nome', v_forn_nome,
        'valor_total', v_valor_anterior
      ),
      'depois', jsonb_build_object(
        'fornecedor_id', p_fornecedor_id,
        'fornecedor_nome', v_forn_nome,
        'valor_total', p_novo_valor_total
      ),
      'observacao_comprador', p_observacao
    )
  );

  RETURN jsonb_build_object(
    'changed', true,
    'valor_anterior', v_valor_anterior,
    'valor_selecionado', p_novo_valor_total,
    'fornecedor_selecionado_id', p_fornecedor_id,
    'fornecedor_selecionado_nome', v_forn_nome
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cmp_renegociar_valor_em_esclarecimento(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cmp_renegociar_valor_em_esclarecimento(uuid, uuid, numeric, text) TO authenticated;

COMMENT ON FUNCTION public.cmp_renegociar_valor_em_esclarecimento(uuid, uuid, numeric, text) IS
'Permite ao comprador renegociar o valor total do fornecedor selecionado enquanto a RC está em cotacao_em_esclarecimento, sem trocar de fornecedor. Atualiza cmp_cotacao_fornecedores.valor_total, cmp_cotacoes.valor_selecionado e grava o antes/depois em cmp_historico_status.';
