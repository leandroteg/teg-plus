-- 157_con_minutas_concorrencia.sql
-- Concorrencia em con_minutas:
--   (a) UNIQUE INDEX (solicitacao_id, versao) — evita versoes duplicadas
--   (b) RPC con_criar_minuta_atomic — calcula versao server-side
--   (c) RPC con_atualizar_ai_melhorias — lock otimista via ai_melhorado_em

-- (a) UNIQUE INDEX
CREATE UNIQUE INDEX IF NOT EXISTS con_minutas_solicitacao_versao_uniq
ON con_minutas (solicitacao_id, versao);

-- (b) RPC atomico para criar minuta (lock via SELECT FOR UPDATE da solicitacao)
CREATE OR REPLACE FUNCTION public.con_criar_minuta_atomic(
  p_solicitacao_id uuid,
  p_titulo         text,
  p_tipo           text,
  p_descricao      text,
  p_arquivo_url    text,
  p_arquivo_nome   text
) RETURNS con_minutas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_versao int;
  v_row    con_minutas;
BEGIN
  IF NOT can_access_modulo('contratos', auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao no modulo Contratos';
  END IF;

  -- Lock na solicitacao para serializar a contagem de versoes
  PERFORM 1 FROM con_solicitacoes WHERE id = p_solicitacao_id FOR UPDATE;

  SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
  FROM con_minutas WHERE solicitacao_id = p_solicitacao_id;

  INSERT INTO con_minutas (
    solicitacao_id, titulo, tipo, descricao,
    arquivo_url, arquivo_nome, versao, status
  ) VALUES (
    p_solicitacao_id, p_titulo, p_tipo, NULLIF(p_descricao, ''),
    p_arquivo_url, p_arquivo_nome, v_versao, 'rascunho'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.con_criar_minuta_atomic(uuid,text,text,text,text,text) TO authenticated;

-- (c) RPC com lock otimista para gravar ai_melhorias
-- Retorna jsonb { ok, conflito, ai_melhorado_em, ai_melhorias_atuais }
CREATE OR REPLACE FUNCTION public.con_atualizar_ai_melhorias(
  p_minuta_id        uuid,
  p_melhorias        jsonb,
  p_expected_atualiz timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_atual       timestamptz;
  v_atual_jsonb jsonb;
  v_novo        timestamptz;
BEGIN
  IF NOT can_access_modulo('contratos', auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao no modulo Contratos';
  END IF;

  SELECT ai_melhorado_em, ai_melhorias INTO v_atual, v_atual_jsonb
  FROM con_minutas WHERE id = p_minuta_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'minuta_nao_encontrada');
  END IF;

  -- p_expected_atualiz NULL = primeira gravacao (nenhuma versao anterior)
  IF (v_atual IS DISTINCT FROM p_expected_atualiz) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'conflito', true,
      'ai_melhorado_em', v_atual,
      'ai_melhorias_atuais', v_atual_jsonb
    );
  END IF;

  v_novo := now();
  UPDATE con_minutas
     SET ai_melhorias = p_melhorias,
         ai_melhorado_em = v_novo
   WHERE id = p_minuta_id;

  RETURN jsonb_build_object('ok', true, 'ai_melhorado_em', v_novo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.con_atualizar_ai_melhorias(uuid,jsonb,timestamptz) TO authenticated;
