-- ─────────────────────────────────────────────────────────────────────────────
-- 20260802000003_sala_tecnica_fluxo.sql
--
-- Sala Tecnica (2 engenheiros + 1 analista): avalia a NECESSIDADE das RCs que
-- iriam para a triagem do CD Araxa, antes de o CD analisar o estoque.
--
-- Fluxo: RC criada (categoria passa_por_cd + destino MG)
--          → em_analise_tecnica  (Sala Tecnica: aprovar / devolver / rejeitar)
--          → em_triagem_cd       (CD: atende com estoque ou libera p/ Compras)
--          → em_aprovacao → ...
-- RC da Sede (destino Escritorio Central, fora de MG) nunca entra — a regra
-- UF=MG da triagem ja a exclui.
--
-- Membros: flag sys_perfis.sala_tecnica (marcada no AdminUsuarios).
-- Decisao: qualquer membro decide sozinho, via RPC SECURITY DEFINER.
-- ─────────────────────────────────────────────────────────────────────────────

-- Flag de membro da Sala Tecnica
ALTER TABLE public.sys_perfis ADD COLUMN IF NOT EXISTS sala_tecnica boolean NOT NULL DEFAULT false;

-- Carimbo da analise na RC
ALTER TABLE public.cmp_requisicoes ADD COLUMN IF NOT EXISTS analise_tecnica_por_nome text;
ALTER TABLE public.cmp_requisicoes ADD COLUMN IF NOT EXISTS analise_tecnica_em timestamptz;
ALTER TABLE public.cmp_requisicoes ADD COLUMN IF NOT EXISTS analise_tecnica_obs text;

-- Helper (mesmo padrao de is_triador)
CREATE OR REPLACE FUNCTION public.is_sala_tecnica()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM sys_perfis p
    WHERE p.auth_id = auth.uid()
      AND p.ativo = true
      AND p.sala_tecnica = true
  );
$function$;

-- Decisao da Sala Tecnica
CREATE OR REPLACE FUNCTION public.cmp_sala_tecnica_decidir(
  p_rc_id   uuid,
  p_decisao text,          -- 'aprovar' | 'devolver' | 'rejeitar'
  p_motivo  text DEFAULT NULL
) RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rc   cmp_requisicoes%ROWTYPE;
  v_nome text;
  v_novo status_requisicao;
  v_obs  text;
BEGIN
  IF NOT (is_sala_tecnica() OR is_admin()) THEN
    RAISE EXCEPTION 'Sem permissao: apenas membros da Sala Tecnica podem decidir';
  END IF;

  SELECT * INTO v_rc FROM cmp_requisicoes WHERE id = p_rc_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC nao encontrada'; END IF;
  IF v_rc.status <> 'em_analise_tecnica'::status_requisicao THEN
    RAISE EXCEPTION 'RC nao esta em analise tecnica (status=%)', v_rc.status;
  END IF;

  IF p_decisao = 'aprovar' THEN
    v_novo := 'em_triagem_cd';
    v_obs  := COALESCE(NULLIF(TRIM(COALESCE(p_motivo, '')), ''), 'Necessidade aprovada pela Sala Tecnica');
  ELSIF p_decisao = 'devolver' THEN
    IF COALESCE(TRIM(p_motivo), '') = '' THEN RAISE EXCEPTION 'Informe o motivo da devolucao'; END IF;
    v_novo := 'devolvida_solicitante';
    v_obs  := 'Devolvida pela Sala Tecnica: ' || TRIM(p_motivo);
  ELSIF p_decisao = 'rejeitar' THEN
    IF COALESCE(TRIM(p_motivo), '') = '' THEN RAISE EXCEPTION 'Informe o motivo da rejeicao'; END IF;
    v_novo := 'rejeitada';
    v_obs  := 'Rejeitada pela Sala Tecnica: ' || TRIM(p_motivo);
  ELSE
    RAISE EXCEPTION 'Decisao invalida: % (use aprovar, devolver ou rejeitar)', p_decisao;
  END IF;

  SELECT nome INTO v_nome FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true LIMIT 1;

  UPDATE cmp_requisicoes SET
    status                   = v_novo,
    analise_tecnica_por_nome = v_nome,
    analise_tecnica_em       = now(),
    analise_tecnica_obs      = NULLIF(TRIM(COALESCE(p_motivo, '')), '')
  WHERE id = p_rc_id;

  INSERT INTO cmp_historico_status
    (requisicao_id, status_anterior, status_novo, responsavel_nome, responsavel_tipo, observacao)
  VALUES
    (p_rc_id, 'em_analise_tecnica', v_novo::text, COALESCE(v_nome, 'Sala Tecnica'), 'sala_tecnica', v_obs);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cmp_sala_tecnica_decidir(uuid, text, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.cmp_sala_tecnica_decidir(uuid, text, text) TO authenticated, service_role;

-- ── Notificacoes: em_analise_tecnica → membros da Sala Tecnica ───────────────
CREATE OR REPLACE FUNCTION public.fn_notif_cmp_rc_avaliar(r public.cmp_requisicoes)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_alvo   text;  -- 'comprador' | 'solicitante' | 'triagem' | 'sala_tecnica'
  v_titulo text;
  v_url    text;
  v_uid    uuid;
  v_corpo  text;
  v_key    text;
BEGIN
  CASE r.status::text
    WHEN 'aguardando_catalogo' THEN
      v_alvo := 'comprador';   v_titulo := 'RC com item fora do catalogo — vincular e enviar';
      v_url := format('/requisicoes/%s', r.id);
    WHEN 'em_analise_tecnica' THEN
      v_alvo := 'sala_tecnica'; v_titulo := 'RC aguardando analise da Sala Tecnica';
      v_url := format('/requisicoes/%s', r.id);
    WHEN 'em_triagem_cd' THEN
      v_alvo := 'triagem';     v_titulo := 'RC aguardando triagem do CD';
      v_url := format('/requisicoes/%s', r.id);
    WHEN 'aprovada' THEN
      v_alvo := 'comprador';   v_titulo := 'RC aprovada — enviar para cotacao';
      v_url := format('/requisicoes/%s', r.id);
    WHEN 'cotacao_aprovada' THEN
      v_alvo := 'comprador';   v_titulo := 'Cotacao aprovada — emitir pedido';
      v_url := format('/requisicoes/%s', r.id);
    WHEN 'cotacao_em_esclarecimento' THEN
      v_alvo := 'comprador';   v_titulo := 'Cotacao devolvida para esclarecimento';
      v_url := '/cotacoes';
    WHEN 'em_esclarecimento' THEN
      v_alvo := 'solicitante'; v_titulo := 'Sua requisicao precisa de esclarecimento';
      v_url := '/compras/requisicoes';
    WHEN 'devolvida_solicitante' THEN
      v_alvo := 'solicitante'; v_titulo := 'RC devolvida — ajustar e reenviar';
      v_url := format('/requisicoes/%s/editar', r.id);
    WHEN 'rejeitada' THEN
      v_alvo := 'solicitante'; v_titulo := 'RC rejeitada';
      v_url := format('/requisicoes/%s', r.id);
    ELSE
      RETURN;
  END CASE;

  v_corpo := coalesce(r.numero, '');
  v_key   := format('cmp_requisicao:%s:%s', r.id, r.status);

  IF v_alvo = 'solicitante' THEN
    PERFORM fn_notif_enfileirar(fn_notif_resolver_user(r.solicitante_id),
      v_titulo, v_corpo, v_url, 'cmp_requisicao', r.id, v_key);

  ELSIF v_alvo = 'comprador' THEN
    -- cmp_requisicoes.comprador_id → cmp_compradores (usuario_id quase sempre
    -- nulo; o vinculo confiavel e o email). Sem match → pool de compradores.
    SELECT coalesce(
             fn_notif_resolver_user(cc.usuario_id),
             (SELECT sp.auth_id FROM sys_perfis sp
              WHERE sp.ativo = true AND sp.auth_id IS NOT NULL
                AND lower(trim(sp.email)) = lower(trim(cc.email))
              LIMIT 1))
      INTO v_uid
    FROM cmp_compradores cc
    WHERE cc.id = r.comprador_id;

    IF v_uid IS NOT NULL THEN
      PERFORM fn_notif_enfileirar(v_uid, v_titulo, v_corpo, v_url, 'cmp_requisicao', r.id, v_key);
    ELSE
      -- RC sem comprador atribuido: avisa o pool de compradores
      PERFORM fn_notif_enfileirar(p.auth_id, v_titulo, v_corpo, v_url, 'cmp_requisicao', r.id, v_key)
      FROM sys_perfis p
      WHERE p.ativo = true AND p.comprador = true AND p.auth_id IS NOT NULL;
    END IF;

  ELSIF v_alvo = 'sala_tecnica' THEN
    PERFORM fn_notif_enfileirar(p.auth_id, v_titulo, v_corpo, v_url, 'cmp_requisicao', r.id, v_key)
    FROM sys_perfis p
    WHERE p.ativo = true AND p.sala_tecnica = true AND p.auth_id IS NOT NULL;

  ELSE -- triagem CD
    PERFORM fn_notif_enfileirar(p.auth_id, v_titulo, v_corpo, v_url, 'cmp_requisicao', r.id, v_key)
    FROM sys_perfis p
    JOIN est_bases b ON b.id = p.base_id
    WHERE p.ativo = true AND b.faz_triagem = true AND p.auth_id IS NOT NULL;
  END IF;
END;
$function$;

-- Sweep de reconciliacao: inclui em_analise_tecnica na lista de etapas acionaveis
-- (patch pontual do item 3 — o restante do fn_notif_sweep segue identico ao
-- 20260731000002/3; recriado por inteiro abaixo apenas com a lista nova).
DO $$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'fn_notif_sweep';

  IF v_src IS NULL THEN RETURN; END IF;                 -- ambiente sem o sweep
  IF v_src LIKE '%em_analise_tecnica%' THEN RETURN; END IF;  -- ja aplicado

  v_src := replace(v_src,
    '''aguardando_catalogo'', ''em_triagem_cd'',',
    '''aguardando_catalogo'', ''em_analise_tecnica'', ''em_triagem_cd'',');
  EXECUTE v_src;
END $$;
