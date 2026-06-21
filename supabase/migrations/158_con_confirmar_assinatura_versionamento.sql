-- 158_con_confirmar_assinatura_versionamento.sql
-- Versionamento do PDF assinado: quando a confirmacao de assinatura recebe
-- um novo arquivo E ja existe um documento_assinado_url anterior, gera
-- uma NOVA linha em con_assinaturas em vez de sobrescrever a anterior.
-- Mantem auditoria de qual PDF assinado vigorou em cada momento.

CREATE OR REPLACE FUNCTION public.con_confirmar_assinatura(
  p_solicitacao_id uuid,
  p_documento_assinado_url text DEFAULT NULL,
  p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id            uuid;
  v_url_anterior  text;
  v_now           timestamptz := now();
BEGIN
  -- Pega a assinatura mais recente da solicitacao
  SELECT id, documento_assinado_url
    INTO v_id, v_url_anterior
  FROM con_assinaturas
  WHERE solicitacao_id = p_solicitacao_id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1;

  IF v_id IS NULL THEN
    -- Primeira confirmacao
    INSERT INTO con_assinaturas (
      solicitacao_id, provedor, tipo_assinatura, status, concluido_em,
      documento_assinado_url, signatarios
    ) VALUES (
      p_solicitacao_id, 'manual', 'eletronica', 'assinado', v_now,
      p_documento_assinado_url, '[]'::jsonb
    )
    RETURNING id INTO v_id;

  ELSIF p_documento_assinado_url IS NOT NULL AND v_url_anterior IS NOT NULL THEN
    -- Ja existia um documento assinado anterior: INSERE nova linha para
    -- preservar historico do PDF anterior em vez de sobrescrever.
    INSERT INTO con_assinaturas (
      solicitacao_id, provedor, tipo_assinatura, status, concluido_em,
      documento_assinado_url, signatarios
    ) VALUES (
      p_solicitacao_id, 'manual', 'eletronica', 'assinado', v_now,
      p_documento_assinado_url, '[]'::jsonb
    )
    RETURNING id INTO v_id;

  ELSE
    -- Atualiza a existente (caso comum: confirma sem upload novo ou primeiro upload)
    UPDATE con_assinaturas
       SET status = 'assinado',
           concluido_em = coalesce(concluido_em, v_now),
           documento_assinado_url = coalesce(p_documento_assinado_url, documento_assinado_url),
           updated_at = v_now
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;
