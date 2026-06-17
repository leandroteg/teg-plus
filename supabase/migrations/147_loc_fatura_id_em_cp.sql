-- ─────────────────────────────────────────────────────────────────────────────
-- 147_loc_fatura_id_em_cp.sql
--
-- Adiciona fin_contas_pagar.loc_fatura_id (FK loc_faturas) e atualiza o RPC
-- loc_enviar_faturas_financeiro para preencher o link e ficar idempotente
-- (pula se ja existe CP linkado, mesma protecao do RPC de cartao).
--
-- A coluna 'fatura_id' (146) refere fin_faturas_cartao. Esta 'loc_fatura_id'
-- e separada por questao de tipagem (FKs apontam pra tabelas diferentes); o
-- frontend usa uma OU outra, nunca ambas no mesmo CP.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE fin_contas_pagar
  ADD COLUMN IF NOT EXISTS loc_fatura_id uuid
  REFERENCES loc_faturas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_contas_pagar_loc_fatura_id
  ON fin_contas_pagar(loc_fatura_id)
  WHERE loc_fatura_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.loc_enviar_faturas_financeiro(p_fatura_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
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
      i.locador_nome, i.codigo as imovel_codigo, i.descricao as imovel_descricao
    FROM loc_faturas f
    LEFT JOIN loc_imoveis i ON i.id = f.imovel_id
    WHERE f.id = ANY(p_fatura_ids)
  LOOP
    -- Idempotencia: ja existe CP linkado?
    SELECT id INTO v_ja_existe
    FROM fin_contas_pagar
    WHERE loc_fatura_id = v_f.id
    LIMIT 1;

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

    INSERT INTO fin_contas_pagar (
      fornecedor_nome, valor_original, valor_pago,
      data_emissao, data_vencimento, data_vencimento_orig,
      descricao, natureza, origem, status,
      loc_fatura_id,
      observacoes
    ) VALUES (
      coalesce(nullif(trim(v_f.locador_nome), ''), 'Locador nao informado'),
      v_f.valor, 0,
      current_date,
      coalesce(v_f.vencimento, current_date),
      coalesce(v_f.vencimento, current_date),
      format('Locacao imovel %s - %s%s',
        coalesce(v_f.imovel_codigo, v_f.imovel_descricao, '?'),
        v_f.tipo,
        coalesce(' - ' || v_f.descricao, '')),
      'locacao_imovel', 'locacao', 'previsto',
      v_f.id,
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
    'puladas',  v_puladas,
    'motivos',  v_motivos
  );
END;
$function$;

COMMENT ON FUNCTION public.loc_enviar_faturas_financeiro(uuid[]) IS
  'Envia fatura(s) de locacao ao financeiro: cria CP previsto vinculado via loc_fatura_id. Pula faturas ja enviadas, com status invalido ou sem valor.';
