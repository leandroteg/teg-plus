-- ─────────────────────────────────────────────────────────────────────────────
-- 190_cmp_cotacao_parcial_split.sql
--
-- Cotação parcial (split): permite enviar SÓ os itens cotados de uma RC para
-- aprovação/pedido, destacando-os numa RC-filha (mesmo número da mãe + sufixo
-- -B/-C…), e MANTENDO a RC original em cotação com os itens que ainda não têm
-- valor — cotáveis imediatamente, em paralelo.
--
-- Motivação:
--  • Com fornecedor único, o "mapa de escolha por item" não aparece, então nenhum
--    item vinha marcado como selecionado e a emissão de pedido caía no fallback
--    que estampava TODOS os itens da RC — os itens sem valor eram "atendidos"
--    junto e se perdiam.
--  • Manter a MESMA RC em cotação com um lote em aprovação corromperia o motor de
--    aprovação: ele deduz financeira × técnica pelo status único da RC
--    (cotacao_enviada) e resolve aprovações em massa por entidade_id=requisicao_id.
--
-- Por isso o lote cotado vira uma RC-filha própria: cada RC preserva o invariante
-- "1 RC = 1 status = 1 aprovação = 1 cotação" e todo o fluxo a jusante (AprovAi,
-- Emitir Pedido, filas) continua funcionando sem gambiarra.
--
-- Segurança: SECURITY DEFINER (escreve em cmp_requisicoes/_itens/_cotacoes/
-- cmp_cotacao_fornecedores/apr_aprovacoes sob RLS). Só admin ou comprador.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cmp_requisicoes
  ADD COLUMN IF NOT EXISTS dividida_de_id uuid REFERENCES public.cmp_requisicoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cmp_req_dividida_de
  ON public.cmp_requisicoes(dividida_de_id);

COMMENT ON COLUMN public.cmp_requisicoes.dividida_de_id IS
  'RC-mãe de onde este lote foi destacado numa cotação parcial (split). NULL = RC original.';


CREATE OR REPLACE FUNCTION public.cmp_dividir_cotacao_parcial(
  p_cotacao_id       uuid,
  p_item_ids_cotados uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid            uuid := auth.uid();
  v_parent_id      uuid;
  v_comprador_id   uuid;
  v_parent         cmp_requisicoes%ROWTYPE;
  v_total_abertos  int;
  v_cotados        int;
  v_restante       int;
  v_child_valor    numeric;
  v_parent_valor   numeric;
  v_limite         numeric;
  v_alc1           uuid;
  v_alc2           uuid;
  v_nivel          int;
  v_aprovador_id   uuid;
  v_aprovador_nome text := '';
  v_aprovador_mail text := '';
  v_n              int;
  v_suffix         text;
  v_child_numero   text;
  v_child_id       uuid;
BEGIN
  IF p_cotacao_id IS NULL OR p_item_ids_cotados IS NULL OR array_length(p_item_ids_cotados, 1) IS NULL THEN
    RAISE EXCEPTION 'Parâmetros obrigatórios ausentes (cotação e itens cotados)';
  END IF;

  -- Autorização: admin ou comprador (mesmo gate das demais ações de cotação)
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM sys_perfis p WHERE p.auth_id = v_uid AND coalesce(p.comprador, false) = true)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para dividir cotação (requer admin ou comprador)';
  END IF;

  -- Cotação → RC-mãe
  SELECT requisicao_id, comprador_id INTO v_parent_id, v_comprador_id
    FROM cmp_cotacoes WHERE id = p_cotacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotação % não encontrada', p_cotacao_id;
  END IF;

  SELECT * INTO v_parent FROM cmp_requisicoes WHERE id = v_parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requisição-mãe não encontrada';
  END IF;
  IF v_parent.status <> 'em_cotacao' THEN
    RAISE EXCEPTION 'RC-mãe não está em cotação (status atual: %)', v_parent.status;
  END IF;

  -- Valida itens cotados: todos abertos e pertencentes à RC-mãe
  SELECT count(*) INTO v_cotados
    FROM cmp_requisicao_itens
   WHERE id = ANY(p_item_ids_cotados)
     AND requisicao_id = v_parent_id
     AND atendido_em_pedido_id IS NULL;
  IF v_cotados <> array_length(p_item_ids_cotados, 1) THEN
    RAISE EXCEPTION 'Itens cotados inválidos (não pertencem à RC ou já atendidos)';
  END IF;
  IF v_cotados = 0 THEN
    RAISE EXCEPTION 'Nenhum item cotado informado';
  END IF;

  SELECT count(*) INTO v_total_abertos
    FROM cmp_requisicao_itens
   WHERE requisicao_id = v_parent_id
     AND atendido_em_pedido_id IS NULL;
  v_restante := v_total_abertos - v_cotados;
  IF v_restante <= 0 THEN
    RAISE EXCEPTION 'Não há itens restantes — use o envio normal da cotação';
  END IF;

  -- Valor estimado do lote cotado (base p/ alçada da filha)
  SELECT coalesce(sum(quantidade * valor_unitario_estimado), 0) INTO v_child_valor
    FROM cmp_requisicao_itens WHERE id = ANY(p_item_ids_cotados);

  -- Alçada da categoria (mesma regra do useFinalizarCotacao)
  SELECT coalesce(alcada1_limite, 2000), alcada1_aprovador_id, alcada2_aprovador_id
    INTO v_limite, v_alc1, v_alc2
    FROM cmp_categorias WHERE codigo = coalesce(v_parent.categoria, '');
  v_limite := coalesce(v_limite, 2000);
  v_nivel  := CASE WHEN v_child_valor <= v_limite THEN 1 ELSE 2 END;
  v_aprovador_id := CASE WHEN v_child_valor <= v_limite THEN v_alc1 ELSE v_alc2 END;
  IF v_aprovador_id IS NOT NULL THEN
    SELECT coalesce(nome, ''), coalesce(email, '') INTO v_aprovador_nome, v_aprovador_mail
      FROM sys_perfis WHERE id = v_aprovador_id;
  END IF;

  -- Número da filha: número da mãe + sufixo (-B, -C, … depois -27, -28 se passar de Z).
  -- A mãe nunca muda de número (os itens cotados é que saem), então o sufixo é
  -- sequencial pelos filhos já existentes desta mãe.
  SELECT count(*) INTO v_n FROM cmp_requisicoes WHERE dividida_de_id = v_parent_id;
  LOOP
    IF v_n < 25 THEN
      v_suffix := chr(66 + v_n);         -- B..Z
    ELSE
      v_suffix := (v_n + 2)::text;       -- fallback além de Z
    END IF;
    v_child_numero := v_parent.numero || '-' || v_suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM cmp_requisicoes WHERE numero = v_child_numero);
    v_n := v_n + 1;
  END LOOP;

  -- RC-filha: já entra em cotacao_enviada (aprovação financeira do lote cotado).
  INSERT INTO cmp_requisicoes (
    numero, status, dividida_de_id, valor_estimado, alcada_nivel, alcada_atual,
    solicitante_id, solicitante_nome, obra_id, obra_nome, centro_custo, centro_custo_id,
    descricao, justificativa, categoria, comprador_id, urgencia, data_necessidade,
    classe_financeira, classe_financeira_id, base_destino_id, compra_recorrente,
    projeto_id, texto_original
  ) VALUES (
    v_child_numero, 'cotacao_enviada', v_parent_id, v_child_valor, coalesce(v_nivel, 1), 1,
    v_parent.solicitante_id, v_parent.solicitante_nome, v_parent.obra_id, v_parent.obra_nome, v_parent.centro_custo, v_parent.centro_custo_id,
    v_parent.descricao, v_parent.justificativa, v_parent.categoria, v_parent.comprador_id, v_parent.urgencia, v_parent.data_necessidade,
    v_parent.classe_financeira, v_parent.classe_financeira_id, v_parent.base_destino_id, v_parent.compra_recorrente,
    v_parent.projeto_id, v_parent.texto_original
  ) RETURNING id INTO v_child_id;

  -- Move os itens cotados para a filha
  UPDATE cmp_requisicao_itens
     SET requisicao_id = v_child_id
   WHERE id = ANY(p_item_ids_cotados)
     AND requisicao_id = v_parent_id
     AND atendido_em_pedido_id IS NULL;

  -- A cotação concluída passa a pertencer à filha (os fornecedores viajam junto,
  -- pois são ligados por cotacao_id).
  UPDATE cmp_cotacoes SET requisicao_id = v_child_id WHERE id = p_cotacao_id;

  -- Limpa as linhas R$ 0,00 (itens que ficaram na mãe) do comparativo da filha,
  -- pra o aprovador não ver itens sem valor.
  UPDATE cmp_cotacao_fornecedores f
     SET itens_precos = coalesce((
           SELECT jsonb_agg(e)
             FROM jsonb_array_elements(f.itens_precos) e
            WHERE coalesce((e->>'valor_total')::numeric, 0) > 0
         ), '[]'::jsonb)
   WHERE f.cotacao_id = p_cotacao_id
     AND f.itens_precos IS NOT NULL
     AND jsonb_typeof(f.itens_precos) = 'array';

  -- Aprovação financeira da filha (entidade_id = RC-filha → sem colisão com a mãe)
  INSERT INTO apr_aprovacoes (
    modulo, tipo_aprovacao, entidade_id, entidade_numero,
    aprovador_nome, aprovador_email, nivel, status, observacao
  ) VALUES (
    'cmp', 'cotacao', v_child_id, v_child_numero,
    v_aprovador_nome, v_aprovador_mail, coalesce(v_nivel, 1), 'pendente',
    'Aprovação financeira — lote cotado destacado de ' || v_parent.numero
  );

  -- RC-mãe: recalcula valor estimado (só o restante) e mantém em cotação.
  -- Status não muda → não gera ruído em cmp_historico_status.
  SELECT coalesce(sum(quantidade * valor_unitario_estimado), 0) INTO v_parent_valor
    FROM cmp_requisicao_itens WHERE requisicao_id = v_parent_id;
  UPDATE cmp_requisicoes SET valor_estimado = v_parent_valor WHERE id = v_parent_id;

  -- Cotação nova (em_andamento) na mãe → reaparece na fila "Em Cotação",
  -- cotável imediatamente com os itens restantes.
  INSERT INTO cmp_cotacoes (requisicao_id, comprador_id, status)
  VALUES (v_parent_id, v_comprador_id, 'em_andamento');

  RETURN jsonb_build_object(
    'ok', true,
    'child_id', v_child_id,
    'child_numero', v_child_numero,
    'parent_id', v_parent_id,
    'parent_numero', v_parent.numero,
    'cotados', v_cotados,
    'restante', v_restante
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cmp_dividir_cotacao_parcial(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cmp_dividir_cotacao_parcial(uuid, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.cmp_dividir_cotacao_parcial(uuid, uuid[]) IS
  'Cotação parcial: destaca os itens cotados numa RC-filha (numero da mãe + sufixo -B/-C…) que segue para aprovação/pedido, e mantém a RC-mãe em cotação com o restante (cotável em paralelo). Só admin/comprador; RC-mãe deve estar em em_cotacao.';
