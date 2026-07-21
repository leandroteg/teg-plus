-- Forma de faturamento do contrato: 'parcela' (parcelas fixas/mensais pagaveis)
-- ou 'medicao' (pagamento por medicao/BM — sem parcela pagavel pre-gerada).
--
-- Resolve o risco de fonte dupla: contrato por medicao nao deve ter parcela
-- pagavel + medicao somando. Nao da pra derivar o modo automaticamente (os
-- contratos com medicao tem grupos variados), entao e um campo controlavel.
-- Default 'parcela' = comportamento atual (nada muda por padrao).

ALTER TABLE public.con_contratos
  ADD COLUMN IF NOT EXISTS forma_faturamento text NOT NULL DEFAULT 'parcela';

ALTER TABLE public.con_contratos
  DROP CONSTRAINT IF EXISTS con_contratos_forma_faturamento_chk;
ALTER TABLE public.con_contratos
  ADD CONSTRAINT con_contratos_forma_faturamento_chk
  CHECK (forma_faturamento IN ('parcela', 'medicao'));

-- Backfill: contratos que JA usam medicao ficam marcados como 'medicao'
-- (so afeta a visibilidade do botao/coerencia; nao mexe em titulos existentes).
UPDATE public.con_contratos c
   SET forma_faturamento = 'medicao'
 WHERE EXISTS (SELECT 1 FROM con_medicoes m WHERE m.contrato_id = c.id)
   AND c.forma_faturamento <> 'medicao';

-- RPC: troca o modo. Ao virar 'medicao', remove parcelas e seus titulos
-- PREVISTOS nao-pagos (pra nao duplicar com a medicao). Mantem o que ja foi pago.
CREATE OR REPLACE FUNCTION public.con_definir_forma_faturamento(p_contrato_id uuid, p_forma text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_removidos int := 0;
BEGIN
  IF p_forma NOT IN ('parcela', 'medicao') THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'forma_invalida');
  END IF;

  UPDATE con_contratos SET forma_faturamento = p_forma, updated_at = now()
   WHERE id = p_contrato_id;

  IF p_forma = 'medicao' THEN
    CREATE TEMP TABLE _alvo ON COMMIT DROP AS
      SELECT p.id AS parcela_id, p.fin_cp_id, p.fin_cr_id
        FROM con_parcelas p
        LEFT JOIN fin_contas_pagar   cp ON cp.id = p.fin_cp_id
        LEFT JOIN fin_contas_receber cr ON cr.id = p.fin_cr_id
       WHERE p.contrato_id = p_contrato_id
         AND ( (p.fin_cp_id IS NOT NULL AND cp.status = 'previsto' AND coalesce(cp.valor_pago, 0) = 0)
            OR (p.fin_cr_id IS NOT NULL AND cr.status = 'previsto' AND coalesce(cr.valor_recebido, 0) = 0)
            OR (p.fin_cp_id IS NULL AND p.fin_cr_id IS NULL) );

    SELECT count(*) INTO v_removidos FROM _alvo;

    -- parcela referencia o titulo (FK) -> apaga parcela antes do titulo
    DELETE FROM con_parcelas        WHERE id    IN (SELECT parcela_id FROM _alvo);
    DELETE FROM fin_contas_pagar    WHERE id    IN (SELECT fin_cp_id  FROM _alvo WHERE fin_cp_id IS NOT NULL);
    DELETE FROM fin_contas_receber  WHERE id    IN (SELECT fin_cr_id  FROM _alvo WHERE fin_cr_id IS NOT NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'forma', p_forma, 'parcelas_previstas_removidas', v_removidos);
END;
$function$;
