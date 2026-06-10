-- 132: troca de fornecedor escolhido enquanto a cotação está em esclarecimento
--
-- Quando o aprovador devolve a cotação pedindo esclarecimento, o comprador hoje
-- só consegue escrever uma resposta — não troca o fornecedor. Este RPC permite
-- que ele substitua o fornecedor selecionado (entre os já cotados) antes de
-- reenviar para aprovação, mantendo a separação de funções e gravando o "antes/
-- depois" em cmp_historico_status para o aprovador ver a alteração.
--
-- Restrições:
--   - RC tem que estar em status='cotacao_em_esclarecimento'
--   - cotação tem que estar em status='concluida' (já foi finalizada uma vez)
--   - novo fornecedor tem que pertencer à mesma cotação
--   - usuário precisa ter acesso ao módulo 'compras' (can_access_modulo)
--
-- Não suporta split de itens entre fornecedores neste fluxo: a troca afeta
-- apenas o fornecedor primário. Em RCs com split, o comprador continua usando
-- o caminho de cotação completa.

CREATE OR REPLACE FUNCTION public.cmp_trocar_fornecedor_em_esclarecimento(
  p_cotacao_id uuid,
  p_novo_fornecedor_id uuid
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
  v_antes_id uuid;
  v_antes_nome text;
  v_antes_valor numeric;
  v_novo_nome text;
  v_novo_valor numeric;
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
    INTO v_req_id, v_cot_status, v_antes_id, v_antes_nome, v_antes_valor
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

  -- 4) Valida que o novo fornecedor pertence à cotação e capta nome+valor
  SELECT fornecedor_nome, valor_total
    INTO v_novo_nome, v_novo_valor
    FROM cmp_cotacao_fornecedores
   WHERE id = p_novo_fornecedor_id AND cotacao_id = p_cotacao_id;
  IF v_novo_nome IS NULL THEN
    RAISE EXCEPTION 'Fornecedor % não pertence a esta cotação', p_novo_fornecedor_id;
  END IF;

  -- 5) No-op explícito se o fornecedor já é o selecionado
  IF v_antes_id = p_novo_fornecedor_id THEN
    RETURN jsonb_build_object(
      'changed', false,
      'fornecedor_selecionado_id', v_antes_id,
      'fornecedor_selecionado_nome', v_antes_nome,
      'valor_selecionado', v_antes_valor
    );
  END IF;

  -- 6) Atualiza flags de seleção (atômico)
  UPDATE cmp_cotacao_fornecedores
     SET selecionado = false
   WHERE cotacao_id = p_cotacao_id AND selecionado IS TRUE;

  UPDATE cmp_cotacao_fornecedores
     SET selecionado = true
   WHERE id = p_novo_fornecedor_id;

  -- 7) Atualiza ponteiros no cabeçalho da cotação
  UPDATE cmp_cotacoes
     SET fornecedor_selecionado_id = p_novo_fornecedor_id,
         fornecedor_selecionado_nome = v_novo_nome,
         valor_selecionado = v_novo_valor,
         updated_at = now()
   WHERE id = p_cotacao_id;

  -- 8) Registra no histórico (dados_extra.tipo = 'troca_fornecedor_esclarecimento')
  INSERT INTO cmp_historico_status (
    requisicao_id, status_anterior, status_novo,
    responsavel_nome, responsavel_tipo, observacao, dados_extra
  ) VALUES (
    v_req_id,
    v_req_status,
    v_req_status,
    COALESCE(v_autor_nome, 'Sistema'),
    'comprador',
    format('Fornecedor escolhido alterado em esclarecimento: %s → %s',
           COALESCE(v_antes_nome, '—'), v_novo_nome),
    jsonb_build_object(
      'tipo', 'troca_fornecedor_esclarecimento',
      'antes', jsonb_build_object(
        'fornecedor_id', v_antes_id,
        'fornecedor_nome', v_antes_nome,
        'valor_selecionado', v_antes_valor
      ),
      'depois', jsonb_build_object(
        'fornecedor_id', p_novo_fornecedor_id,
        'fornecedor_nome', v_novo_nome,
        'valor_selecionado', v_novo_valor
      )
    )
  );

  RETURN jsonb_build_object(
    'changed', true,
    'fornecedor_selecionado_id', p_novo_fornecedor_id,
    'fornecedor_selecionado_nome', v_novo_nome,
    'valor_selecionado', v_novo_valor
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cmp_trocar_fornecedor_em_esclarecimento(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cmp_trocar_fornecedor_em_esclarecimento(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.cmp_trocar_fornecedor_em_esclarecimento(uuid, uuid) IS
'Permite ao comprador trocar o fornecedor escolhido enquanto a RC está em cotacao_em_esclarecimento. Atualiza cmp_cotacao_fornecedores.selecionado, cmp_cotacoes.fornecedor_selecionado_* e grava o antes/depois em cmp_historico_status.';
