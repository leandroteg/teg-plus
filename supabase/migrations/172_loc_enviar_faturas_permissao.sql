-- Consistencia/seguranca: loc_enviar_faturas_financeiro nao tinha a trava de
-- modulo que loc_gerar_faturas_mes e loc_cancelar_envio_fatura ja tem. Adiciona
-- can_access_modulo('locacao') no inicio. Corpo identico ao da mig 170.
CREATE OR REPLACE FUNCTION public.loc_enviar_faturas_financeiro(p_fatura_ids uuid[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_enviadas INT := 0; v_puladas INT := 0; v_motivos jsonb := '[]'::jsonb;
  v_f RECORD; v_ja_existe uuid;
BEGIN
  IF NOT can_access_modulo('locacao', auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao no modulo Locacao';
  END IF;

  IF p_fatura_ids IS NULL OR cardinality(p_fatura_ids) = 0 THEN
    RETURN jsonb_build_object('enviadas', 0, 'puladas', 0, 'msg', 'nenhuma fatura informada');
  END IF;
  FOR v_f IN
    SELECT f.id, f.tipo, f.descricao, f.competencia, f.vencimento,
      coalesce(f.valor_confirmado, f.valor_previsto, 0) as valor, f.status,
      i.locador_nome, i.codigo as imovel_codigo, i.descricao as imovel_descricao, i.status as imovel_status,
      cc.codigo as centro_custo_codigo
    FROM loc_faturas f
    LEFT JOIN loc_imoveis i ON i.id = f.imovel_id
    LEFT JOIN sys_centros_custo cc ON cc.id = coalesce(f.centro_custo_id, i.centro_custo_id)
    WHERE f.id = ANY(p_fatura_ids)
  LOOP
    SELECT id INTO v_ja_existe FROM fin_contas_pagar WHERE loc_fatura_id = v_f.id LIMIT 1;
    IF v_ja_existe IS NOT NULL THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'ja_enviada'); CONTINUE;
    END IF;
    IF v_f.status NOT IN ('previsto', 'lancado') THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'status_invalido'); CONTINUE;
    END IF;
    IF v_f.valor IS NULL OR v_f.valor <= 0 THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'sem_valor'); CONTINUE;
    END IF;
    IF v_f.imovel_status IN ('inativo', 'em_saida') THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'imovel_inativo'); CONTINUE;
    END IF;
    INSERT INTO fin_contas_pagar (
      fornecedor_nome, valor_original, valor_pago, data_emissao, data_vencimento, data_vencimento_orig,
      centro_custo, descricao, natureza, origem, status, loc_fatura_id, observacoes
    ) VALUES (
      coalesce(nullif(trim(v_f.locador_nome), ''), 'Locador nao informado'),
      v_f.valor, 0, current_date, coalesce(v_f.vencimento, current_date), coalesce(v_f.vencimento, current_date),
      v_f.centro_custo_codigo,
      format('Locacao imovel %s - %s%s', coalesce(v_f.imovel_codigo, v_f.imovel_descricao, '?'), v_f.tipo, coalesce(' - ' || v_f.descricao, '')),
      'locacao_imovel', 'locacao', 'previsto', v_f.id,
      format('Origem: loc_faturas/%s (competencia %s)', v_f.id, coalesce(to_char(v_f.competencia, 'MM/YYYY'), '?'))
    );
    UPDATE loc_faturas SET status = 'enviado_pagamento', updated_at = now() WHERE id = v_f.id;
    v_enviadas := v_enviadas + 1;
  END LOOP;
  RETURN jsonb_build_object('enviadas', v_enviadas, 'puladas', v_puladas, 'motivos', v_motivos);
END;
$function$;
