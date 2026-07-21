-- Teto de contrato no faturamento de medicao.
--
-- Problema: medicoes geravam conta a pagar/receber sem validar o saldo do
-- contrato. Somadas a parcelas, podiam estourar o valor_total (ex.: contrato
-- de R$1.200 acabar pagando R$1.219). Agora con_faturar_medicao bloqueia se a
-- medicao acumulada ultrapassar valor_total + valor_aditivos.

CREATE OR REPLACE FUNCTION public.con_faturar_medicao(p_medicao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_m         RECORD;
  v_c         RECORD;
  v_ja_cp     uuid;
  v_ja_cr     uuid;
  v_cp_id     uuid;
  v_cr_id     uuid;
  v_venc      date;
  v_sla       integer;
  v_forn_nome text;
  v_cli_nome  text;
  v_desc      text;
  v_medido_acum numeric;
  v_teto        numeric;
BEGIN
  IF p_medicao_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'medicao_id nulo');
  END IF;

  SELECT * INTO v_m
  FROM con_medicoes
  WHERE id = p_medicao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'medicao nao encontrada');
  END IF;

  IF v_m.status <> 'aprovado' THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'medicao nao esta aprovada', 'status', v_m.status);
  END IF;

  IF v_m.valor_liquido IS NULL OR v_m.valor_liquido <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'valor liquido invalido');
  END IF;

  SELECT id INTO v_ja_cp FROM fin_contas_pagar   WHERE medicao_id = v_m.id LIMIT 1;
  SELECT id INTO v_ja_cr FROM fin_contas_receber WHERE medicao_id = v_m.id LIMIT 1;
  IF v_ja_cp IS NOT NULL OR v_ja_cr IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'motivo', 'ja_enviada',
      'cp_id', v_ja_cp, 'cr_id', v_ja_cr
    );
  END IF;

  SELECT c.*,
         cli.nome  AS cliente_nome,
         cli.cnpj  AS cliente_cnpj,
         f.razao_social AS fornecedor_razao,
         f.nome_fantasia AS fornecedor_fantasia
  INTO v_c
  FROM con_contratos c
  LEFT JOIN con_clientes      cli ON cli.id = c.cliente_id
  LEFT JOIN cmp_fornecedores  f   ON f.id   = c.fornecedor_id
  WHERE c.id = v_m.contrato_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'contrato nao encontrado');
  END IF;

  -- ── TETO: medicao acumulada nao pode exceder valor_total + aditivos ──
  SELECT coalesce(sum(valor_medido), 0) INTO v_medido_acum
  FROM con_medicoes
  WHERE contrato_id = v_m.contrato_id
    AND status IN ('aprovado', 'faturado')
    AND id <> v_m.id;

  v_teto := coalesce(v_c.valor_total, 0) + coalesce(v_c.valor_aditivos, 0);

  IF v_teto > 0 AND (v_medido_acum + coalesce(v_m.valor_medido, 0)) > v_teto + 0.01 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'estouro_teto_contrato',
      'mensagem', format(
        'Medicao excede o saldo do contrato. Ja medido: R$ %s, esta medicao: R$ %s, teto (valor + aditivos): R$ %s. Registre um aditivo para ampliar o valor.',
        trim(to_char(v_medido_acum, 'FM999G999G990D00')),
        trim(to_char(coalesce(v_m.valor_medido, 0), 'FM999G999G990D00')),
        trim(to_char(v_teto, 'FM999G999G990D00'))
      ),
      'medido_acumulado', v_medido_acum,
      'nova_medicao', v_m.valor_medido,
      'teto', v_teto,
      'excedente', round((v_medido_acum + coalesce(v_m.valor_medido, 0)) - v_teto, 2)
    );
  END IF;

  v_sla  := COALESCE(v_c.sla_dias_pagamento, 30);
  v_venc := (v_m.periodo_fim + (v_sla || ' days')::interval)::date;
  v_desc := format('Medicao %s - contrato %s (%s a %s)',
                   v_m.numero_bm, v_c.numero,
                   to_char(v_m.periodo_inicio, 'DD/MM/YYYY'),
                   to_char(v_m.periodo_fim,    'DD/MM/YYYY'));

  IF v_c.tipo_contrato = 'receita' THEN
    v_cli_nome := COALESCE(NULLIF(trim(v_c.cliente_nome), ''),
                           NULLIF(trim(v_c.contraparte_nome), ''),
                           'Cliente');

    INSERT INTO fin_contas_receber (
      cliente_nome, cliente_cnpj,
      valor_original, valor_recebido,
      data_emissao, data_vencimento,
      centro_custo, classe_financeira,
      natureza, status,
      descricao, observacoes,
      medicao_id
    ) VALUES (
      v_cli_nome, v_c.cliente_cnpj,
      v_m.valor_liquido, 0,
      current_date, v_venc,
      v_c.centro_custo, v_c.classe_financeira,
      'medicao', 'previsto',
      v_desc,
      format('Origem: con_medicoes/%s (contrato %s)', v_m.id, v_c.numero),
      v_m.id
    )
    RETURNING id INTO v_cr_id;

  ELSIF v_c.tipo_contrato = 'despesa' THEN
    v_forn_nome := COALESCE(NULLIF(trim(v_c.fornecedor_razao), ''),
                            NULLIF(trim(v_c.fornecedor_fantasia), ''),
                            NULLIF(trim(v_c.contraparte_nome), ''),
                            'Fornecedor');

    INSERT INTO fin_contas_pagar (
      fornecedor_id, fornecedor_nome,
      valor_original, valor_pago,
      data_emissao, data_vencimento, data_vencimento_orig,
      centro_custo, classe_financeira,
      natureza, origem, status,
      descricao, observacoes,
      medicao_id
    ) VALUES (
      v_c.fornecedor_id, v_forn_nome,
      v_m.valor_liquido, 0,
      current_date, v_venc, v_venc,
      v_c.centro_custo, v_c.classe_financeira,
      'medicao', 'medicao_contrato', 'previsto',
      v_desc,
      format('Origem: con_medicoes/%s (contrato %s)', v_m.id, v_c.numero),
      v_m.id
    )
    RETURNING id INTO v_cp_id;

  ELSE
    RETURN jsonb_build_object('ok', false, 'motivo', 'tipo_contrato invalido', 'tipo', v_c.tipo_contrato);
  END IF;

  UPDATE con_medicoes
     SET status = 'faturado',
         updated_at = now()
   WHERE id = v_m.id;

  RETURN jsonb_build_object(
    'ok', true,
    'medicao_id', v_m.id,
    'tipo_contrato', v_c.tipo_contrato,
    'cp_id', v_cp_id,
    'cr_id', v_cr_id,
    'data_vencimento', v_venc,
    'valor', v_m.valor_liquido
  );
END;
$function$;
