-- ─────────────────────────────────────────────────────────────────────────────
-- 188_est_importar_inventario_limpa_marca.sql
--
-- Política do catálogo: descrição de item SEM marca (limpeza em massa feita em
-- 06/07/2026 removeu marca de 196 itens). Para os duplicados não renascerem a
-- cada import de inventário XLSX (que auto-cria item por descrição), a RPC
-- est_importar_inventario_por_descricao agora limpa a marca da descrição antes
-- de casar/criar o item, movendo-a para descricao_complementar.
--
-- (1) Helper est_limpar_marca_descricao(text): remove "MARCA <X>" explícito
--     (exceto caneta MARCA TEXTO) e marcas conhecidas embutidas (GEDORE,
--     TRAMONTINA, CIVITELLA...). "3M" solto NÃO é removido (pode ser 3 metros).
--     Também normaliza " .38" -> " 38" e espaços duplicados.
-- (2) RPC de import usa o helper; marca extraída compõe a observação/marca.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.est_limpar_marca_descricao(
  p_descricao text,
  OUT descricao_limpa text,
  OUT marcas text
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d        text;
  original text := coalesce(trim(p_descricao), '');
  v_marcas text[] := '{}';
  m        text;
  cap      text[];
  -- marcas compostas (removidas com ou sem o prefixo MARCA)
  multi  text[] := ARRAY['SETE LEGUAS','SETE LÉGUAS','MG CINTOS','MG CINTO','TINTAS MAZA'];
  -- marcas conhecidas embutidas (sem prefixo MARCA). '3M' fica de fora de propósito.
  brands text[] := ARRAY['GEDORE','TRAMONTINA','CIVITELLA','VONDER','MSA','STARRETT','STARRERT',
                         'STIHL','STHIL','MAZA','ESAB','STANLEY','STANLAY','DEWALT','TIGRE',
                         'HUSQVARNA','AMANCO','MINIPA','BRASILUX','SUNLAU','BOSCH','GERDAU',
                         'WORKER','MARLUVAS','PADO','PALOMA','PROCIPA','PROTECK','RPOTECK',
                         'SAYRO','VOLK','ZATTI','DANNY','CASTROL','DELTAPLUS'];
BEGIN
  d := ' ' || regexp_replace(original, '\s+', ' ', 'g') || ' ';

  -- protege caneta marca-texto do removedor genérico
  d := regexp_replace(d, 'MARCA\s+TEXTO', 'MARCA§TEXTO', 'gi');

  -- MARCA <composta>
  FOREACH m IN ARRAY multi LOOP
    IF d ~* ('MARCA\s+' || m) THEN
      v_marcas := array_append(v_marcas, m);
      d := regexp_replace(d, 'MARCA\s+' || m, ' ', 'gi');
    END IF;
  END LOOP;

  -- MARCA <palavra> (captura restrita a letras/dígitos: sem metacaracter de regex)
  LOOP
    cap := regexp_match(d, 'MARCA\s+([A-ZÀ-Ü0-9]+)', 'i');
    EXIT WHEN cap IS NULL;
    v_marcas := array_append(v_marcas, upper(cap[1]));
    d := regexp_replace(d, 'MARCA\s+' || cap[1], ' ', 'i');
  END LOOP;

  d := replace(d, 'MARCA§TEXTO', 'MARCA TEXTO');

  -- marcas compostas e simples embutidas (sem o prefixo)
  FOREACH m IN ARRAY multi LOOP
    IF d ~* ('\m' || m || '\M') THEN
      v_marcas := array_append(v_marcas, m);
      d := regexp_replace(d, '\m' || m || '\M', ' ', 'gi');
    END IF;
  END LOOP;
  FOREACH m IN ARRAY brands LOOP
    IF d ~* ('\m' || m || '\M') THEN
      v_marcas := array_append(v_marcas, m);
      d := regexp_replace(d, '\m' || m || '\M', ' ', 'gi');
    END IF;
  END LOOP;

  -- normalizações: " .38" -> " 38", espaços, pontas soltas
  d := regexp_replace(d, '\s\.(\d)', ' \1', 'g');
  d := trim(both ' -•,' from regexp_replace(d, '\s+', ' ', 'g'));

  -- descrição não pode ficar vazia/curta demais: mantém a original nesse caso
  IF length(d) < 5 THEN
    descricao_limpa := original;
  ELSE
    descricao_limpa := d;
  END IF;

  SELECT string_agg(DISTINCT upper(x), ' / ') INTO marcas FROM unnest(v_marcas) AS x;
END;
$$;

REVOKE ALL ON FUNCTION public.est_limpar_marca_descricao(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.est_limpar_marca_descricao(text) TO authenticated;

COMMENT ON FUNCTION public.est_limpar_marca_descricao(text) IS
  'Remove marca da descrição de item (política: catálogo sem marca) e devolve a marca extraída. Não toca em MARCA TEXTO nem em 3M solto.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC de import passa a limpar a marca antes de casar/criar item
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.est_importar_inventario_por_descricao(p_inventario_id uuid, p_itens jsonb, p_contado_por text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv          RECORD;
  v_linha        jsonb;
  v_descricao    text;
  v_descricao_n  text;
  v_unidade_raw  text;
  v_unidade      est_unidade;
  v_marca        text;
  v_marca_extra  text;
  v_qtd          numeric;
  v_item_id      uuid;
  v_codigo_novo  text;
  v_prefixo      text;
  v_saldo        numeric;
  v_importados   int := 0;
  v_criados      int := 0;
  v_erros        jsonb := '[]'::jsonb;
BEGIN
  SELECT id, base_id, status INTO v_inv
  FROM est_inventarios WHERE id = p_inventario_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'erro', 'inventario nao encontrado'); END IF;
  IF v_inv.status NOT IN ('aberto', 'em_contagem') THEN
    RETURN jsonb_build_object('ok', false, 'erro', format('inventario com status %s nao aceita importacao', v_inv.status));
  END IF;
  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'p_itens deve ser array json');
  END IF;
  IF v_inv.status = 'aberto' THEN UPDATE est_inventarios SET status = 'em_contagem' WHERE id = p_inventario_id; END IF;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_descricao   := nullif(trim(v_linha->>'descricao'), '');
    v_unidade_raw := upper(coalesce(trim(v_linha->>'unidade'), 'UN'));
    v_marca       := nullif(trim(v_linha->>'marca'), '');
    v_qtd         := nullif(v_linha->>'quantidade', '')::numeric;
    IF v_descricao IS NULL THEN v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'descricao vazia'); CONTINUE; END IF;
    IF v_qtd IS NULL OR v_qtd < 0 THEN v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'quantidade invalida'); CONTINUE; END IF;
    BEGIN v_unidade := v_unidade_raw::est_unidade; EXCEPTION WHEN OTHERS THEN v_unidade := 'UN'; END;

    -- Política: descrição sem marca. Extrai a marca e junta na coluna marca/observação.
    SELECT l.descricao_limpa, l.marcas INTO v_descricao, v_marca_extra
    FROM public.est_limpar_marca_descricao(v_descricao) l;
    IF v_marca_extra IS NOT NULL THEN
      v_marca := coalesce(v_marca || ' • ', '') || 'MARCA ' || v_marca_extra;
    END IF;

    v_descricao_n := upper(public.unaccent(v_descricao));
    SELECT id INTO v_item_id FROM est_itens
    WHERE upper(public.unaccent(descricao)) = v_descricao_n AND ativo = true LIMIT 1;

    IF v_item_id IS NULL THEN
      v_prefixo := public.est_classificar_descricao(v_descricao);
      v_codigo_novo := public.est_proximo_codigo(v_prefixo);
      INSERT INTO est_itens (codigo, descricao, categoria, subcategoria, unidade, ativo, valor_medio, destino_operacional, controle_estoque, descricao_complementar)
      VALUES (v_codigo_novo, upper(v_descricao),
        CASE v_prefixo
          WHEN '01.01' THEN 'EPI/EPC' WHEN '01.02' THEN 'MATERIAL DE OBRA'
          WHEN '01.03' THEN 'MATERIAL DE ESCRITORIO' WHEN '01.04' THEN 'USO E CONSUMO'
          WHEN '01.05' THEN 'FERRAMENTAL' WHEN '01.06' THEN 'EQUIPAMENTOS'
          WHEN '01.07' THEN 'TI' WHEN '01.08' THEN 'PECAS PARA MANUTENCAO'
          WHEN '01.09' THEN 'FARMACIA E MEDICAMENTOS' WHEN '01.10' THEN 'MAQUINAS E VEICULOS'
          ELSE 'USO E CONSUMO' END,
        'INVENTARIO_XLSX', v_unidade, true, 0, 'estoque', true, v_marca)
      RETURNING id INTO v_item_id;
      v_criados := v_criados + 1;
    END IF;

    SELECT coalesce(sum(CASE WHEN tipo IN ('entrada', 'transferencia_in', 'ajuste_positivo', 'devolucao') THEN quantidade ELSE -quantidade END), 0)
      INTO v_saldo
    FROM est_movimentacoes WHERE item_id = v_item_id AND (v_inv.base_id IS NULL OR base_id = v_inv.base_id);

    INSERT INTO est_inventario_itens (inventario_id, item_id, base_id, saldo_sistema, saldo_contado, divergencia_pct, contado_por, observacao, contado_em)
    VALUES (p_inventario_id, v_item_id, v_inv.base_id, v_saldo, v_qtd,
      CASE WHEN v_saldo = 0 THEN NULL ELSE round(((v_qtd - v_saldo) / v_saldo) * 100, 2) END,
      coalesce(p_contado_por, v_linha->>'contado_por'), v_marca, now())
    ON CONFLICT (inventario_id, item_id) DO UPDATE SET
      saldo_sistema=EXCLUDED.saldo_sistema, saldo_contado=EXCLUDED.saldo_contado,
      divergencia_pct=EXCLUDED.divergencia_pct,
      contado_por=coalesce(EXCLUDED.contado_por, est_inventario_itens.contado_por),
      observacao=coalesce(EXCLUDED.observacao, est_inventario_itens.observacao),
      contado_em=EXCLUDED.contado_em;
    v_importados := v_importados + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'importados', v_importados, 'criados', v_criados, 'erros_count', jsonb_array_length(v_erros), 'erros', v_erros);
END;
$function$;
