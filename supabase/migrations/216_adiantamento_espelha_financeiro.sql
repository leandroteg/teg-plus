-- ─────────────────────────────────────────────────────────────────────────────
-- 216_adiantamento_espelha_financeiro.sql
--
-- Dois furos entre Despesas > Adiantamentos e o Financeiro:
--
-- 1) Os anexos do adiantamento (fin_documentos com entity_type='adiantamento')
--    não apareciam na CP, que só lê entity_type='cp'. Quem paga não via o
--    documento que justifica o pagamento. O caminho CP → adiantamento não pode
--    ser feito no cliente: a RLS de desp_adiantamentos só deixa solicitante,
--    gestor, favorecido e admin lerem — o Financeiro não enxerga a linha.
--
-- 2) A CP cancelada no Financeiro deixava o adiantamento eternamente
--    "Aprovado" (AD-202608-73821). O status agora espelha o desfecho.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Status novos: o desfecho do Financeiro ───────────────────────────────
ALTER TABLE public.desp_adiantamentos DROP CONSTRAINT IF EXISTS desp_adiantamentos_status_check;
ALTER TABLE public.desp_adiantamentos ADD CONSTRAINT desp_adiantamentos_status_check
  CHECK (status::text = ANY (ARRAY[
    'solicitado','aprovado','rejeitado',
    'prestacao_pendente','prestacao_enviada','concluido',
    'pago','cancelado'
  ]::text[]));

-- ── 1. Documentos da CP incluindo os do adiantamento de origem ──────────────
CREATE OR REPLACE FUNCTION public.fin_documentos_cp(p_cp_id uuid)
RETURNS TABLE (
  id uuid,
  tipo text,
  nome_arquivo text,
  arquivo_url text,
  uploaded_at timestamptz,
  entity_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT d.id, d.tipo::text, d.nome_arquivo, d.arquivo_url, d.uploaded_at, d.entity_type::text
    FROM fin_documentos d
   WHERE (d.entity_type = 'cp' AND d.entity_id = p_cp_id)
      OR (d.entity_type = 'adiantamento'
          AND d.entity_id IN (SELECT a.id FROM desp_adiantamentos a WHERE a.fin_conta_pagar_id = p_cp_id))
   ORDER BY d.uploaded_at DESC;
$$;

COMMENT ON FUNCTION public.fin_documentos_cp(uuid) IS
  'Anexos da CP + os do adiantamento que a originou. SECURITY DEFINER porque a RLS de desp_adiantamentos esconde a linha do Financeiro.';

GRANT EXECUTE ON FUNCTION public.fin_documentos_cp(uuid) TO authenticated;

-- ── 2. Status do adiantamento segue o desfecho da CP ────────────────────────
CREATE OR REPLACE FUNCTION public.fn_adiantamento_espelha_cp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_novo text;
BEGIN
  IF NEW.status::text = COALESCE(OLD.status::text, '') THEN
    RETURN NEW;
  END IF;

  v_novo := CASE NEW.status::text
              WHEN 'cancelado'  THEN 'cancelado'
              WHEN 'pago'       THEN 'pago'
              WHEN 'conciliado' THEN 'pago'
              ELSE NULL
            END;

  IF v_novo IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE desp_adiantamentos
     SET status     = v_novo,
         updated_at = now()
   WHERE fin_conta_pagar_id = NEW.id
     AND status <> v_novo
     -- Rejeitado pelo gestor é decisão anterior; o Financeiro não a reescreve.
     AND status <> 'rejeitado';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_adiantamento_espelha_cp ON public.fin_contas_pagar;
CREATE TRIGGER trg_adiantamento_espelha_cp
AFTER UPDATE OF status ON public.fin_contas_pagar
FOR EACH ROW
EXECUTE FUNCTION public.fn_adiantamento_espelha_cp();

-- ── 3. Acerta o que já divergiu ─────────────────────────────────────────────
UPDATE public.desp_adiantamentos a
   SET status = CASE cp.status::text
                  WHEN 'cancelado'  THEN 'cancelado'
                  WHEN 'pago'       THEN 'pago'
                  WHEN 'conciliado' THEN 'pago'
                END,
       updated_at = now()
  FROM public.fin_contas_pagar cp
 WHERE cp.id = a.fin_conta_pagar_id
   AND cp.status::text IN ('cancelado', 'pago', 'conciliado')
   AND a.status <> 'rejeitado'
   AND a.status <> CASE cp.status::text
                     WHEN 'cancelado'  THEN 'cancelado'
                     WHEN 'pago'       THEN 'pago'
                     WHEN 'conciliado' THEN 'pago'
                   END;
