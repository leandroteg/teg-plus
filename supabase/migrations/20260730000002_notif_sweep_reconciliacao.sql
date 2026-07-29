-- ─────────────────────────────────────────────────────────────────────────────
-- 20260730000002_notif_sweep_reconciliacao.sql
--
-- Rede de seguranca das notificacoes de etapa: varredura periodica (pg_cron,
-- a cada 15 min) que espelha as fontes de useMinhasTarefas.ts + contratos e
-- enfileira via fn_notif_enfileirar. Como o dedupe fica na fila
-- (user_id, dedupe_key — as MESMAS chaves geradas pelos triggers), rodar o
-- sweep quantas vezes for nao duplica nada.
--
-- Cobre: pendencias criadas antes dos triggers existirem (primeira execucao =
-- backfill), escritas que escapem dos triggers, e perfis corrigidos depois
-- (ex.: aprovador_email que passou a bater com sys_perfis).
--
-- p_janela limita a itens recentes (default 7 dias) para nao inundar o sino
-- com pendencias antigas — elas seguem visiveis em /minhas-tarefas.
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- 3. Requisicoes do solicitante em esclarecimento
  PERFORM fn_notif_enfileirar(
    fn_notif_resolver_user(r.solicitante_id),
    'Sua requisicao precisa de esclarecimento', r.numero,
    '/compras/requisicoes', 'cmp_requisicao_escl', r.id,
    format('cmp_requisicao_escl:%s:%s', r.id, r.status))
  FROM cmp_requisicoes r
  WHERE r.solicitante_id IS NOT NULL
    AND r.status::text IN ('em_esclarecimento', 'cotacao_em_esclarecimento')
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
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_notif_sweep(interval) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_notif_sweep(interval) TO service_role;

COMMENT ON FUNCTION public.fn_notif_sweep(interval) IS
  'Reconciliacao das notificacoes de etapa: espelha useMinhasTarefas.ts + contratos e enfileira idempotentemente (mesmas dedupe_keys dos triggers).';

-- Agenda a cada 15 min (upsert por nome de job)
SELECT cron.schedule('notif_sweep', '*/15 * * * *', $$SELECT public.fn_notif_sweep()$$);
