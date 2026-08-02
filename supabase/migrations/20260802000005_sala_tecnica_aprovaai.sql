-- ─────────────────────────────────────────────────────────────────────────────
-- 20260802000005_sala_tecnica_aprovaai.sql
--
-- Redesenho final da Sala Tecnica (Elton, 02/ago à noite): sem etapa/card
-- proprio — os membros (sys_perfis.sala_tecnica) decidem a VALIDACAO TECNICA
-- das RCs direto no AprovAi, e a ordem do fluxo inverte:
--
--   RC criada → em_aprovacao (validacao tecnica: Sala Tecnica valida a
--   NECESSIDADE no AprovAi) → aprovou:
--     • categoria passa_por_cd + destino MG → em_triagem_cd (CD valida SALDO)
--         → CD atende com estoque (atendida_cd)  OU
--         → CD nao tem estoque → libera → RC ja sai APROVADA p/ cotacao
--           (sem nova aprovacao)
--     • senao → aprovada (fila de cotacao)
--
-- O roteamento pos-validacao fica no front (useDecisaoRequisicao). Aqui:
--   1. cmp_rc_triagem_liberar: liberar do CD vira aprovacao automatica
--      ('aprovada', sem criar apr_aprovacoes — a necessidade ja foi validada)
--   2. RLS: membros da Sala Tecnica podem atualizar cmp_requisicoes (as
--      decisoes do AprovAi gravam status na RC; sem isto falha em silencio
--      p/ quem nao tem role >= comprador)
--   3. Notificacao: card de validacao tecnica pendente tambem enfileira push
--      p/ os membros da Sala Tecnica (nao so o aprovador nominal do card)
--
-- A etapa em_analise_tecnica (migs 000002/000003/000004) fica descontinuada:
-- enum/RPC/colunas permanecem no banco por compatibilidade, mas nada roteia
-- mais para ela.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Liberar da triagem = RC aprovada direto p/ cotacao
CREATE OR REPLACE FUNCTION public.cmp_rc_triagem_liberar(p_rc_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rc        cmp_requisicoes%ROWTYPE;
  v_pendentes int;
BEGIN
  SELECT * INTO v_rc FROM cmp_requisicoes WHERE id = p_rc_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RC nao encontrada'; END IF;
  IF v_rc.status <> 'em_triagem_cd'::status_requisicao THEN
    RAISE EXCEPTION 'RC nao esta em triagem (status=%)', v_rc.status;
  END IF;

  SELECT count(*) FILTER (WHERE COALESCE(qtd_atendida_cd, 0) < quantidade)
    INTO v_pendentes
  FROM cmp_requisicao_itens WHERE requisicao_id = v_rc.id;
  IF v_pendentes = 0 THEN
    RAISE EXCEPTION 'Todos os itens ja foram atendidos pelo CD; nada a comprar';
  END IF;

  -- Necessidade ja validada pela Sala Tecnica ANTES da triagem: sem estoque
  -- no CD, a RC sai aprovada direto para a fila de cotacao.
  UPDATE cmp_requisicoes
     SET status = 'aprovada'::status_requisicao,
         data_aprovacao = COALESCE(data_aprovacao, now())
   WHERE id = p_rc_id;

  INSERT INTO cmp_historico_status
    (requisicao_id, status_anterior, status_novo, responsavel_nome, responsavel_tipo, observacao)
  VALUES
    (p_rc_id, 'em_triagem_cd', 'aprovada', 'CD Araxa', 'triagem_cd',
     'CD sem estoque para atender - RC liberada ja aprovada para cotacao (necessidade validada antes da triagem)');
END;
$function$;

-- 2. RLS: decisao do AprovAi grava na RC — membros da Sala Tecnica precisam
--    de UPDATE em cmp_requisicoes (policy permissiva, soma-se as existentes)
DROP POLICY IF EXISTS cmp_req_update_sala_tecnica ON public.cmp_requisicoes;
CREATE POLICY cmp_req_update_sala_tecnica ON public.cmp_requisicoes
  FOR UPDATE USING (is_sala_tecnica()) WITH CHECK (is_sala_tecnica());

-- 3. Push: validacao tecnica pendente notifica tambem a Sala Tecnica
CREATE OR REPLACE FUNCTION public.fn_notif_apr_aprovacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    uuid;
  v_titulo text;
BEGIN
  IF NEW.status::text <> 'pendente' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.aprovador_email IS NOT DISTINCT FROM NEW.aprovador_email THEN
    RETURN NEW;
  END IF;

  IF NEW.aprovador_email IS NOT NULL THEN
    SELECT auth_id INTO v_uid
    FROM sys_perfis
    WHERE ativo = true AND auth_id IS NOT NULL
      AND lower(trim(email)) = lower(trim(NEW.aprovador_email))
    LIMIT 1;
  END IF;

  v_titulo := CASE NEW.tipo_aprovacao
    WHEN 'requisicao_compra'     THEN 'Requisicao de compra aguardando sua aprovacao'
    WHEN 'cotacao'               THEN 'Cotacao aguardando sua aprovacao'
    WHEN 'minuta_contratual'     THEN 'Minuta contratual aguardando sua aprovacao'
    WHEN 'autorizacao_pagamento' THEN 'Autorizacao de pagamento aguardando sua aprovacao'
    WHEN 'aprovacao_transporte'  THEN 'Solicitacao de transporte aguardando sua aprovacao'
    ELSE 'Aprovacao aguardando sua acao'
  END;

  IF v_uid IS NOT NULL THEN
    PERFORM fn_notif_enfileirar(
      v_uid,
      v_titulo,
      CASE WHEN NEW.entidade_numero IS NOT NULL THEN 'Nº ' || NEW.entidade_numero ELSE NULL END,
      '/aprovaai',
      'apr_aprovacao',
      NEW.id,
      format('apr_aprovacao:%s:%s', NEW.id, NEW.status)
    );
  END IF;

  -- Validacao tecnica de RC: a Sala Tecnica tambem decide no AprovAi
  IF NEW.tipo_aprovacao = 'requisicao_compra' THEN
    PERFORM fn_notif_enfileirar(
      p.auth_id,
      'RC aguardando validacao tecnica (Sala Tecnica)',
      CASE WHEN NEW.entidade_numero IS NOT NULL THEN 'Nº ' || NEW.entidade_numero ELSE NULL END,
      '/aprovaai',
      'apr_aprovacao',
      NEW.id,
      format('apr_aprovacao:%s:%s', NEW.id, NEW.status)
    )
    FROM sys_perfis p
    WHERE p.ativo = true AND p.sala_tecnica = true AND p.auth_id IS NOT NULL
      AND p.auth_id IS DISTINCT FROM v_uid;
  END IF;

  RETURN NEW;
END;
$function$;
