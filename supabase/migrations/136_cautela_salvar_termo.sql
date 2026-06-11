-- ─────────────────────────────────────────────────────────────────────────────
-- 136_cautela_salvar_termo.sql
--
-- Bucket privado `cautelas-termos` + RPC que persiste termo de aceite
-- (PDF + assinatura PNG) e transita o status da cautela para `em_aberto`
-- (libera o material) só após termo salvo.
--
-- Pra cumprir o item Baixa do sprint:
-- "Gerar termo de aceite para colaborador preencher em tablet ao retirar
-- material" — persiste prova digital, deixa audit pra RH/admin e bloqueia
-- saída de material sem termo.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('cautelas-termos', 'cautelas-termos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: leitura via signed URL (server-side); escrita só por authenticated.
DROP POLICY IF EXISTS "cautelas-termos-write" ON storage.objects;
CREATE POLICY "cautelas-termos-write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cautelas-termos');

DROP POLICY IF EXISTS "cautelas-termos-read" ON storage.objects;
CREATE POLICY "cautelas-termos-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cautelas-termos');

-- 2) RPC: persiste paths + transita status. Idempotente (pode re-salvar).
CREATE OR REPLACE FUNCTION public.est_cautela_salvar_termo(
  p_cautela_id        uuid,
  p_assinatura_path   text,
  p_termo_path        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_status_anterior text;
  v_status_novo text;
BEGIN
  IF p_cautela_id IS NULL THEN
    RAISE EXCEPTION 'p_cautela_id obrigatório';
  END IF;

  SELECT status INTO v_status_anterior
    FROM est_cautelas WHERE id = p_cautela_id;
  IF v_status_anterior IS NULL THEN
    RAISE EXCEPTION 'Cautela % não encontrada', p_cautela_id;
  END IF;

  -- Transição automática: pendente/aprovada → em_aberto ao registrar termo.
  -- em_aberto/em_devolucao/encerrada → mantém status (só atualiza arquivos).
  v_status_novo := CASE
    WHEN v_status_anterior IN ('pendente', 'aprovada') THEN 'em_aberto'
    ELSE v_status_anterior
  END;

  UPDATE est_cautelas
     SET assinatura_retirada_url = p_assinatura_path,
         termo_url               = p_termo_path,
         data_retirada           = COALESCE(data_retirada, now()),
         status                  = v_status_novo,
         atualizado_em           = now()
   WHERE id = p_cautela_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status_anterior', v_status_anterior,
    'status_novo', v_status_novo,
    'assinatura_path', p_assinatura_path,
    'termo_path', p_termo_path
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.est_cautela_salvar_termo(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.est_cautela_salvar_termo(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.est_cautela_salvar_termo(uuid, text, text) IS
  'Persiste paths do termo (PDF) e assinatura (PNG) no Storage e transita status pendente/aprovada → em_aberto, marcando data_retirada se vazia.';
