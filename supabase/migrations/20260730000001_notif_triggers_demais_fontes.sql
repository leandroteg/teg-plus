-- ─────────────────────────────────────────────────────────────────────────────
-- 20260730000001_notif_triggers_demais_fontes.sql
--
-- Fase 2 das notificacoes de etapa: cobre as demais fontes do inventario de
-- "etapas onde o usuario precisa atuar" (frontend/src/hooks/useMinhasTarefas.ts)
-- + con_solicitacoes (fluxo de contratos, etapa_atual/responsavel_id).
--
-- Um trigger generico parametrizado (fn_notif_etapa_generica) atende as
-- tabelas cujo padrao e "coluna de responsavel + conjunto de status
-- acionaveis". Dispara quando o registro entra num status acionavel, muda de
-- status dentro do conjunto, ou troca de responsavel. Dedupe por
-- (user_id, origem:id:status) — a mesma etapa nunca re-notifica.
--
-- Casos especiais com funcao propria:
--   - sgi_acoes: responsavel_id referencia sys_perfis.id (nao auth_id) e o
--     conjunto acionavel e "status NOT IN (concluida, cancelada)"; notifica
--     apenas na atribuicao (nao a cada mudanca de status).
--   - con_solicitacoes: etapa em etapa_atual (text livre), avancada pela RPC
--     con_avancar_etapa (UPDATE comum → trigger dispara). responsavel_id vem
--     do payload da RPC con_criar_solicitacao_unificado e pode ser auth_id ou
--     sys_perfis.id → fn_notif_resolver_user aceita ambos.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Trigger generico: TG_ARGV = (origem, col_responsavel, status_csv, titulo, url) ──
-- {id} na url e substituido pelo id do registro. Corpo tenta numero/titulo/descricao.
CREATE OR REPLACE FUNCTION public.fn_notif_etapa_generica()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_origem   text := TG_ARGV[0];
  v_col_resp text := TG_ARGV[1];
  v_statuses text[] := string_to_array(TG_ARGV[2], ',');
  v_titulo   text := TG_ARGV[3];
  v_url      text := TG_ARGV[4];
  v_new      jsonb := to_jsonb(NEW);
  v_old      jsonb;
  v_status   text;
  v_resp     uuid;
  v_uid      uuid;
BEGIN
  v_status := v_new->>'status';
  v_resp   := nullif(v_new->>v_col_resp, '')::uuid;

  IF v_resp IS NULL OR v_status IS NULL OR NOT (v_status = ANY(v_statuses)) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    IF (v_old->>'status') IS NOT DISTINCT FROM v_status
       AND (v_old->>v_col_resp) IS NOT DISTINCT FROM (v_new->>v_col_resp) THEN
      RETURN NEW;
    END IF;
  END IF;

  v_uid := fn_notif_resolver_user(v_resp);
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM fn_notif_enfileirar(
    v_uid,
    v_titulo,
    coalesce(v_new->>'numero', v_new->>'titulo', v_new->>'descricao'),
    replace(v_url, '{id}', v_new->>'id'),
    v_origem,
    (v_new->>'id')::uuid,
    format('%s:%s:%s', v_origem, v_new->>'id', v_status)
  );

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.fn_notif_etapa_generica() IS
  'Trigger parametrizado de notificacao de etapa: TG_ARGV = (origem, coluna_responsavel, status_acionaveis_csv, titulo, url com {id}).';

-- ── Compras ──────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_notif_etapa ON public.cmp_cotacoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, comprador_id ON public.cmp_cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'cmp_cotacao', 'comprador_id', 'pendente,em_andamento',
    'Cotacao aguardando sua acao', '/cotacoes/{id}');

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.cmp_requisicoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, solicitante_id ON public.cmp_requisicoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'cmp_requisicao_escl', 'solicitante_id', 'em_esclarecimento,cotacao_em_esclarecimento',
    'Sua requisicao precisa de esclarecimento', '/compras/requisicoes');

-- ── Locacao ──────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_notif_etapa ON public.loc_vistorias;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, responsavel_id ON public.loc_vistorias
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'loc_vistoria', 'responsavel_id', 'pendente,em_andamento',
    'Vistoria atribuida a voce', '/locacao');

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.loc_entradas;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, responsavel_id ON public.loc_entradas
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'loc_entrada', 'responsavel_id', 'pendente,aguardando_vistoria,aguardando_assinatura',
    'Entrada de imovel aguardando sua acao', '/locacao/entradas');

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.loc_saidas;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, responsavel_id ON public.loc_saidas
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'loc_saida', 'responsavel_id', 'pendente,aguardando_vistoria,solucionando_pendencias,encerramento_contratual',
    'Saida de imovel aguardando sua acao', '/locacao/saidas');

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.loc_solicitacoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, responsavel_id ON public.loc_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'loc_solicitacao', 'responsavel_id', 'aberta,em_andamento',
    'Solicitacao de locacao atribuida a voce', '/locacao');

-- ── Estoque / Despesas ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_notif_etapa ON public.est_cautelas;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, aprovador_id ON public.est_cautelas
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'est_cautela', 'aprovador_id', 'pendente,aguardando_aprovacao',
    'Cautela aguardando sua aprovacao', '/estoque/cautelas');

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.desp_adiantamentos;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF status, gestor_id ON public.desp_adiantamentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_etapa_generica(
    'desp_adiantamento', 'gestor_id', 'aguardando_aprovacao,pendente',
    'Adiantamento aguardando sua aprovacao', '/despesas/adiantamentos');

-- ── SGI: notifica na atribuicao da acao (responsavel_id = sys_perfis.id) ─────
CREATE OR REPLACE FUNCTION public.fn_notif_sgi_acao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_url text;
BEGIN
  IF NEW.responsavel_id IS NULL OR NEW.status IN ('concluida', 'cancelada') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.responsavel_id IS NOT DISTINCT FROM NEW.responsavel_id THEN
    RETURN NEW;
  END IF;

  v_uid := fn_notif_resolver_user(NEW.responsavel_id);
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  v_url := CASE NEW.origem_tipo
    WHEN 'meta'     THEN '/sgi/objetivos'
    WHEN 'registro' THEN '/sgi/melhoria'
    ELSE '/sgi'
  END;

  PERFORM fn_notif_enfileirar(
    v_uid,
    'Acao do SGI atribuida a voce',
    NEW.titulo,
    v_url,
    'sgi_acao',
    NEW.id,
    format('sgi_acao:%s', NEW.id)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.sgi_acoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF responsavel_id ON public.sgi_acoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_sgi_acao();

-- ── Contratos: etapa_atual + responsavel_id ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_notif_con_solicitacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
BEGIN
  IF NEW.responsavel_id IS NULL OR NEW.status <> 'em_andamento' OR NEW.etapa_atual IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.etapa_atual IS NOT DISTINCT FROM NEW.etapa_atual
     AND OLD.responsavel_id IS NOT DISTINCT FROM NEW.responsavel_id THEN
    RETURN NEW;
  END IF;

  v_uid := fn_notif_resolver_user(NEW.responsavel_id);
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM fn_notif_enfileirar(
    v_uid,
    format('Solicitacao de contrato na etapa "%s"', replace(NEW.etapa_atual, '_', ' ')),
    NEW.objeto,
    format('/contratos/solicitacoes/%s', NEW.id),
    'con_solicitacao',
    NEW.id,
    format('con_solicitacao:%s:%s', NEW.id, NEW.etapa_atual)
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_notif_etapa ON public.con_solicitacoes;
CREATE TRIGGER tr_notif_etapa
  AFTER INSERT OR UPDATE OF etapa_atual, responsavel_id ON public.con_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_notif_con_solicitacao();
