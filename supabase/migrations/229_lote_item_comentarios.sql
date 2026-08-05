-- ─────────────────────────────────────────────────────────────────────────────
-- 229 — Comentário por título do lote de pagamento
--
-- O esclarecimento existente é do LOTE inteiro: uma observação só em
-- apr_aprovacoes que devolve tudo. Num lote de 7 títulos, o aprovador que tem
-- dúvida em um deles precisava descrever qual em texto livre, ou devolver o
-- lote inteiro por causa de uma linha.
--
-- Aqui cada título ganha sua própria conversa: aprovador comenta, Financeiro
-- responde, sem travar os outros títulos.
--
-- Ancorado em cp_id (e não no id do fin_lote_itens) de propósito: na aprovação
-- parcial o item é DELETADO do lote e recriado num lote novo. Preso ao item, o
-- comentário sumiria justamente quando o título volta para ser corrigido —
-- que é quando ele mais importa.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fin_lote_item_comentarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cp_id       uuid NOT NULL REFERENCES public.fin_contas_pagar(id) ON DELETE CASCADE,
  lote_id     uuid REFERENCES public.fin_lotes_pagamento(id) ON DELETE SET NULL,
  texto       text NOT NULL,
  autor_nome  text NOT NULL,
  autor_papel text NOT NULL DEFAULT 'financeiro',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_lote_item_coment_cp   ON public.fin_lote_item_comentarios(cp_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fin_lote_item_coment_lote ON public.fin_lote_item_comentarios(lote_id);

COMMENT ON TABLE public.fin_lote_item_comentarios IS
  'Conversa por titulo do lote de pagamento: esclarecimento item a item entre aprovador e Financeiro.';

ALTER TABLE public.fin_lote_item_comentarios ENABLE ROW LEVEL SECURITY;

-- Leitura livre para autenticado (mesmo padrao de fin_lote_itens); escrita so
-- pela RPC abaixo — o aprovador nao tem o modulo financeiro e um INSERT direto
-- do cliente falharia em silencio.
DROP POLICY IF EXISTS fin_lote_item_coment_read ON public.fin_lote_item_comentarios;
CREATE POLICY fin_lote_item_coment_read ON public.fin_lote_item_comentarios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS fin_lote_item_coment_sr ON public.fin_lote_item_comentarios;
CREATE POLICY fin_lote_item_coment_sr ON public.fin_lote_item_comentarios
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.fin_lote_item_comentar(
  p_cp_id   uuid,
  p_lote_id uuid,
  p_texto   text
)
 RETURNS public.fin_lote_item_comentarios
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome  text;
  v_papel text;
  v_row   public.fin_lote_item_comentarios;
BEGIN
  IF COALESCE(TRIM(p_texto), '') = '' THEN
    RAISE EXCEPTION 'Escreva o comentario antes de enviar';
  END IF;

  SELECT nome INTO v_nome
  FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true LIMIT 1;

  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Sessao sem perfil ativo';
  END IF;

  -- Quem tem o modulo financeiro responde como Financeiro; os demais (o
  -- aprovador, tipicamente) comentam como aprovador. So muda o rotulo na tela.
  v_papel := CASE WHEN can_access_modulo('financeiro', auth.uid()) THEN 'financeiro' ELSE 'aprovador' END;

  INSERT INTO fin_lote_item_comentarios (cp_id, lote_id, texto, autor_nome, autor_papel)
  VALUES (p_cp_id, p_lote_id, TRIM(p_texto), v_nome, v_papel)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fin_lote_item_comentar(uuid, uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fin_lote_item_comentar(uuid, uuid, text) TO authenticated, service_role;
