-- 194_fin_cancelamento_com_aprovacao.sql
-- Cancelamento de documentos financeiros com fluxo solicita -> aprova (Fase 1: CP e CR).
--
-- Regra de negócio (2026-07-24):
--   • Documento financeiro NÃO tem mais "exclusão dura". Só cancelamento.
--   • Usuário comum SOLICITA o cancelamento (com justificativa).
--   • Um APROVADOR (flag sys_perfis.aprova_cancelamento_fin) aprova ou recusa.
--   • Aprovar  -> documento vira status 'cancelado'.
--   • Recusar  -> documento volta ao normal (limpa a pendência), guarda o motivo.
--
-- Fase 1 cobre apenas documento NÃO liquidado:
--   • CP: bloqueado se status in ('pago','conciliado')  -> exigiria estorno (Fase 2).
--   • CR: bloqueado se status in ('recebido','conciliado') -> idem.
--
-- Segurança: escritas via RPC SECURITY DEFINER (tabelas CP/CR/perfis têm RLS e
-- escrita direta do cliente falha em silêncio). Aprovador validado no servidor,
-- não só no front. Idempotente (IF NOT EXISTS / CREATE OR REPLACE).

-- ── 1. Flag do aprovador em sys_perfis ───────────────────────────────────────
ALTER TABLE public.sys_perfis
  ADD COLUMN IF NOT EXISTS aprova_cancelamento_fin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sys_perfis.aprova_cancelamento_fin IS
  'Pode aprovar/recusar solicitações de cancelamento de documentos financeiros (CP/CR).';

-- ── 2. Marcador de pendência nos documentos ──────────────────────────────────
-- Trava o documento de "seguir a vida" enquanto há cancelamento pendente e
-- permite badge na UI. A recusa apenas volta pra false (não precisa lembrar
-- status anterior, pois o status do documento nunca é alterado na solicitação).
ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS cancelamento_pendente boolean NOT NULL DEFAULT false;
ALTER TABLE public.fin_contas_receber
  ADD COLUMN IF NOT EXISTS cancelamento_pendente boolean NOT NULL DEFAULT false;

-- ── 3. Tabela de solicitações de cancelamento ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fin_cancelamentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_doc            text NOT NULL CHECK (tipo_doc IN ('cp','cr')),
  doc_id              uuid NOT NULL,
  -- snapshot para contexto do aprovador (documento pode mudar depois)
  doc_descricao       text,
  doc_valor           numeric,
  doc_status_origem   text,           -- status do documento no momento da solicitação
  solicitante_id      uuid REFERENCES public.sys_perfis(id),
  solicitante_nome    text,
  justificativa       text NOT NULL,
  status              text NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente','aprovado','recusado')),
  decidido_por_id     uuid REFERENCES public.sys_perfis(id),
  decidido_por_nome   text,
  decidido_em         timestamptz,
  motivo_recusa       text,
  criado_em           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fin_cancelamentos IS
  'Solicitações de cancelamento de documentos financeiros (CP/CR). Fluxo solicita->aprova. Escrita só via RPC.';

CREATE INDEX IF NOT EXISTS idx_fin_cancelamentos_doc
  ON public.fin_cancelamentos(tipo_doc, doc_id);
CREATE INDEX IF NOT EXISTS idx_fin_cancelamentos_status
  ON public.fin_cancelamentos(status);

-- No máximo UMA solicitação pendente por documento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_cancelamento_pendente
  ON public.fin_cancelamentos(tipo_doc, doc_id)
  WHERE status = 'pendente';

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
-- Leitura liberada a autenticados (a tela já é gated por módulo). Sem policies de
-- INSERT/UPDATE/DELETE de propósito: escrita só pelos RPCs SECURITY DEFINER.
ALTER TABLE public.fin_cancelamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sel_fin_cancelamentos ON public.fin_cancelamentos;
CREATE POLICY sel_fin_cancelamentos ON public.fin_cancelamentos
  FOR SELECT TO authenticated USING (true);

-- ── 5. RPC: solicitar cancelamento (usuário comum) ───────────────────────────
CREATE OR REPLACE FUNCTION public.fin_solicitar_cancelamento(
  p_tipo          text,
  p_doc_id        uuid,
  p_justificativa text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil_id   uuid;
  v_perfil_nome text;
  v_status      text;
  v_desc        text;
  v_valor       numeric;
  v_id          uuid;
BEGIN
  IF p_tipo NOT IN ('cp','cr') THEN
    RAISE EXCEPTION 'Tipo de documento inválido (use cp ou cr).';
  END IF;
  IF coalesce(btrim(p_justificativa),'') = '' THEN
    RAISE EXCEPTION 'Justificativa é obrigatória.';
  END IF;

  SELECT id, nome INTO v_perfil_id, v_perfil_nome
    FROM public.sys_perfis WHERE auth_id = auth.uid();
  IF v_perfil_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do solicitante não encontrado.';
  END IF;

  IF p_tipo = 'cp' THEN
    SELECT status, descricao, valor_original
      INTO v_status, v_desc, v_valor
      FROM public.fin_contas_pagar WHERE id = p_doc_id;
    IF v_status IS NULL THEN RAISE EXCEPTION 'Conta a pagar não encontrada.'; END IF;
    IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Documento já está cancelado.'; END IF;
    IF v_status IN ('pago','conciliado') THEN
      RAISE EXCEPTION 'Documento já liquidado — cancelamento exige estorno (indisponível nesta fase).';
    END IF;
  ELSE
    SELECT status, descricao, valor_original
      INTO v_status, v_desc, v_valor
      FROM public.fin_contas_receber WHERE id = p_doc_id;
    IF v_status IS NULL THEN RAISE EXCEPTION 'Conta a receber não encontrada.'; END IF;
    IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Documento já está cancelado.'; END IF;
    IF v_status IN ('recebido','conciliado') THEN
      RAISE EXCEPTION 'Documento já liquidado — cancelamento exige estorno (indisponível nesta fase).';
    END IF;
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
END;
$$;

-- ── 6. RPC: decidir cancelamento (aprovador) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_decidir_cancelamento(
  p_cancelamento_id uuid,
  p_aprovar         boolean,
  p_motivo          text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil_id   uuid;
  v_perfil_nome text;
  v_pode        boolean;
  v_canc        public.fin_cancelamentos%ROWTYPE;
BEGIN
  SELECT id, nome, coalesce(aprova_cancelamento_fin,false)
    INTO v_perfil_id, v_perfil_nome, v_pode
    FROM public.sys_perfis WHERE auth_id = auth.uid();
  IF v_perfil_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do aprovador não encontrado.';
  END IF;
  IF NOT v_pode THEN
    RAISE EXCEPTION 'Sem permissão para aprovar cancelamento financeiro.';
  END IF;

  SELECT * INTO v_canc FROM public.fin_cancelamentos
    WHERE id = p_cancelamento_id FOR UPDATE;
  IF v_canc.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação de cancelamento não encontrada.';
  END IF;
  IF v_canc.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação já foi decidida (%).', v_canc.status;
  END IF;

  IF p_aprovar THEN
    IF v_canc.tipo_doc = 'cp' THEN
      UPDATE public.fin_contas_pagar
        SET status = 'cancelado', cancelamento_pendente = false
        WHERE id = v_canc.doc_id;
    ELSE
      UPDATE public.fin_contas_receber
        SET status = 'cancelado', cancelamento_pendente = false
        WHERE id = v_canc.doc_id;
    END IF;
    UPDATE public.fin_cancelamentos
      SET status = 'aprovado', decidido_por_id = v_perfil_id,
          decidido_por_nome = v_perfil_nome, decidido_em = now()
      WHERE id = p_cancelamento_id;
  ELSE
    IF coalesce(btrim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo da recusa é obrigatório.';
    END IF;
    IF v_canc.tipo_doc = 'cp' THEN
      UPDATE public.fin_contas_pagar   SET cancelamento_pendente = false WHERE id = v_canc.doc_id;
    ELSE
      UPDATE public.fin_contas_receber SET cancelamento_pendente = false WHERE id = v_canc.doc_id;
    END IF;
    UPDATE public.fin_cancelamentos
      SET status = 'recusado', decidido_por_id = v_perfil_id,
          decidido_por_nome = v_perfil_nome, decidido_em = now(),
          motivo_recusa = btrim(p_motivo)
      WHERE id = p_cancelamento_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_solicitar_cancelamento(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fin_decidir_cancelamento(uuid, boolean, text)  TO authenticated;

-- ── 7. Aprovadores iniciais (Fase 1): Naira e Jackeline ──────────────────────
UPDATE public.sys_perfis
  SET aprova_cancelamento_fin = true
  WHERE lower(email) IN ('naira.machado@teguniao.com.br', 'jackeline.freire@teguniao.com.br');
