-- ─────────────────────────────────────────────────────────────────────────────
-- 150_con_avancar_etapa_e_minutas_hardening.sql
--
-- 1. CHECK em con_minutas.tipo e status (substitui text livre).
-- 2. RPC con_avancar_etapa SECURITY DEFINER: faz validacao + UPDATE solicitacao
--    + INSERT historico em uma transacao server-side.
--    - Bloqueia avanco de preparar_minuta sem ao menos uma minuta tipo='final'.
--    - Lado contrato/parcelas/CPs continua no cliente.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.con_minutas
   SET tipo = lower(coalesce(nullif(tipo,''),'modelo'))
 WHERE tipo IS NULL OR tipo NOT IN ('modelo','rascunho','final','assinada','cancelada');

UPDATE public.con_minutas
   SET status = lower(coalesce(nullif(status,''),'rascunho'))
 WHERE status IS NULL OR status NOT IN ('rascunho','em_revisao','aprovada','rejeitada','cancelada');

ALTER TABLE public.con_minutas
  DROP CONSTRAINT IF EXISTS con_minutas_tipo_check,
  DROP CONSTRAINT IF EXISTS con_minutas_status_check;

ALTER TABLE public.con_minutas
  ADD CONSTRAINT con_minutas_tipo_check
    CHECK (tipo IN ('modelo','rascunho','final','assinada','cancelada')),
  ADD CONSTRAINT con_minutas_status_check
    CHECK (status IN ('rascunho','em_revisao','aprovada','rejeitada','cancelada'));

CREATE OR REPLACE FUNCTION public.con_avancar_etapa(
  p_solicitacao_id uuid,
  p_etapa_de text,
  p_etapa_para text,
  p_observacao text DEFAULT NULL,
  p_dados_etapa jsonb DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existe RECORD;
  v_minuta_final_id uuid;
  v_novo_status text;
BEGIN
  SELECT id, etapa_atual::text AS etapa_atual, status::text AS status
    INTO v_existe
  FROM con_solicitacoes
  WHERE id = p_solicitacao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'solicitacao nao encontrada');
  END IF;

  IF p_etapa_de = 'preparar_minuta' AND p_etapa_para = 'resumo_executivo' THEN
    SELECT id INTO v_minuta_final_id
    FROM con_minutas
    WHERE solicitacao_id = p_solicitacao_id AND tipo = 'final'
    ORDER BY versao DESC, created_at DESC
    LIMIT 1;

    IF v_minuta_final_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false,
        'erro', 'Avanco bloqueado: e necessaria pelo menos uma minuta marcada como final.'
      );
    END IF;
  END IF;

  v_novo_status := CASE
    WHEN p_etapa_para = 'concluido' THEN 'concluido'
    WHEN p_etapa_para = 'cancelado' THEN 'cancelado'
    ELSE 'em_andamento'
  END;

  UPDATE con_solicitacoes
     SET etapa_atual = p_etapa_para,
         status = v_novo_status,
         updated_at = now()
   WHERE id = p_solicitacao_id;

  INSERT INTO con_solicitacao_historico (
    solicitacao_id, etapa_de, etapa_para, observacao, dados_etapa
  ) VALUES (
    p_solicitacao_id, p_etapa_de, p_etapa_para, p_observacao, p_dados_etapa
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_solicitacao_id,
    'etapa_atual', p_etapa_para,
    'status', v_novo_status
  );
END;
$function$;
