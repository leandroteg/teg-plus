-- Banco do favorecido, ao lado da chave PIX (usado no termo de repasse e na CP).
ALTER TABLE public.desp_adiantamentos ADD COLUMN IF NOT EXISTS banco text;
COMMENT ON COLUMN public.desp_adiantamentos.banco IS 'Banco do favorecido (complementa a chave PIX no termo e na CP).';

-- CP gerada na aprovacao passa a levar o banco junto do PIX nas observacoes
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
    RETURN NEW;
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
      CASE WHEN COALESCE(TRIM(NEW.banco), '') <> '' THEN 'Banco: ' || TRIM(NEW.banco) END,
      CASE WHEN COALESCE(TRIM(NEW.chave_pix), '') <> '' THEN 'PIX: ' || TRIM(NEW.chave_pix) END,
      'Solicitado por: ' || NEW.solicitante_nome,
      CASE WHEN NEW.aprovado_por IS NOT NULL THEN 'Aprovado por: ' || NEW.aprovado_por END,
      CASE WHEN NEW.data_limite_prestacao IS NOT NULL
           THEN 'Prestação de contas até ' || to_char(NEW.data_limite_prestacao, 'DD/MM/YYYY') END
    )
  ) RETURNING id INTO v_cp_id;

  UPDATE desp_adiantamentos
     SET fin_conta_pagar_id = v_cp_id, updated_at = now()
   WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;
