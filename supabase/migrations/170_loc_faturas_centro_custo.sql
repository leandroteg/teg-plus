-- Locacao: propagar centro de custo (e obra) da fatura ate o Financeiro.
--
-- Antes: loc_gerar_faturas_mes nao copiava centro_custo_id/obra_id do imovel
-- para a fatura, e loc_enviar_faturas_financeiro nao preenchia centro_custo no
-- titulo de contas a pagar. Resultado: CP de locacao sem centro de custo
-- (sem rateio/alocacao). fin_contas_pagar nao tem coluna de obra, entao so o
-- centro de custo (texto) e propagado ao financeiro.

-- 1. Gerador de faturas: herda centro_custo_id e obra_id do imovel.
CREATE OR REPLACE FUNCTION public.loc_gerar_faturas_mes(p_competencia date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_imovel       RECORD;
  v_tipo         text;
  v_tipos        text[] := ARRAY['aluguel','iptu','condominio','energia','agua','internet'];
  v_competencia  date;
  v_vencimento   date;
  v_dia_venc     int;
  v_valor        numeric;
  v_criadas      int := 0;
  v_puladas      int := 0;
  v_imoveis_ok   int := 0;
BEGIN
  IF NOT can_access_modulo('locacao', auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao no modulo Locacao';
  END IF;

  v_competencia := date_trunc('month', p_competencia)::date;

  FOR v_imovel IN
    SELECT id, codigo, descricao, status,
           coalesce(valor_aluguel_mensal, 0) AS valor_aluguel,
           coalesce(dia_vencimento, 5) AS dia_vencimento,
           centro_custo_id, obra_id
    FROM loc_imoveis
    WHERE status = 'ativo'
  LOOP
    v_imoveis_ok := v_imoveis_ok + 1;
    v_dia_venc := least(greatest(v_imovel.dia_vencimento, 1), 28);
    v_vencimento := (v_competencia + interval '1 month')::date
                    + (v_dia_venc - 1) * interval '1 day';

    FOREACH v_tipo IN ARRAY v_tipos
    LOOP
      v_valor := CASE WHEN v_tipo = 'aluguel' THEN v_imovel.valor_aluguel ELSE 0 END;

      IF EXISTS (
        SELECT 1 FROM loc_faturas
        WHERE imovel_id = v_imovel.id AND tipo = v_tipo AND competencia = v_competencia
      ) THEN
        v_puladas := v_puladas + 1;
        CONTINUE;
      END IF;

      INSERT INTO loc_faturas (
        imovel_id, tipo, descricao,
        competencia, vencimento,
        valor_previsto, status, recorrente, dia_recorrencia,
        centro_custo_id, obra_id
      ) VALUES (
        v_imovel.id, v_tipo,
        format('%s %s/%s', initcap(v_tipo),
          to_char(v_competencia, 'MM'), to_char(v_competencia, 'YYYY')),
        v_competencia, v_vencimento::date,
        v_valor, 'previsto', true, v_dia_venc,
        v_imovel.centro_custo_id, v_imovel.obra_id
      );
      v_criadas := v_criadas + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'competencia', to_char(v_competencia, 'YYYY-MM'),
    'imoveis_ativos', v_imoveis_ok,
    'criadas', v_criadas,
    'puladas_existentes', v_puladas
  );
END;
$function$;

-- 2. Envio ao Financeiro: resolve centro_custo (texto) do fatura/imovel no titulo.
CREATE OR REPLACE FUNCTION public.loc_enviar_faturas_financeiro(p_fatura_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enviadas INT := 0;
  v_puladas  INT := 0;
  v_motivos  jsonb := '[]'::jsonb;
  v_f RECORD;
  v_ja_existe uuid;
BEGIN
  IF p_fatura_ids IS NULL OR cardinality(p_fatura_ids) = 0 THEN
    RETURN jsonb_build_object('enviadas', 0, 'puladas', 0, 'msg', 'nenhuma fatura informada');
  END IF;

  FOR v_f IN
    SELECT
      f.id, f.tipo, f.descricao, f.competencia, f.vencimento,
      coalesce(f.valor_confirmado, f.valor_previsto, 0) as valor,
      f.status,
      i.locador_nome, i.codigo as imovel_codigo, i.descricao as imovel_descricao,
      i.status as imovel_status,
      cc.codigo as centro_custo_codigo
    FROM loc_faturas f
    LEFT JOIN loc_imoveis i ON i.id = f.imovel_id
    LEFT JOIN sys_centros_custo cc ON cc.id = coalesce(f.centro_custo_id, i.centro_custo_id)
    WHERE f.id = ANY(p_fatura_ids)
  LOOP
    SELECT id INTO v_ja_existe FROM fin_contas_pagar WHERE loc_fatura_id = v_f.id LIMIT 1;
    IF v_ja_existe IS NOT NULL THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'ja_enviada');
      CONTINUE;
    END IF;

    IF v_f.status NOT IN ('previsto', 'lancado') THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'status_invalido');
      CONTINUE;
    END IF;

    IF v_f.valor IS NULL OR v_f.valor <= 0 THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'sem_valor');
      CONTINUE;
    END IF;

    IF v_f.imovel_status IN ('inativo', 'em_saida') THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'imovel_inativo');
      CONTINUE;
    END IF;

    INSERT INTO fin_contas_pagar (
      fornecedor_nome, valor_original, valor_pago,
      data_emissao, data_vencimento, data_vencimento_orig,
      centro_custo,
      descricao, natureza, origem, status,
      loc_fatura_id, observacoes
    ) VALUES (
      coalesce(nullif(trim(v_f.locador_nome), ''), 'Locador nao informado'),
      v_f.valor, 0,
      current_date,
      coalesce(v_f.vencimento, current_date),
      coalesce(v_f.vencimento, current_date),
      v_f.centro_custo_codigo,
      format('Locacao imovel %s - %s%s',
        coalesce(v_f.imovel_codigo, v_f.imovel_descricao, '?'),
        v_f.tipo,
        coalesce(' - ' || v_f.descricao, '')),
      'locacao_imovel', 'locacao', 'previsto',
      v_f.id,
      format('Origem: loc_faturas/%s (competencia %s)',
        v_f.id, coalesce(to_char(v_f.competencia, 'MM/YYYY'), '?'))
    );

    UPDATE loc_faturas SET status = 'enviado_pagamento', updated_at = now() WHERE id = v_f.id;
    v_enviadas := v_enviadas + 1;
  END LOOP;

  RETURN jsonb_build_object('enviadas', v_enviadas, 'puladas', v_puladas, 'motivos', v_motivos);
END;
$function$;
