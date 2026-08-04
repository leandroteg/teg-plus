-- ─────────────────────────────────────────────────────────────────────────────
-- 20260802000011_adiantamento_gera_cp.sql
--
-- Adiantamento aprovado pelo gestor entra no Financeiro como CONTA A PAGAR
-- CONFIRMADA do favorecido (aba "Confirmados" → pronta p/ entrar em lote).
--
-- Trigger no banco (e não no front) porque:
--   • funciona por qualquer caminho de aprovação (AprovAí, link por token);
--   • SECURITY DEFINER: o gestor que aprova não precisa de INSERT em
--     fin_contas_pagar — pela RLS a escrita falharia em silêncio.
--
-- Favorecido NÃO vira fornecedor: a CP guarda o nome e a chave PIX; o
-- fornecedor_id fica nulo (decisão do Elton, 02/ago).
-- ATENÇÃO: fin_contas_pagar guarda centro_custo/classe_financeira como TEXTO
-- (não existem as colunas *_id nessa tabela).
-- ─────────────────────────────────────────────────────────────────────────────

-- Origem própria p/ CP nascida de adiantamento
ALTER TABLE public.fin_contas_pagar DROP CONSTRAINT IF EXISTS fin_contas_pagar_origem_check;
ALTER TABLE public.fin_contas_pagar ADD CONSTRAINT fin_contas_pagar_origem_check
  CHECK (origem::text = ANY (ARRAY['compras','logistica','manual','omie','cartao_fatura','locacao','medicao_contrato','rh_beneficios','despesas']::text[]));

CREATE OR REPLACE FUNCTION public.fn_adiantamento_gera_cp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cp_id  uuid;
  v_valor  numeric;
  v_venc   date;
BEGIN
  IF NEW.status <> 'aprovado' OR OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF NEW.fin_conta_pagar_id IS NOT NULL THEN
    RETURN NEW;  -- já gerada
  END IF;

  v_valor := COALESCE(NULLIF(NEW.valor_aprovado, 0), NEW.valor_solicitado);
  v_venc  := COALESCE(NEW.data_pagamento, CURRENT_DATE);

  INSERT INTO fin_contas_pagar (
    fornecedor_nome, fornecedor_id,
    descricao, numero_documento,
    valor_original, data_emissao, data_vencimento, data_vencimento_orig,
    status, origem, natureza,
    centro_custo, classe_financeira,
    forma_pagamento, observacoes
  ) VALUES (
    NEW.favorecido_nome, NULL,
    'Adiantamento ' || NEW.numero || ' — ' || NEW.finalidade,
    NEW.numero,
    v_valor, CURRENT_DATE, v_venc, v_venc,
    'confirmado', 'despesas', 'adiantamento',
    NEW.centro_custo, NEW.classe_financeira,
    CASE WHEN COALESCE(TRIM(NEW.chave_pix), '') <> '' THEN 'pix' END,
    concat_ws(' | ',
      'Adiantamento a ' || NEW.favorecido_nome,
      CASE WHEN COALESCE(TRIM(NEW.chave_pix), '') <> '' THEN 'PIX: ' || TRIM(NEW.chave_pix) END,
      'Solicitado por: ' || NEW.solicitante_nome,
      CASE WHEN NEW.aprovado_por IS NOT NULL THEN 'Aprovado por: ' || NEW.aprovado_por END,
      CASE WHEN NEW.data_limite_prestacao IS NOT NULL
           THEN 'Prestação de contas até ' || to_char(NEW.data_limite_prestacao, 'DD/MM/YYYY') END
    )
  ) RETURNING id INTO v_cp_id;

  -- UPDATE de coluna fora do OF status → não redispara este trigger
  UPDATE desp_adiantamentos
     SET fin_conta_pagar_id = v_cp_id, updated_at = now()
   WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_adiantamento_gera_cp ON public.desp_adiantamentos;
CREATE TRIGGER tr_adiantamento_gera_cp
  AFTER UPDATE OF status ON public.desp_adiantamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_adiantamento_gera_cp();
