-- ─────────────────────────────────────────────────────────────────────────────
-- 146_cartao_enviar_fatura_financeiro.sql
--
-- Adiciona link CP <-> fatura de cartao e RPC que cria 1 fin_contas_pagar
-- por fatura (status='previsto', natureza='cartao_credito',
-- origem='cartao_fatura'). Espelha o padrao de loc_enviar_faturas_financeiro.
--
-- Fornecedor = nome do cartao (ex: 'Itau Empresarial' / 'Bradesco Visa').
-- Observacoes referencia fin_faturas_cartao/<id> + mes_referencia.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE fin_contas_pagar
  ADD COLUMN IF NOT EXISTS fatura_id uuid
  REFERENCES fin_faturas_cartao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_contas_pagar_fatura_id
  ON fin_contas_pagar(fatura_id)
  WHERE fatura_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cartao_enviar_fatura_financeiro(p_fatura_ids uuid[])
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
      f.id, f.cartao_id, f.mes_referencia, f.data_vencimento,
      f.valor_total, f.status,
      c.nome AS cartao_nome
    FROM fin_faturas_cartao f
    LEFT JOIN fin_cartoes_credito c ON c.id = f.cartao_id
    WHERE f.id = ANY(p_fatura_ids)
  LOOP
    -- Ja existe CP linkado a essa fatura?
    SELECT id INTO v_ja_existe
    FROM fin_contas_pagar
    WHERE fatura_id = v_f.id
    LIMIT 1;

    IF v_ja_existe IS NOT NULL THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'ja_enviada');
      CONTINUE;
    END IF;

    -- Precisa de valor e vencimento
    IF v_f.valor_total IS NULL OR v_f.valor_total <= 0 THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'sem_valor');
      CONTINUE;
    END IF;

    IF v_f.data_vencimento IS NULL THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'sem_vencimento');
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
      cartao_id,
      fatura_id,
      observacoes
    ) VALUES (
      coalesce(nullif(trim(v_f.cartao_nome), ''), 'Cartao de credito'),
      v_f.valor_total,
      0,
      current_date,
      v_f.data_vencimento,
      v_f.data_vencimento,
      format('Fatura %s - %s', coalesce(v_f.cartao_nome, 'Cartao'), v_f.mes_referencia),
      'cartao_credito',
      'cartao_fatura',
      'previsto',
      v_f.cartao_id,
      v_f.id,
      format('Origem: fin_faturas_cartao/%s (mes %s)', v_f.id, v_f.mes_referencia)
    );

    v_enviadas := v_enviadas + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'enviadas', v_enviadas,
    'puladas',  v_puladas,
    'motivos',  v_motivos
  );
END;
$function$;

COMMENT ON FUNCTION public.cartao_enviar_fatura_financeiro(uuid[]) IS
  'Envia fatura(s) de cartao ao financeiro: cria CP previsto vinculado via fatura_id. Pula faturas ja enviadas, sem valor ou sem vencimento.';
