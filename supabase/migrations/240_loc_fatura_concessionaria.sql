-- 240_loc_fatura_concessionaria.sql
-- Favorecido de fatura de agua/energia e a CONCESSIONARIA, nao o locador.
--
-- loc_enviar_faturas_financeiro copiava loc_imoveis.locador_nome para a CP sem
-- olhar o tipo da fatura. Correto para aluguel; errado para agua e energia, cujo
-- boleto e pago a companhia. Em 06/08/2026 havia 21 CPs assim (15 energia, 6
-- agua, R$ 5.732,29) — todas ainda em 'previsto', nenhuma paga.
--
-- Nao havia onde guardar a concessionaria: loc_faturas nao tinha fornecedor e
-- loc_imoveis so tem locador. Passa a ficar na propria fatura, informada por
-- quem lanca a conta do mes (a UI sugere a ultima usada naquele imovel+tipo).
--
-- A funcao passa a BARRAR agua/energia sem concessionaria: gerar a CP com o
-- locador como favorecido manda dinheiro para a pessoa errada e deixa a conta
-- em aberto na companhia. Melhor a fatura ficar retida com motivo explicito.

ALTER TABLE public.loc_faturas
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.cmp_fornecedores(id);

COMMENT ON COLUMN public.loc_faturas.fornecedor_id IS
  'Favorecido do pagamento. Concessionaria em agua/energia; NULL em aluguel, que paga o locador.';

CREATE INDEX IF NOT EXISTS idx_loc_faturas_fornecedor
  ON public.loc_faturas(imovel_id, tipo, fornecedor_id)
  WHERE fornecedor_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.loc_enviar_faturas_financeiro(p_fatura_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enviadas INT := 0; v_puladas INT := 0; v_motivos jsonb := '[]'::jsonb;
  v_f RECORD; v_ja_existe uuid; v_desc numeric; v_liq numeric;
  v_favorecido text; v_fornecedor_id uuid;
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
      f.fornecedor_id,
      forn.razao_social as fornecedor_razao,
      i.locador_nome, i.codigo as imovel_codigo, i.descricao as imovel_descricao, i.status as imovel_status,
      cc.codigo as centro_custo_codigo
    FROM loc_faturas f
    LEFT JOIN loc_imoveis i ON i.id = f.imovel_id
    LEFT JOIN cmp_fornecedores forn ON forn.id = f.fornecedor_id
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
    SELECT coalesce(sum(valor), 0) INTO v_desc FROM loc_fatura_descontos WHERE fatura_id = v_f.id;
    v_liq := v_f.valor - coalesce(v_desc, 0);
    IF v_f.valor IS NULL OR v_liq <= 0 THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'sem_valor'); CONTINUE;
    END IF;
    IF v_f.imovel_status IN ('inativo', 'em_saida') THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'imovel_inativo'); CONTINUE;
    END IF;

    IF v_f.tipo IN ('agua', 'energia') AND v_f.fornecedor_id IS NULL THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'sem_concessionaria');
      CONTINUE;
    END IF;

    IF v_f.fornecedor_id IS NOT NULL THEN
      v_favorecido := v_f.fornecedor_razao;
      v_fornecedor_id := v_f.fornecedor_id;
    ELSE
      v_favorecido := coalesce(nullif(trim(v_f.locador_nome), ''), 'Locador nao informado');
      v_fornecedor_id := NULL;
    END IF;

    INSERT INTO fin_contas_pagar (
      fornecedor_id, fornecedor_nome, valor_original, valor_pago, data_emissao,
      data_vencimento, data_vencimento_orig,
      centro_custo, descricao, natureza, origem, status, loc_fatura_id, observacoes
    ) VALUES (
      v_fornecedor_id, v_favorecido,
      v_liq, 0, current_date, coalesce(v_f.vencimento, current_date), coalesce(v_f.vencimento, current_date),
      v_f.centro_custo_codigo,
      format('Locacao imovel %s - %s%s', coalesce(v_f.imovel_codigo, v_f.imovel_descricao, '?'), v_f.tipo, coalesce(' - ' || v_f.descricao, '')),
      'locacao_imovel', 'locacao', 'previsto', v_f.id,
      format('Origem: loc_faturas/%s (competencia %s)%s%s', v_f.id, coalesce(to_char(v_f.competencia, 'MM/YYYY'), '?'),
        case when coalesce(v_desc,0) > 0 then format(' | Bruto R$ %s - descontos R$ %s = liquido R$ %s',
          to_char(v_f.valor,'FM999G999G990D00'), to_char(v_desc,'FM999G999G990D00'), to_char(v_liq,'FM999G999G990D00')) else '' end,
        case when v_f.fornecedor_id IS NOT NULL then ' | Favorecido: concessionaria informada na fatura' else '' end)
    );
    UPDATE loc_faturas SET status = 'enviado_pagamento', updated_at = now() WHERE id = v_f.id;
    v_enviadas := v_enviadas + 1;
  END LOOP;
  RETURN jsonb_build_object('enviadas', v_enviadas, 'puladas', v_puladas, 'motivos', v_motivos);
END;
$function$;
