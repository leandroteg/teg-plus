-- 195_fin_solicitar_cancelamento_gate_modulo.sql
-- Item 1: quem SOLICITA cancelamento de documento financeiro precisa ter acesso
-- ao módulo Financeiro (regra: "se estou no Financeiro, eu posso pedir").
--
-- Na prática o front já é gated por navegação (só quem tem o módulo chega no botão),
-- mas o RPC aceitava qualquer usuário autenticado que chamasse direto. Este patch
-- fecha no servidor via can_access_modulo('financeiro', auth.uid()) — que já libera
-- 'administrador' automaticamente. Só muda a checagem inicial; o resto é idêntico à mig 194.

CREATE OR REPLACE FUNCTION public.fin_solicitar_cancelamento(
  p_tipo text, p_doc_id uuid, p_justificativa text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_perfil_id uuid; v_perfil_nome text;
  v_status text; v_desc text; v_valor numeric; v_id uuid;
BEGIN
  IF p_tipo NOT IN ('cp','cr') THEN RAISE EXCEPTION 'Tipo de documento inválido (use cp ou cr).'; END IF;
  IF coalesce(btrim(p_justificativa),'') = '' THEN RAISE EXCEPTION 'Justificativa é obrigatória.'; END IF;

  SELECT id, nome INTO v_perfil_id, v_perfil_nome FROM public.sys_perfis WHERE auth_id = auth.uid();
  IF v_perfil_id IS NULL THEN RAISE EXCEPTION 'Perfil do solicitante não encontrado.'; END IF;

  -- Item 1: precisa ter acesso ao módulo Financeiro (admin passa direto no helper).
  IF NOT public.can_access_modulo('financeiro', auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso ao módulo Financeiro para solicitar cancelamento.';
  END IF;

  IF p_tipo = 'cp' THEN
    SELECT status, descricao, valor_original INTO v_status, v_desc, v_valor
      FROM public.fin_contas_pagar WHERE id = p_doc_id;
    IF v_status IS NULL THEN RAISE EXCEPTION 'Conta a pagar não encontrada.'; END IF;
    IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Documento já está cancelado.'; END IF;
    IF v_status IN ('pago','conciliado') THEN
      RAISE EXCEPTION 'Documento já liquidado — cancelamento exige estorno (indisponível nesta fase).'; END IF;
  ELSE
    SELECT status, descricao, valor_original INTO v_status, v_desc, v_valor
      FROM public.fin_contas_receber WHERE id = p_doc_id;
    IF v_status IS NULL THEN RAISE EXCEPTION 'Conta a receber não encontrada.'; END IF;
    IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Documento já está cancelado.'; END IF;
    IF v_status IN ('recebido','conciliado') THEN
      RAISE EXCEPTION 'Documento já liquidado — cancelamento exige estorno (indisponível nesta fase).'; END IF;
  END IF;

  BEGIN
    INSERT INTO public.fin_cancelamentos(
      tipo_doc, doc_id, doc_descricao, doc_valor, doc_status_origem,
      solicitante_id, solicitante_nome, justificativa)
    VALUES (p_tipo, p_doc_id, v_desc, v_valor, v_status,
      v_perfil_id, v_perfil_nome, btrim(p_justificativa))
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe uma solicitação de cancelamento pendente para este documento.';
  END;

  IF p_tipo = 'cp' THEN
    UPDATE public.fin_contas_pagar   SET cancelamento_pendente = true WHERE id = p_doc_id;
  ELSE
    UPDATE public.fin_contas_receber SET cancelamento_pendente = true WHERE id = p_doc_id;
  END IF;
  RETURN v_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.fin_solicitar_cancelamento(text, uuid, text) TO authenticated;
