-- ─────────────────────────────────────────────────────────────────────────────
-- 20260731000003_notif_compras_etapas_e_novos_modulos.sql
--
-- Cobertura etapa-a-etapa do modulo Compras + novos modulos no mesmo padrao.
--
-- COMPRAS — cada status de cmp_requisicoes notifica o ator daquela etapa
-- (fluxo mapeado em hooks/useRequisicoes.ts, useCotacoes.ts, useAprovacoes.ts):
--   aguardando_catalogo        → comprador (vincular itens ao catalogo)
--   em_triagem_cd              → triadores (perfis das bases est_bases.faz_triagem)
--   em_aprovacao               → (ja coberto: apr_aprovacoes / validacao tecnica)
--   aprovada                   → comprador (enviar para cotacao)
--   em_cotacao                 → (ja coberto: trigger de cmp_cotacoes)
--   cotacao_enviada            → (ja coberto: apr_aprovacoes tipo cotacao)
--   cotacao_aprovada           → comprador (emitir pedido)
--   cotacao_em_esclarecimento  → comprador (aprovador financeiro devolveu a cotacao
--                                — ver useAprovacoes.ts:1270; antes notificava o
--                                solicitante por engano)
--   em_esclarecimento          → solicitante
--   devolvida_solicitante      → solicitante (ajustar e reenviar)
--   rejeitada                  → solicitante (ciencia/refazer)
-- Sem comprador_id na RC → notifica o POOL de compradores (sys_perfis.comprador).
--
-- NOVOS MODULOS (etapa → ator identificavel):
--   rh_admissoes (etapa exames_treinamentos/integracao)   → aprovador_id
--   sgi_documento_aprovacoes (atribuicao)                 → responsavel_id
--   est_solicitacoes (atendida/parcial/encaminhada_compras) → solicitante_id
--   log_solicitacoes (entregue → confirmar; recusado)     → solicitante_id
--   fro_ordens_servico (concluida)                        → solicitante_id
--
-- Substitui o trigger generico anterior de cmp_requisicoes (que so cobria
-- esclarecimentos) e atualiza fn_notif_sweep para espelhar as novas regras.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drift: sys_perfis.comprador existe em prod mas nao em homolog — garante a coluna.
ALTER TABLE public.sys_perfis ADD COLUMN IF NOT EXISTS comprador boolean NOT NULL DEFAULT false;

-- ── Avaliador compartilhado de RC (usado pelo trigger e pelo sweep) ──────────
CREATE OR REPLACE FUNCTION public.fn_notif_cmp_rc_avaliar(r public.cmp_requisicoes)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_alvo   text;  -- 'comprador' | 'solicitante' | 'triagem'
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

  ELSE -- triagem CD
    PERFORM fn_notif_enfileirar(p.auth_id, v_titulo, v_corpo, v_url, 'cmp_requisicao', r.id, v_key)
    FROM sys_perfis p
    JOIN est_bases b ON b.id = p.base_id
    WHERE p.ativo = true AND b.faz_triagem = true AND p.auth_id IS NOT NULL;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_notif_cmp_rc_avaliar(public.cmp_requisicoes) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_notif_cmp_rc_avaliar(public.cmp_requisicoes) TO service_role;

-- ── Trigger da RC (substitui o generico que so cobria esclarecimentos) ──────
CREATE OR REPLACE FUNCTION public.fn_notif_cmp_requisicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.comprador_id IS NOT DISTINCT FROM NEW.comprador_id THEN
    RETURN NEW;
  END IF;
  PERFORM fn_notif_cmp_rc_avaliar(NEW);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.cmp_requisicoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, comprador_id ON public.cmp_requisicoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_cmp_requisicao();

-- ── RH: admissao aguardando o aprovador da etapa ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notif_rh_admissao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  IF NEW.aprovador_id IS NULL OR NEW.etapa NOT IN ('exames_treinamentos', 'integracao') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.etapa IS NOT DISTINCT FROM NEW.etapa
     AND OLD.aprovador_id IS NOT DISTINCT FROM NEW.aprovador_id THEN
    RETURN NEW;
  END IF;
  v_uid := fn_notif_resolver_user(NEW.aprovador_id);
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  PERFORM fn_notif_enfileirar(v_uid,
    format('Admissao na etapa "%s" aguardando sua acao', replace(NEW.etapa, '_', ' ')),
    NULL, '/rh', 'rh_admissao', NEW.id,
    format('rh_admissao:%s:%s', NEW.id, NEW.etapa));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.rh_admissoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF etapa, aprovador_id ON public.rh_admissoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_rh_admissao();

-- ── SGI: aprovacao de documento atribuida ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notif_sgi_doc_aprovacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  IF NEW.responsavel_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.responsavel_id IS NOT DISTINCT FROM NEW.responsavel_id
     AND OLD.etapa IS NOT DISTINCT FROM NEW.etapa THEN
    RETURN NEW;
  END IF;
  v_uid := fn_notif_resolver_user(NEW.responsavel_id);
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  PERFORM fn_notif_enfileirar(v_uid,
    'Documento do SGI aguardando sua aprovacao',
    NULL, '/sgi', 'sgi_doc_aprovacao', NEW.id,
    format('sgi_doc_aprovacao:%s:%s', NEW.id, coalesce(NEW.etapa, '-')));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.sgi_documento_aprovacoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF responsavel_id, etapa ON public.sgi_documento_aprovacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_sgi_doc_aprovacao();

-- ── Estoque / Logistica / Frotas: retorno ao solicitante ─────────────────────
DROP TRIGGER IF EXISTS tr_notif_etapa ON public.est_solicitacoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status ON public.est_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'est_solicitacao', 'solicitante_id', 'atendida,parcial,encaminhada_compras',
    'Sua solicitacao de material foi movimentada', '/estoque');

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.log_solicitacoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status ON public.log_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'log_solicitacao', 'solicitante_id', 'entregue,recusado',
    'Sua solicitacao de transporte foi movimentada', '/logistica/solicitacoes');

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.fro_ordens_servico;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status ON public.fro_ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'fro_os', 'solicitante_id', 'concluida',
    'OS de frota concluida', '/frotas/manutencao');

-- ── Sweep v3: espelha as novas regras ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notif_sweep(p_janela interval DEFAULT interval '7 days')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_corte timestamptz := now() - p_janela;
BEGIN
  -- 1. Aprovacoes pendentes (aprovador identificado por email)
  PERFORM fn_notif_enfileirar(
    p.auth_id,
    CASE a.tipo_aprovacao
      WHEN 'requisicao_compra'     THEN 'Requisicao de compra aguardando sua aprovacao'
      WHEN 'cotacao'               THEN 'Cotacao aguardando sua aprovacao'
      WHEN 'minuta_contratual'     THEN 'Minuta contratual aguardando sua aprovacao'
      WHEN 'autorizacao_pagamento' THEN 'Autorizacao de pagamento aguardando sua aprovacao'
      WHEN 'aprovacao_transporte'  THEN 'Solicitacao de transporte aguardando sua aprovacao'
      ELSE 'Aprovacao aguardando sua acao'
    END,
    CASE WHEN a.entidade_numero IS NOT NULL THEN 'Nº ' || a.entidade_numero END,
    '/aprovaai', 'apr_aprovacao', a.id,
    format('apr_aprovacao:%s:%s', a.id, a.status))
  FROM apr_aprovacoes a
  JOIN sys_perfis p
    ON p.ativo = true AND p.auth_id IS NOT NULL
   AND lower(trim(p.email)) = lower(trim(a.aprovador_email))
  WHERE a.status::text = 'pendente' AND a.created_at > v_corte;

  -- 2. Cotacoes atribuidas ao comprador
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(c.comprador_id),
    'Cotacao aguardando sua acao', NULL,
    format('/cotacoes/%s', c.id), 'cmp_cotacao', c.id,
    format('cmp_cotacao:%s:%s', c.id, c.status))
  FROM cmp_cotacoes c
  WHERE c.comprador_id IS NOT NULL
    AND c.status::text IN ('pendente', 'em_andamento')
    AND c.created_at > v_corte;

  -- 3. RCs em etapa acionavel (mesmas regras do trigger, via avaliador compartilhado)
  PERFORM fn_notif_cmp_rc_avaliar(r)
  FROM cmp_requisicoes r
  WHERE r.status::text IN ('aguardando_catalogo', 'em_triagem_cd', 'aprovada',
                           'cotacao_aprovada', 'cotacao_em_esclarecimento',
                           'em_esclarecimento', 'devolvida_solicitante')
    AND r.updated_at > v_corte;

  -- 4. Vistorias de locacao
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(v.responsavel_id),
    'Vistoria atribuida a voce', NULL,
    '/locacao', 'loc_vistoria', v.id,
    format('loc_vistoria:%s:%s', v.id, v.status))
  FROM loc_vistorias v
  WHERE v.responsavel_id IS NOT NULL
    AND v.status IN ('pendente', 'em_andamento')
    AND v.created_at > v_corte;

  -- 5. Entradas de imoveis
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(e.responsavel_id),
    'Entrada de imovel aguardando sua acao', e.numero,
    '/locacao/entradas', 'loc_entrada', e.id,
    format('loc_entrada:%s:%s', e.id, e.status))
  FROM loc_entradas e
  WHERE e.responsavel_id IS NOT NULL
    AND e.status IN ('pendente', 'aguardando_vistoria', 'aguardando_assinatura')
    AND e.created_at > v_corte;

  -- 6. Saidas de imoveis
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(s.responsavel_id),
    'Saida de imovel aguardando sua acao', NULL,
    '/locacao/saidas', 'loc_saida', s.id,
    format('loc_saida:%s:%s', s.id, s.status))
  FROM loc_saidas s
  WHERE s.responsavel_id IS NOT NULL
    AND s.status IN ('pendente', 'aguardando_vistoria', 'solucionando_pendencias', 'encerramento_contratual')
    AND s.created_at > v_corte;

  -- 7. Solicitacoes de locacao
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(ls.responsavel_id),
    'Solicitacao de locacao atribuida a voce', ls.titulo,
    '/locacao', 'loc_solicitacao', ls.id,
    format('loc_solicitacao:%s:%s', ls.id, ls.status))
  FROM loc_solicitacoes ls
  WHERE ls.responsavel_id IS NOT NULL
    AND ls.status IN ('aberta', 'em_andamento')
    AND ls.created_at > v_corte;

  -- 8. Cautelas aguardando o aprovador
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(ca.aprovador_id),
    'Cautela aguardando sua aprovacao', ca.numero,
    '/estoque/cautelas', 'est_cautela', ca.id,
    format('est_cautela:%s:%s', ca.id, ca.status))
  FROM est_cautelas ca
  WHERE ca.aprovador_id IS NOT NULL
    AND ca.status IN ('pendente', 'aguardando_aprovacao')
    AND ca.criado_em > v_corte;  -- est_cautelas usa criado_em, nao created_at

  -- 9. Adiantamentos aguardando o gestor
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(ad.gestor_id),
    'Adiantamento aguardando sua aprovacao', ad.numero,
    '/despesas/adiantamentos', 'desp_adiantamento', ad.id,
    format('desp_adiantamento:%s:%s', ad.id, ad.status))
  FROM desp_adiantamentos ad
  WHERE ad.gestor_id IS NOT NULL
    AND ad.status IN ('aguardando_aprovacao', 'pendente')
    AND ad.created_at > v_corte;

  -- 10. Acoes do SGI (responsavel_id = sys_perfis.id; dedupe por acao, sem status)
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(sa.responsavel_id),
    'Acao do SGI atribuida a voce', sa.titulo,
    CASE sa.origem_tipo WHEN 'meta' THEN '/sgi/objetivos' WHEN 'registro' THEN '/sgi/melhoria' ELSE '/sgi' END,
    'sgi_acao', sa.id,
    format('sgi_acao:%s', sa.id))
  FROM sgi_acoes sa
  WHERE sa.responsavel_id IS NOT NULL
    AND sa.status NOT IN ('concluida', 'cancelada')
    AND sa.created_at > v_corte;

  -- 11. Solicitacoes de contrato em andamento com responsavel
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(cs.responsavel_id),
    format('Solicitacao de contrato na etapa "%s"', replace(cs.etapa_atual, '_', ' ')),
    cs.objeto,
    format('/contratos/solicitacoes/%s', cs.id), 'con_solicitacao', cs.id,
    format('con_solicitacao:%s:%s', cs.id, cs.etapa_atual))
  FROM con_solicitacoes cs
  WHERE cs.responsavel_id IS NOT NULL
    AND cs.status = 'em_andamento'
    AND cs.etapa_atual IS NOT NULL
    AND cs.updated_at > v_corte;

  -- 12. Admissoes de RH aguardando o aprovador da etapa
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(ra.aprovador_id),
    format('Admissao na etapa "%s" aguardando sua acao', replace(ra.etapa, '_', ' ')),
    NULL, '/rh', 'rh_admissao', ra.id,
    format('rh_admissao:%s:%s', ra.id, ra.etapa))
  FROM rh_admissoes ra
  WHERE ra.aprovador_id IS NOT NULL
    AND ra.etapa IN ('exames_treinamentos', 'integracao')
    AND ra.updated_at > v_corte;

  -- 13. Solicitacoes de material movimentadas (retorno ao solicitante)
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(es.solicitante_id),
    'Sua solicitacao de material foi movimentada', NULL,
    '/estoque', 'est_solicitacao', es.id,
    format('est_solicitacao:%s:%s', es.id, es.status))
  FROM est_solicitacoes es
  WHERE es.solicitante_id IS NOT NULL
    AND es.status::text IN ('atendida', 'parcial', 'encaminhada_compras')
    AND es.atualizado_em > v_corte;  -- est_solicitacoes usa criado_em/atualizado_em

  -- 14. Transportes entregues/recusados (retorno ao solicitante)
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(lg.solicitante_id),
    'Sua solicitacao de transporte foi movimentada', NULL,
    '/logistica/solicitacoes', 'log_solicitacao', lg.id,
    format('log_solicitacao:%s:%s', lg.id, lg.status))
  FROM log_solicitacoes lg
  WHERE lg.solicitante_id IS NOT NULL
    AND lg.status::text IN ('entregue', 'recusado')
    AND lg.updated_at > v_corte;

  -- 15. OS de frota concluidas (retorno ao solicitante)
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(fo.solicitante_id),
    'OS de frota concluida', NULL,
    '/frotas/manutencao', 'fro_os', fo.id,
    format('fro_os:%s:%s', fo.id, fo.status))
  FROM fro_ordens_servico fo
  WHERE fo.solicitante_id IS NOT NULL
    AND fo.status::text = 'concluida'
    AND fo.updated_at > v_corte;
END;
$function$;
