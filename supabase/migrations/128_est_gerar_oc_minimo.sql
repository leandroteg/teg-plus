-- ─────────────────────────────────────────────────────────────────────────────
-- 128_est_gerar_oc_minimo.sql
--
-- RPC que varre est_itens com estoque_minimo > 0, agrega saldo por item+base
-- via est_movimentacoes, e cria 1 cmp_requisicoes (status='rascunho') por base
-- contendo os itens cujo saldo esteja abaixo do estoque_minimo. Quantidade
-- sugerida = (estoque_maximo OR ponto_reposicao OR estoque_minimo*2) - saldo.
--
-- Idempotente: pula item que ja tenha RC em aberto (status in [rascunho,
-- pendente, em_aprovacao, aprovada, em_cotacao, cotacao_enviada,
-- cotacao_aprovada]) cobrindo aquele item (busca via cmp_requisicao_itens).
--
-- Solicitante = "Sistema (estoque minimo)". A RC e criada em rascunho pra
-- comprador validar antes de enviar pra aprovacao.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.est_gerar_oc_minimo(p_base_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_base RECORD;
  v_item RECORD;
  v_rc_id uuid;
  v_rc_numero text;
  v_qtd_sugerida numeric;
  v_total_estimado numeric;
  v_rcs_criadas int := 0;
  v_itens_inclusos int := 0;
  v_itens_ja_pendentes int := 0;
  v_resumo jsonb := '[]'::jsonb;
BEGIN
  -- Loop por base (cada base gera uma RC propria)
  FOR v_base IN
    SELECT id, nome
    FROM est_bases
    WHERE (p_base_id IS NULL OR id = p_base_id)
  LOOP
    v_rc_id := NULL;
    v_rc_numero := NULL;
    v_total_estimado := 0;

    -- Loop por item abaixo do minimo nessa base
    FOR v_item IN
      WITH saldos AS (
        SELECT
          mv.item_id,
          coalesce(sum(
            CASE WHEN mv.tipo IN ('entrada','transferencia_in','ajuste_positivo','devolucao')
                 THEN mv.quantidade ELSE -mv.quantidade END
          ), 0) AS saldo
        FROM est_movimentacoes mv
        WHERE mv.base_id = v_base.id
        GROUP BY mv.item_id
      )
      SELECT
        i.id, i.codigo, i.descricao, i.unidade,
        i.estoque_minimo, i.estoque_maximo, i.ponto_reposicao,
        coalesce(i.valor_medio, i.valor_ultima_entrada, 0) AS valor_ref,
        coalesce(s.saldo, 0) AS saldo
      FROM est_itens i
      LEFT JOIN saldos s ON s.item_id = i.id
      WHERE i.ativo = true
        AND i.estoque_minimo IS NOT NULL
        AND i.estoque_minimo > 0
        AND coalesce(s.saldo, 0) < i.estoque_minimo
    LOOP
      -- Pula se ja existe RC em aberto cobrindo este item
      IF EXISTS (
        SELECT 1 FROM cmp_requisicao_itens ri
        JOIN cmp_requisicoes r ON r.id = ri.requisicao_id
        WHERE ri.item_estoque_id = v_item.id
          AND r.status IN ('rascunho','pendente','em_aprovacao','aprovada',
                           'em_cotacao','cotacao_enviada','cotacao_aprovada',
                           'pedido_emitido','em_entrega')
      ) THEN
        v_itens_ja_pendentes := v_itens_ja_pendentes + 1;
        CONTINUE;
      END IF;

      -- Calcula quantidade sugerida
      v_qtd_sugerida := coalesce(
        nullif(v_item.estoque_maximo, 0),
        nullif(v_item.ponto_reposicao, 0),
        v_item.estoque_minimo * 2
      ) - v_item.saldo;
      IF v_qtd_sugerida <= 0 THEN
        CONTINUE;
      END IF;

      -- Cria a RC na primeira vez que esta base tiver item
      IF v_rc_id IS NULL THEN
        v_rc_numero := 'RC-AUTO-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(
          (
            SELECT coalesce(max(substring(numero from '\d+$')::int), 0) + 1
            FROM cmp_requisicoes
            WHERE numero LIKE 'RC-AUTO-' || to_char(now(), 'YYYYMMDD') || '-%'
          )::text, 3, '0'
        );

        INSERT INTO cmp_requisicoes (
          numero, solicitante_nome, descricao, justificativa,
          categoria, status, urgencia, valor_estimado
        ) VALUES (
          v_rc_numero,
          'Sistema (estoque minimo)',
          format('Reposicao automatica - %s', v_base.nome),
          'RC gerada automaticamente para itens abaixo do estoque minimo. Revise antes de enviar para aprovacao.',
          'MAT_CONSUMO',
          'rascunho',
          'normal',
          0
        )
        RETURNING id INTO v_rc_id;

        v_rcs_criadas := v_rcs_criadas + 1;
      END IF;

      -- Insere item na RC
      INSERT INTO cmp_requisicao_itens (
        requisicao_id, descricao, quantidade, unidade,
        valor_unitario_estimado, valor_total_estimado,
        item_estoque_id, est_item_id, est_item_codigo,
        observacao
      ) VALUES (
        v_rc_id,
        v_item.descricao,
        v_qtd_sugerida,
        coalesce(v_item.unidade, 'UN'),
        v_item.valor_ref,
        v_qtd_sugerida * v_item.valor_ref,
        v_item.id, v_item.id, v_item.codigo,
        format('Saldo atual %s, minimo %s. Reposicao sugerida automatica.',
          v_item.saldo, v_item.estoque_minimo)
      );

      v_total_estimado := v_total_estimado + (v_qtd_sugerida * v_item.valor_ref);
      v_itens_inclusos := v_itens_inclusos + 1;
    END LOOP;

    -- Atualiza valor_estimado da RC se foi criada
    IF v_rc_id IS NOT NULL THEN
      UPDATE cmp_requisicoes
      SET valor_estimado = v_total_estimado
      WHERE id = v_rc_id;

      v_resumo := v_resumo || jsonb_build_object(
        'base', v_base.nome,
        'rc_numero', v_rc_numero,
        'rc_id', v_rc_id,
        'valor_estimado', v_total_estimado
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'rcs_criadas', v_rcs_criadas,
    'itens_inclusos', v_itens_inclusos,
    'itens_ja_pendentes', v_itens_ja_pendentes,
    'resumo', v_resumo
  );
END;
$function$;

COMMENT ON FUNCTION public.est_gerar_oc_minimo(uuid) IS
  'Varre itens com estoque < minimo e cria RCs em rascunho (1 por base) com quantidades sugeridas. Idempotente: pula itens ja cobertos por RC em aberto. Passar p_base_id pra filtrar uma base; nulo = todas.';
