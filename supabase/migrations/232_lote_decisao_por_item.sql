-- ─────────────────────────────────────────────────────────────────────────────
-- 232 — Decisão título a título no lote de pagamento
--
-- Como era: a aprovação do lote era um único ato. O aprovador marcava os itens
-- que queria e clicava aprovar; a aprovação fechava na hora e o que não estava
-- marcado saía para um LOTE NOVO em montagem. Dois efeitos ruins:
--   • aprovar um de cada vez gerava um lote novo por decisão (proliferação);
--   • quem selecionava um item e aprovava, sem entender que a decisão valia
--     para o lote, liberava o resto sem querer (aconteceu em 05/08).
--
-- Como fica: cada título é decidido isoladamente e o lote SEGUE O MESMO.
--   • aprovado  → CP vai para aprovado_pgto e o Financeiro já pode pagar,
--                 mesmo com os outros ainda em aprovação;
--   • rejeitado → sai do lote e volta para 'confirmado' na fila do Financeiro,
--                 com o motivo registrado (decisão do Elton, 05/08);
--   • a aprovação (apr_aprovacoes) só fecha quando o último item é decidido —
--     enquanto houver pendente, o lote continua na fila do aprovador.
--
-- As abas do Contas a Pagar são por status do TÍTULO e o card de lote monta a
-- ação só com os títulos da aba, então lote parcialmente aprovado não corre o
-- risco de pagar item não aprovado.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_lote_item_decidir(
  p_lote_item_id uuid,
  p_decisao      text,
  p_motivo       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item      fin_lote_itens%ROWTYPE;
  v_lote      fin_lotes_pagamento%ROWTYPE;
  v_apr       apr_aprovacoes%ROWTYPE;
  v_nome      text;
  v_alcada    int;
  v_papel     text;
  v_pendentes int;
  v_aprovados int;
  v_rejeitados int;
  v_restantes int;
  v_valor     numeric;
  v_agora     timestamptz := now();
BEGIN
  IF p_decisao NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Decisao invalida: use aprovado ou rejeitado';
  END IF;

  SELECT * INTO v_item FROM fin_lote_itens WHERE id = p_lote_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item do lote nao encontrado'; END IF;

  SELECT * INTO v_lote FROM fin_lotes_pagamento WHERE id = v_item.lote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote nao encontrado'; END IF;

  -- Aprovação do lote (pode não existir se o lote ainda está em montagem)
  SELECT * INTO v_apr
    FROM apr_aprovacoes
   WHERE entidade_id = v_lote.id AND status = 'pendente'
   ORDER BY created_at DESC LIMIT 1;

  SELECT nome, COALESCE(alcada_nivel, 0), COALESCE(papel_global, '')
    INTO v_nome, v_alcada, v_papel
    FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true LIMIT 1;

  -- Mesma régua do frontend: admin/CEO/diretor decidem qualquer nível; os
  -- demais precisam de alçada igual ou maior que a da aprovação.
  IF NOT (
    is_admin()
    OR v_papel IN ('ceo', 'diretor')
    OR (v_apr.id IS NOT NULL AND v_alcada >= v_apr.nivel)
  ) THEN
    RAISE EXCEPTION 'Sem alcada para decidir este titulo';
  END IF;

  IF v_item.decisao <> 'pendente' THEN
    RAISE EXCEPTION 'Este titulo já foi % em %',
      v_item.decisao, to_char(v_item.decidido_em, 'DD/MM/YYYY HH24:MI');
  END IF;

  IF p_decisao = 'rejeitado' AND COALESCE(TRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo da recusa do titulo';
  END IF;

  UPDATE fin_lote_itens
     SET decisao      = p_decisao,
         decidido_por = COALESCE(v_nome, 'Aprovador'),
         decidido_em  = v_agora,
         observacao   = NULLIF(TRIM(COALESCE(p_motivo, '')), '')
   WHERE id = p_lote_item_id;

  IF p_decisao = 'aprovado' THEN
    -- Libera só este título para o Financeiro pagar.
    UPDATE fin_contas_pagar
       SET status       = 'aprovado_pgto',
           aprovado_por = COALESCE(v_nome, 'Aprovador'),
           aprovado_em  = v_agora,
           updated_at   = v_agora
     WHERE id = v_item.cp_id
       AND status NOT IN ('pago', 'conciliado', 'cancelado');
  ELSE
    -- Recusado sai do lote e volta solto para a fila do Financeiro (opção A).
    UPDATE fin_contas_pagar
       SET status     = 'confirmado',
           lote_id    = NULL,
           updated_at = v_agora
     WHERE id = v_item.cp_id
       AND status NOT IN ('pago', 'conciliado', 'cancelado');
  END IF;

  SELECT count(*) FILTER (WHERE decisao = 'pendente'),
         count(*) FILTER (WHERE decisao = 'aprovado'),
         count(*) FILTER (WHERE decisao = 'rejeitado')
    INTO v_pendentes, v_aprovados, v_rejeitados
    FROM fin_lote_itens WHERE lote_id = v_lote.id;

  -- O lote passa a valer pelos títulos que continuam nele.
  SELECT count(*), COALESCE(sum(valor), 0)
    INTO v_restantes, v_valor
    FROM fin_lote_itens WHERE lote_id = v_lote.id AND decisao <> 'rejeitado';

  UPDATE fin_lotes_pagamento
     SET status = CASE
           WHEN v_pendentes > 0 THEN 'enviado_aprovacao'
           WHEN v_aprovados = 0 THEN 'cancelado'
           WHEN v_rejeitados > 0 THEN 'parcialmente_aprovado'
           ELSE 'aprovado'
         END,
         qtd_itens   = v_restantes,
         valor_total = v_valor,
         updated_at  = v_agora
   WHERE id = v_lote.id;

  -- Aprovação fecha só no último item: enquanto houver pendente, o lote
  -- continua aparecendo para o aprovador.
  IF v_pendentes = 0 AND v_apr.id IS NOT NULL THEN
    UPDATE apr_aprovacoes
       SET status       = CASE WHEN v_aprovados > 0 THEN 'aprovada' ELSE 'rejeitada' END::status_aprovacao,
           data_decisao = v_agora,
           aprovador_nome  = COALESCE(v_nome, aprovador_nome),
           observacao   = concat_ws(' | ', NULLIF(observacao, ''),
                            format('Decidido item a item: %s aprovado(s), %s recusado(s)', v_aprovados, v_rejeitados))
     WHERE id = v_apr.id;
  END IF;

  RETURN jsonb_build_object(
    'decisao',    p_decisao,
    'pendentes',  v_pendentes,
    'aprovados',  v_aprovados,
    'rejeitados', v_rejeitados,
    'total',      v_pendentes + v_aprovados + v_rejeitados,
    'lote_fechado', v_pendentes = 0
  );
END;
$function$;

COMMENT ON FUNCTION public.fin_lote_item_decidir(uuid, text, text) IS
  'Decide um titulo do lote isoladamente. Aprovado libera a CP para pagamento; rejeitado sai do lote e volta para confirmado. A aprovacao do lote so fecha quando nao resta item pendente.';

GRANT EXECUTE ON FUNCTION public.fin_lote_item_decidir(uuid, text, text) TO authenticated;

-- ── Resolver: rejeição precisa conseguir puxar título já liberado ────────────
-- A guarda antiga tinha 'aprovado_pgto' na lista do NOT IN, então rejeitar um
-- item depois da aprovação do lote não mexia na CP: o título seguia liberado
-- para pagamento em silêncio. Pago/conciliado/em pagamento continuam fora —
-- esses exigem estorno.
CREATE OR REPLACE FUNCTION public.rpc_resolver_lote_status(p_lote_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total      INT;
  v_aprovados  INT;
  v_rejeitados INT;
  v_pendentes  INT;
  v_new_status TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE decisao = 'aprovado'),
    COUNT(*) FILTER (WHERE decisao = 'rejeitado'),
    COUNT(*) FILTER (WHERE decisao = 'pendente')
  INTO v_total, v_aprovados, v_rejeitados, v_pendentes
  FROM fin_lote_itens
  WHERE lote_id = p_lote_id;

  IF v_total = 0 THEN
    RETURN 'montando';
  END IF;

  IF v_pendentes > 0 THEN
    v_new_status := 'enviado_aprovacao';
  ELSIF v_aprovados = v_total THEN
    v_new_status := 'aprovado';
  ELSIF v_aprovados > 0 THEN
    v_new_status := 'parcialmente_aprovado';
  ELSE
    v_new_status := 'enviado_aprovacao';
  END IF;

  UPDATE fin_lotes_pagamento
  SET status = v_new_status, updated_at = now()
  WHERE id = p_lote_id;

  UPDATE fin_contas_pagar
  SET status = 'aprovado_pgto',
      aprovado_por = li.decidido_por,
      aprovado_em  = li.decidido_em,
      updated_at   = now()
  FROM fin_lote_itens li
  WHERE fin_contas_pagar.id = li.cp_id
    AND li.lote_id = p_lote_id
    AND li.decisao = 'aprovado'
    AND fin_contas_pagar.status != 'aprovado_pgto';

  -- Rejeitado volta para a fila do Financeiro e sai do lote (opção A).
  UPDATE fin_contas_pagar
  SET status = 'confirmado', lote_id = NULL, updated_at = now()
  FROM fin_lote_itens li
  WHERE fin_contas_pagar.id = li.cp_id
    AND li.lote_id = p_lote_id
    AND li.decisao = 'rejeitado'
    AND fin_contas_pagar.status NOT IN ('em_pagamento','pago','conciliado','cancelado');

  RETURN v_new_status;
END;
$function$;
