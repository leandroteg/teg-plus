-- ─────────────────────────────────────────────────────────────────────────────
-- 124_loc_enviar_faturas_financeiro.sql
--
-- RPC que recebe um array de IDs de loc_faturas, cria 1 fin_contas_pagar
-- por fatura (status='previsto', natureza='locacao_imovel', origem='locacao')
-- e marca a fatura como status='enviado_pagamento'.
--
-- Fornecedor = locador_nome do imovel. Centro de custo continua via
-- centro_custo_id do imovel (financeiro pode resolver depois).
-- Observacoes referencia loc_faturas/<id> + competencia pra audit.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.loc_enviar_faturas_financeiro(p_fatura_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_enviadas INT := 0;
  v_puladas  INT := 0;
  v_f RECORD;
BEGIN
  IF p_fatura_ids IS NULL OR cardinality(p_fatura_ids) = 0 THEN
    RETURN jsonb_build_object('enviadas', 0, 'puladas', 0, 'msg', 'nenhuma fatura informada');
  END IF;

  FOR v_f IN
    SELECT
      f.id, f.tipo, f.descricao, f.competencia, f.vencimento,
      coalesce(f.valor_confirmado, f.valor_previsto, 0) as valor,
      f.status,
      i.locador_nome, i.codigo as imovel_codigo, i.descricao as imovel_descricao
    FROM loc_faturas f
    LEFT JOIN loc_imoveis i ON i.id = f.imovel_id
    WHERE f.id = ANY(p_fatura_ids)
  LOOP
    -- Pula se ja foi enviado ou paga
    IF v_f.status NOT IN ('previsto', 'lancado') THEN
      v_puladas := v_puladas + 1;
      CONTINUE;
    END IF;

    -- Pula se nao tem valor
    IF v_f.valor IS NULL OR v_f.valor <= 0 THEN
      v_puladas := v_puladas + 1;
      CONTINUE;
    END IF;

    INSERT INTO fin_contas_pagar (
      fornecedor_nome,
      valor_original,
      valor_pago,
      data_emissao,
      data_vencimento,
      data_vencimento_orig,
      descricao,
      natureza,
      origem,
      status,
      observacoes
    ) VALUES (
      coalesce(nullif(trim(v_f.locador_nome), ''), 'Locador nao informado'),
      v_f.valor,
      0,
      current_date,
      coalesce(v_f.vencimento, current_date),
      coalesce(v_f.vencimento, current_date),
      format('Locacao imovel %s - %s%s',
        coalesce(v_f.imovel_codigo, v_f.imovel_descricao, '?'),
        v_f.tipo,
        coalesce(' - ' || v_f.descricao, '')
      ),
      'locacao_imovel',
      'locacao',
      'previsto',
      format('Origem: loc_faturas/%s (competencia %s)',
        v_f.id,
        coalesce(to_char(v_f.competencia, 'MM/YYYY'), '?'))
    );

    UPDATE loc_faturas
    SET status = 'enviado_pagamento', updated_at = now()
    WHERE id = v_f.id;

    v_enviadas := v_enviadas + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'enviadas', v_enviadas,
    'puladas', v_puladas
  );
END;
$function$;

COMMENT ON FUNCTION public.loc_enviar_faturas_financeiro(uuid[]) IS
  'Envia faturas de locacao (loc_faturas) pro financeiro: cria CP por fatura e marca fatura como enviado_pagamento. Pula faturas ja enviadas/pagas e sem valor.';
