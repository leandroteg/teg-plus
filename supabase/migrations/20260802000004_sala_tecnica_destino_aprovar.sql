-- ─────────────────────────────────────────────────────────────────────────────
-- 20260802000004_sala_tecnica_destino_aprovar.sql
--
-- Ajuste de escopo da Sala Tecnica (feedback Elton 02/ago, RC-202608-95576):
-- TODA RC de obra passa pela Sala Tecnica (nao so as de categoria passa_por_cd).
-- Logo, ao APROVAR a necessidade, o destino depende da categoria:
--   • categoria passa_por_cd + destino UF=MG → em_triagem_cd (CD analisa estoque)
--   • senao → em_aprovacao + cria apr_aprovacoes (mesma logica da criacao:
--     aprovador padrao da alcada do nivel da RC)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cmp_sala_tecnica_decidir(
  p_rc_id   uuid,
  p_decisao text,
  p_motivo  text DEFAULT NULL
) RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rc        cmp_requisicoes%ROWTYPE;
  v_nome      text;
  v_novo      status_requisicao;
  v_obs       text;
  v_passa_cd  boolean := false;
  v_base_uf   text;
  v_alcada    record;
  v_aprov_nome  text;
  v_aprov_email text;
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
    -- Destino: triagem do CD apenas p/ categoria passa_por_cd com destino MG
    IF v_rc.categoria IS NOT NULL THEN
      SELECT COALESCE(passa_por_cd, false) INTO v_passa_cd
      FROM cmp_categorias WHERE codigo = v_rc.categoria;
    END IF;
    IF v_rc.base_destino_id IS NOT NULL THEN
      SELECT uf INTO v_base_uf FROM est_bases WHERE id = v_rc.base_destino_id;
    END IF;

    v_novo := CASE WHEN v_passa_cd AND v_base_uf = 'MG'
                   THEN 'em_triagem_cd'::status_requisicao
                   ELSE 'em_aprovacao'::status_requisicao END;
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

  -- Aprovada sem triagem CD: cria a pendencia de aprovacao (mesma logica da
  -- criacao de RC / cmp_rc_triagem_liberar) para a RC nao ficar orfã no AprovAi.
  IF v_novo = 'em_aprovacao'::status_requisicao THEN
    SELECT prazo_horas, aprovador_padrao_id INTO v_alcada
      FROM apr_alcadas WHERE nivel = COALESCE(v_rc.alcada_nivel, 1) AND ativo LIMIT 1;
    IF v_alcada.aprovador_padrao_id IS NOT NULL THEN
      SELECT nome, email INTO v_aprov_nome, v_aprov_email
      FROM sys_usuarios WHERE id = v_alcada.aprovador_padrao_id;
    END IF;

    INSERT INTO apr_aprovacoes (
      modulo, tipo_aprovacao, entidade_id, entidade_numero,
      aprovador_nome, aprovador_email, nivel, status, data_limite, observacao
    ) VALUES (
      'cmp', 'requisicao_compra', v_rc.id, v_rc.numero,
      COALESCE(v_aprov_nome, v_rc.solicitante_nome),
      COALESCE(v_aprov_email, 'pendente@teguniao.com.br'),
      COALESCE(v_rc.alcada_nivel, 1), 'pendente',
      now() + (COALESCE(v_alcada.prazo_horas, 48) || ' hours')::interval,
      'Necessidade aprovada pela Sala Tecnica'
    );
  END IF;

  INSERT INTO cmp_historico_status
    (requisicao_id, status_anterior, status_novo, responsavel_nome, responsavel_tipo, observacao)
  VALUES
    (p_rc_id, 'em_analise_tecnica', v_novo::text, COALESCE(v_nome, 'Sala Tecnica'), 'sala_tecnica', v_obs);
END;
$function$;
