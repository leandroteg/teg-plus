-- 156_con_assinaturas_e_rc_pos_contrato.sql
-- 3 correcoes no fluxo de Contratos:
--   1. RLS de con_assinaturas: substitui policy aberta (qual=true) por padrao modular
--   2. Trigger con_assinaturas_auto_avancar: so avanca quando TODOS os
--      signatarios da JSONB tiverem status='assinado' E o array nao for vazio
--   3. Novo trigger em con_solicitacoes: ao chegar em 'liberar_execucao',
--      atualiza a RC de origem (cmp_requisicoes.status='pedido_emitido')
-- Tambem faz cleanup de 3 solicitacoes inconsistentes e 2 assinaturas orfas.

-- ============================================================================
-- (1) RLS hardening em con_assinaturas
-- ============================================================================
DROP POLICY IF EXISTS con_assinaturas_all ON con_assinaturas;

CREATE POLICY con_assinaturas_select ON con_assinaturas
  FOR SELECT USING (true);

CREATE POLICY con_assinaturas_modulo_write ON con_assinaturas
  FOR ALL
  USING (can_access_modulo('contratos', auth.uid()))
  WITH CHECK (can_access_modulo('contratos', auth.uid()));

-- ============================================================================
-- (2) Trigger: so avanca quando todos signatarios assinaram
-- ============================================================================
CREATE OR REPLACE FUNCTION public.con_assinaturas_auto_avancar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_etapa text;
  v_sigs jsonb;
  v_total int;
  v_assinados int;
BEGIN
  IF NEW.status = 'assinado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'assinado')
     AND NEW.solicitacao_id IS NOT NULL THEN

    -- Normaliza signatarios: aceita JSONB array OU string JSON (duplo-encoded)
    v_sigs := CASE
      WHEN NEW.signatarios IS NULL THEN NULL
      WHEN jsonb_typeof(NEW.signatarios) = 'string' THEN
        (NEW.signatarios #>> '{}')::jsonb
      ELSE NEW.signatarios
    END;

    -- Sem signatarios cadastrados, nao avanca (era o bug — array [] passava)
    IF v_sigs IS NULL OR jsonb_typeof(v_sigs) <> 'array' THEN
      RETURN NEW;
    END IF;

    v_total := jsonb_array_length(v_sigs);
    IF v_total = 0 THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_assinados
    FROM jsonb_array_elements(v_sigs) s
    WHERE LOWER(COALESCE(s->>'status','')) IN ('assinado','signed','concluido');

    -- Ainda faltam signatarios — nao avanca
    IF v_assinados < v_total THEN
      RETURN NEW;
    END IF;

    SELECT etapa_atual::text INTO v_etapa
    FROM con_solicitacoes
    WHERE id = NEW.solicitacao_id;

    IF v_etapa = 'enviar_assinatura' THEN
      UPDATE con_solicitacoes
         SET etapa_atual = 'arquivar',
             status = 'em_andamento',
             updated_at = now()
       WHERE id = NEW.solicitacao_id;

      INSERT INTO con_solicitacao_historico (
        solicitacao_id, etapa_de, etapa_para, observacao
      ) VALUES (
        NEW.solicitacao_id, 'enviar_assinatura', 'arquivar',
        'Avanco automatico apos todas as ' || v_total || ' assinaturas concluidas'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- (3) Trigger novo: RC volta ao fluxo quando contrato chega em liberar_execucao
-- ============================================================================
CREATE OR REPLACE FUNCTION public.con_solicitacao_marca_rc_pos_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.etapa_atual = 'liberar_execucao'
     AND (TG_OP = 'INSERT' OR OLD.etapa_atual IS DISTINCT FROM NEW.etapa_atual)
     AND NEW.requisicao_origem_id IS NOT NULL THEN

    UPDATE cmp_requisicoes
       SET status = 'pedido_emitido'
     WHERE id = NEW.requisicao_origem_id
       AND status = 'aguardando_contrato';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_con_solicitacao_marca_rc ON con_solicitacoes;
CREATE TRIGGER trg_con_solicitacao_marca_rc
AFTER INSERT OR UPDATE OF etapa_atual ON con_solicitacoes
FOR EACH ROW
EXECUTE FUNCTION public.con_solicitacao_marca_rc_pos_contrato();

-- ============================================================================
-- (4) Cleanup das inconsistencias em prod
-- ============================================================================
-- SOL-CON-2026-010 (TESTE) foi avancada indevidamente pelo trigger antigo
-- com signatarios=[]. Volta para preparar_minuta.
UPDATE con_solicitacoes
   SET etapa_atual = 'preparar_minuta',
       status = 'em_andamento',
       updated_at = now()
 WHERE id = 'a37f3e1a-0f74-4462-9142-ec2c3d2d144a';

INSERT INTO con_solicitacao_historico (solicitacao_id, etapa_de, etapa_para, observacao)
VALUES (
  'a37f3e1a-0f74-4462-9142-ec2c3d2d144a',
  'liberar_execucao', 'preparar_minuta',
  'Reverte avanco indevido por trigger antigo (mig 156)'
);

-- SOL-CON-2026-008 (envelope Certisign deu erro "Token nao encontrado")
-- e SOL-CON-2026-003 (sem nenhuma assinatura registrada) voltam para preparar_minuta
UPDATE con_solicitacoes
   SET etapa_atual = 'preparar_minuta',
       status = 'em_andamento',
       updated_at = now()
 WHERE id IN (
   '4c5416bb-b3ed-4665-9d27-31761b4d24de',
   'cc80b5fe-397e-457b-b591-142fb08cd548'
 );

INSERT INTO con_solicitacao_historico (solicitacao_id, etapa_de, etapa_para, observacao)
SELECT id, 'enviar_assinatura', 'preparar_minuta',
       'Volta para preparar minuta para re-envio das assinaturas (mig 156)'
FROM con_solicitacoes
WHERE id IN (
  '4c5416bb-b3ed-4665-9d27-31761b4d24de',
  'cc80b5fe-397e-457b-b591-142fb08cd548'
);

-- Marca as 2 assinaturas orfas (erro Certisign + status=assinado com signatarios=[])
-- como canceladas. Preserva o registro para auditoria.
UPDATE con_assinaturas
   SET status = 'cancelado',
       updated_at = now()
 WHERE id IN (
   '989c6c84-8845-492f-810d-733cee7df8a8',
   'd66fed34-6336-46eb-8c3a-a045606e9f39'
 );
