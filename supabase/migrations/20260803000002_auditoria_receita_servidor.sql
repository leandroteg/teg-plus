-- ─────────────────────────────────────────────────────────────────────────────
-- 20260803000002_auditoria_receita_servidor.sql
--
-- Varredura da Receita rodando no SERVIDOR (pg_net + pg_cron) — não depende do
-- navegador aberto. pg_net é assíncrono: um passo dispara as requisições e
-- outro coleta as respostas de net._http_response.
--
-- fn_auditoria_receita_tick() é agendada de minuto em minuto (15 CNPJs por vez,
-- ritmo que a BrasilAPI aguenta sem bloquear) e SE AUTO-DESAGENDA quando não
-- sobra nada a consultar nem a coletar.
--
-- Cuidado que custou um bug: a Receita às vezes devolve logradouro/número
-- vazios e só o bairro — montar "CENTRO" e sugerir a troca apagaria um endereço
-- bom. Por isso só há sugestão de endereço quando vem logradouro.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cmp_fornecedores_receita_auditoria ADD COLUMN IF NOT EXISTS request_id bigint;
CREATE INDEX IF NOT EXISTS idx_forn_receita_aud_request ON public.cmp_fornecedores_receita_auditoria(request_id)
  WHERE request_id IS NOT NULL;

-- Normalização da comparação (espelha a do front)
CREATE OR REPLACE FUNCTION public.fn_norm_cmp(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      regexp_replace(
        upper(translate(COALESCE(p, ''),
          'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
        '[.,\-/]', ' ', 'g'),
      '\s+', ' ', 'g')),
    '');
$$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_receita_disparar(p_limite int DEFAULT 15)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r   record;
  v_req bigint;
  v_qtd int := 0;
BEGIN
  FOR r IN
    SELECT f.id, regexp_replace(f.cnpj, '\D', '', 'g') AS cnpj_limpo
    FROM cmp_fornecedores f
    LEFT JOIN cmp_fornecedores_receita_auditoria a ON a.fornecedor_id = f.id
    WHERE f.ativo
      AND length(regexp_replace(COALESCE(f.cnpj, ''), '\D', '', 'g')) = 14
      AND a.id IS NULL
    ORDER BY f.razao_social
    LIMIT p_limite
  LOOP
    v_req := net.http_get(
      url := 'https://brasilapi.com.br/api/cnpj/v1/' || r.cnpj_limpo,
      timeout_milliseconds := 15000
    );

    INSERT INTO cmp_fornecedores_receita_auditoria (fornecedor_id, cnpj, status, request_id, consultado_em)
    VALUES (r.id, r.cnpj_limpo, 'consultando', v_req, now())
    ON CONFLICT (fornecedor_id) DO UPDATE
      SET status = 'consultando', request_id = EXCLUDED.request_id, consultado_em = now(), erro = NULL;

    v_qtd := v_qtd + 1;
  END LOOP;
  RETURN v_qtd;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_receita_coletar()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a        record;
  resp     record;
  j        jsonb;
  f        cmp_fornecedores%ROWTYPE;
  v_end    text;
  v_div    jsonb;
  v_sit    text;
  v_qtd    int := 0;
BEGIN
  FOR a IN
    SELECT * FROM cmp_fornecedores_receita_auditoria
    WHERE status = 'consultando' AND request_id IS NOT NULL
    LIMIT 200
  LOOP
    SELECT * INTO resp FROM net._http_response WHERE id = a.request_id;
    CONTINUE WHEN NOT FOUND;

    IF resp.status_code IS DISTINCT FROM 200 OR resp.content IS NULL THEN
      UPDATE cmp_fornecedores_receita_auditoria
         SET status = 'erro',
             erro = COALESCE(resp.error_msg, 'HTTP ' || COALESCE(resp.status_code::text, '?')),
             request_id = NULL
       WHERE id = a.id;
      v_qtd := v_qtd + 1;
      CONTINUE;
    END IF;

    BEGIN
      j := resp.content::jsonb;
    EXCEPTION WHEN others THEN
      UPDATE cmp_fornecedores_receita_auditoria
         SET status = 'erro', erro = 'Resposta invalida', request_id = NULL WHERE id = a.id;
      v_qtd := v_qtd + 1;
      CONTINUE;
    END;

    SELECT * INTO f FROM cmp_fornecedores WHERE id = a.fornecedor_id;
    CONTINUE WHEN NOT FOUND;

    v_end := CASE
      WHEN NULLIF(btrim(COALESCE(j->>'logradouro','')), '') IS NULL THEN NULL
      ELSE concat_ws(' - ',
        NULLIF(concat_ws(', ', btrim(j->>'logradouro'),
                               NULLIF(btrim(COALESCE(j->>'numero','')), '')), ''),
        NULLIF(btrim(COALESCE(j->>'complemento','')), ''),
        NULLIF(btrim(COALESCE(j->>'bairro','')), ''))
    END;

    v_sit := upper(btrim(COALESCE(j->>'descricao_situacao_cadastral', '')));
    v_div := '{}'::jsonb;

    IF NULLIF(btrim(COALESCE(j->>'razao_social','')), '') IS NOT NULL
       AND fn_norm_cmp(j->>'razao_social') IS DISTINCT FROM fn_norm_cmp(f.razao_social) THEN
      v_div := v_div || jsonb_build_object('razao_social',
        jsonb_build_object('atual', COALESCE(f.razao_social,''), 'receita', btrim(j->>'razao_social')));
    END IF;

    IF NULLIF(btrim(COALESCE(j->>'nome_fantasia','')), '') IS NOT NULL
       AND fn_norm_cmp(j->>'nome_fantasia') IS DISTINCT FROM fn_norm_cmp(f.nome_fantasia) THEN
      v_div := v_div || jsonb_build_object('nome_fantasia',
        jsonb_build_object('atual', COALESCE(f.nome_fantasia,''), 'receita', btrim(j->>'nome_fantasia')));
    END IF;

    IF v_end IS NOT NULL AND fn_norm_cmp(v_end) IS DISTINCT FROM fn_norm_cmp(f.endereco) THEN
      v_div := v_div || jsonb_build_object('endereco',
        jsonb_build_object('atual', COALESCE(f.endereco,''), 'receita', v_end));
    END IF;

    IF NULLIF(btrim(COALESCE(j->>'municipio','')), '') IS NOT NULL
       AND fn_norm_cmp(j->>'municipio') IS DISTINCT FROM fn_norm_cmp(f.cidade) THEN
      v_div := v_div || jsonb_build_object('cidade',
        jsonb_build_object('atual', COALESCE(f.cidade,''), 'receita', btrim(j->>'municipio')));
    END IF;

    IF NULLIF(btrim(COALESCE(j->>'uf','')), '') IS NOT NULL
       AND upper(btrim(COALESCE(j->>'uf',''))) IS DISTINCT FROM upper(btrim(COALESCE(f.uf,''))) THEN
      v_div := v_div || jsonb_build_object('uf',
        jsonb_build_object('atual', COALESCE(f.uf,''), 'receita', upper(btrim(j->>'uf'))));
    END IF;

    IF NULLIF(regexp_replace(COALESCE(j->>'cep',''), '\D', '', 'g'), '') IS NOT NULL
       AND regexp_replace(COALESCE(j->>'cep',''), '\D', '', 'g')
           IS DISTINCT FROM regexp_replace(COALESCE(f.cep,''), '\D', '', 'g') THEN
      v_div := v_div || jsonb_build_object('cep',
        jsonb_build_object('atual', COALESCE(f.cep,''), 'receita', regexp_replace(j->>'cep', '\D', '', 'g')));
    END IF;

    UPDATE cmp_fornecedores_receita_auditoria
       SET situacao = NULLIF(v_sit, ''),
           receita = j,
           divergencias = v_div,
           qtd_divergencias = (SELECT count(*) FROM jsonb_object_keys(v_div)),
           status = CASE WHEN (SELECT count(*) FROM jsonb_object_keys(v_div)) > 0
                           OR (v_sit <> '' AND v_sit <> 'ATIVA')
                         THEN 'pendente' ELSE 'ok' END,
           erro = NULL,
           request_id = NULL,
           consultado_em = now()
     WHERE id = a.id;

    v_qtd := v_qtd + 1;
  END LOOP;

  RETURN v_qtd;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_auditoria_receita_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_coletados int;
  v_disparados int;
  v_falta int;
  v_pendente_coleta int;
BEGIN
  v_coletados  := fn_auditoria_receita_coletar();
  v_disparados := fn_auditoria_receita_disparar(15);

  SELECT count(*) INTO v_falta
  FROM cmp_fornecedores f
  LEFT JOIN cmp_fornecedores_receita_auditoria a ON a.fornecedor_id = f.id
  WHERE f.ativo
    AND length(regexp_replace(COALESCE(f.cnpj, ''), '\D', '', 'g')) = 14
    AND a.id IS NULL;

  SELECT count(*) INTO v_pendente_coleta
  FROM cmp_fornecedores_receita_auditoria WHERE status = 'consultando';

  IF v_falta = 0 AND v_pendente_coleta = 0 THEN
    PERFORM cron.unschedule('auditoria_receita_fornecedores')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auditoria_receita_fornecedores');
  END IF;

  RETURN jsonb_build_object('coletados', v_coletados, 'disparados', v_disparados,
                            'faltam', v_falta, 'aguardando_resposta', v_pendente_coleta);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_auditoria_receita_disparar(int) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_auditoria_receita_coletar() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_auditoria_receita_tick() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_auditoria_receita_disparar(int) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.fn_auditoria_receita_coletar() TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.fn_auditoria_receita_tick() TO authenticated, service_role;

-- Agenda a varredura (o tick se desagenda sozinho ao terminar)
SELECT cron.unschedule('auditoria_receita_fornecedores')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auditoria_receita_fornecedores');

SELECT cron.schedule('auditoria_receita_fornecedores', '* * * * *',
                     $$SELECT public.fn_auditoria_receita_tick()$$);
