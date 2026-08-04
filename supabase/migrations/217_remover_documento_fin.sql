-- ─────────────────────────────────────────────────────────────────────────────
-- 217_remover_documento_fin.sql
--
-- O botão de remover anexo não avançava para a Lauany (supervisora do
-- Financeiro). Motivo: a única política de DELETE em fin_documentos é
-- fin_docs_delete_gerente → role_at_least('gerente'), que exige nível 4
-- (diretor/administrador). Ela é 'gestor' (nível 3): o DELETE apagava 0 linhas
-- e NÃO devolvia erro — o silêncio clássico de RLS. A tela não tinha como saber.
--
-- Regra nova: quem pode ANEXAR pode DESANEXAR. As políticas de insert/update já
-- usam can_access_modulo('financeiro') OR can_access_modulo('compras');
-- a remoção passa a usar a mesma régua, via RPC (a política de DELETE continua
-- restrita — a RPC é a porta oficial, e ela registra quem removeu o quê).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_documento_remover(p_doc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_doc    fin_documentos%ROWTYPE;
  v_perfil sys_perfis%ROWTYPE;
  v_resto  text;
  v_bucket text;
  v_path   text;
BEGIN
  SELECT * INTO v_perfil FROM sys_perfis WHERE auth_id = auth.uid() AND ativo IS TRUE LIMIT 1;
  IF v_perfil.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Perfil não encontrado ou inativo.');
  END IF;

  IF NOT (can_access_modulo('financeiro', auth.uid()) OR can_access_modulo('compras', auth.uid())) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sem permissão: remover anexo exige acesso ao Financeiro ou ao Compras.');
  END IF;

  SELECT * INTO v_doc FROM fin_documentos WHERE id = p_doc_id;
  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Documento não encontrado (talvez já removido).');
  END IF;

  DELETE FROM fin_documentos WHERE id = p_doc_id;

  -- Tira o arquivo do bucket também: o cliente pode nem ter permissão no
  -- storage, e anexo errado que continua com URL pública não foi removido.
  IF v_doc.arquivo_url LIKE '%/object/public/%' THEN
    v_resto  := split_part(v_doc.arquivo_url, '/object/public/', 2);
    v_bucket := split_part(v_resto, '/', 1);
    v_path   := substring(v_resto from position('/' in v_resto) + 1);
    IF v_bucket <> '' AND v_path <> '' THEN
      DELETE FROM storage.objects
       WHERE bucket_id = v_bucket
         AND name = replace(v_path, '%20', ' ');
    END IF;
  END IF;

  -- Anexo financeiro apagado deixa rastro: o arquivo some, o registro de quem
  -- apagou fica.
  INSERT INTO sys_log_atividades (modulo, entidade_tipo, entidade_id, tipo, descricao, usuario_id, usuario_nome, dados)
  VALUES ('financeiro', v_doc.entity_type, v_doc.entity_id, 'documento_removido',
          'Anexo removido: ' || COALESCE(v_doc.nome_arquivo, '(sem nome)'),
          v_perfil.id, v_perfil.nome,
          jsonb_build_object(
            'documento_id', v_doc.id,
            'tipo', v_doc.tipo,
            'nome_arquivo', v_doc.nome_arquivo,
            'arquivo_url', v_doc.arquivo_url,
            'entity_type', v_doc.entity_type,
            'entity_id', v_doc.entity_id
          ));

  RETURN jsonb_build_object('ok', true, 'arquivo_url', v_doc.arquivo_url);
END;
$$;

COMMENT ON FUNCTION public.fin_documento_remover(uuid) IS
  'Remove anexo financeiro. Porta oficial: a política de DELETE exige diretor/admin, e o DELETE direto falhava em silêncio para supervisor.';

GRANT EXECUTE ON FUNCTION public.fin_documento_remover(uuid) TO authenticated;
