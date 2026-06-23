-- 161_est_itens_codigo_padrao_01_NN_NNNN.sql
-- Padroniza codigo dos itens auto-criados via inventario XLSX para
-- o padrao "01.NN.NNNN" que ja era usado no catalogo (em vez do timestamp
-- feio AG-20260623131905-xxxxxx gerado pela mig 159).
--
-- Estrategia:
--   1. Helper est_classificar_descricao() classifica por heuristica
--      (palavras-chave em UPPER+unaccent) retornando o prefixo 01.NN.
--   2. Helper est_proximo_codigo() devolve o proximo sequencial atomico
--      por prefixo (lock na tabela inteira ao calcular).
--   3. RPC est_importar_inventario_por_descricao usa os helpers em vez
--      do timestamp+hash.
--   4. Backfill: renomeia os 184 itens ja criados via XLSX.

-- ============================================================================
-- (1) Helper de classificacao
-- ============================================================================
CREATE OR REPLACE FUNCTION public.est_classificar_descricao(p_descricao text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d text;
BEGIN
  IF p_descricao IS NULL OR p_descricao = '' THEN
    RETURN '01.04'; -- default: Uso e Consumo
  END IF;
  d := upper(public.unaccent(p_descricao));

  -- 01.01 EPI/EPC
  IF d ~ '(CAPACETE|LUVA|OCULOS|MASCARA|RESPIRADOR|BOTA|UNIFORME|PROTETOR|CAMISA|CALCA|CINTO\s+SEG|AVENTAL|ABAFADOR|PROTECAO|EPI|EPC|CAPANGA|JAQUETA|BLUSA|MACACAO|COLETE|TOUCA)' THEN
    RETURN '01.01';
  END IF;

  -- 01.02 Material de Obra
  IF d ~ '(ACO|CIMENTO|CONCRETO|AREIA|BRITA|PEDRA|TIJOLO|VERGALHAO|TELA\s+SOLD|EAP|ARGAMASSA|CAL\s|GESSO|CHAPA|BARRA\s+CA)' THEN
    RETURN '01.02';
  END IF;

  -- 01.03 Material de Escritorio
  IF d ~ '(CANETA|LAPIS|PAPEL\s+A4|GRAMPEADOR|CADERNO|PASTA\s+ARQ|CLIPS|TONER|CARTUCHO|ENVELOPE|POST.IT|MARCADOR|REGUA|TESOURA\s+ESC|BLOCO|ETIQUETA)' THEN
    RETURN '01.03';
  END IF;

  -- 01.05 Ferramental
  IF d ~ '(CHAVE|MARTELO|ALICATE|FURADEIRA|ESMERIL|SERROTE|MARRETA|ALAVANCA|POLICORTE|PERFURATRIZ|ENXADA|PA\s|PICARETA|TALHADEIRA|SOQUETE|CATRACA|TORQUIMETRO|SARGENTO|GRIFO|GUINCHO\s+MANUAL|CORDA|TRENA|NIVEL\s+BOLHA|PRUMO|ESQUADRO|LIXADEIRA|MAQUITA)' THEN
    RETURN '01.05';
  END IF;

  -- 01.06 Equipamentos
  IF d ~ '(GERADOR|COMPRESSOR|MOTOR\s+BOMBA|VIBRADOR|BETONEIRA|GUINDASTE|EMPILHADEIRA|ESCAVADEIRA|TRATOR|RETROESCAVADEIRA|CARREGADEIRA|MOTONIVELADORA|RTK|TOPOGRAFIA|TEODOLITO|NIVEL\s+OPT)' THEN
    RETURN '01.06';
  END IF;

  -- 01.07 TI (software/hardware)
  IF d ~ '(COMPUTADOR|NOTEBOOK|IMPRESSORA|MOUSE|TECLADO|MONITOR|SERVIDOR|ROTEADOR|SWITCH|WEBCAM|HEADSET|HD\s|SSD\s|PEN.DRIVE|CABO\s+REDE|RACK\s+TI|RTK\s+(TOPOGRAFIA)|MANGOTE\s+ETHERNET)' THEN
    RETURN '01.07';
  END IF;

  -- 01.08 Pecas para Manutencao
  IF d ~ '(FILTRO|OLEO\s+MOTOR|OLEO\s+HIDRA|JUNTA|ROLAMENTO|BATERIA|PASTILHA|DISCO\s+FREIO|PNEU|CAMARA\s+AR|VELA\s+IGN|CORREIA|MANGUEIRA|RADIADOR|RETENTOR|AMORTECEDOR|VALVULA|BOMBA\s+(AGUA|OLEO))' THEN
    RETURN '01.08';
  END IF;

  -- 01.09 Farmacia
  IF d ~ '(REMEDIO|MEDICAMENTO|ANALGES|ANTIINFLA|CURATIVO|GAZE|ESPARADRAPO|SORO\s+FISIO|ALCOOL\s+70)' THEN
    RETURN '01.09';
  END IF;

  -- 01.10 Maquinas e Veiculos
  IF d ~ '(CAMINHAO|VEICULO|MAQUINA\s+(PESADA|ESCAV))' THEN
    RETURN '01.10';
  END IF;

  -- 01.04 Uso e Consumo (default): inclui limpeza, alimentacao, alojamento e demais
  RETURN '01.04';
END;
$$;

-- ============================================================================
-- (2) Helper proximo codigo sequencial por prefixo
-- ============================================================================
CREATE OR REPLACE FUNCTION public.est_proximo_codigo(p_prefixo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max int;
  v_next int;
BEGIN
  -- Lock advisory pra serializar geracao do proximo codigo deste prefixo
  PERFORM pg_advisory_xact_lock(hashtext('est_codigo_' || p_prefixo));

  SELECT COALESCE(MAX((substring(codigo from '\.(\d{4})$'))::int), 0)
    INTO v_max
  FROM est_itens
  WHERE codigo LIKE p_prefixo || '.%'
    AND codigo ~ ('^' || replace(p_prefixo, '.', '\.') || '\.\d{4}$');

  v_next := v_max + 1;
  RETURN p_prefixo || '.' || lpad(v_next::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.est_proximo_codigo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.est_classificar_descricao(text) TO authenticated;

-- ============================================================================
-- (3) RPC atualizada usa novos helpers
-- ============================================================================
CREATE OR REPLACE FUNCTION public.est_importar_inventario_por_descricao(
  p_inventario_id uuid,
  p_itens         jsonb,
  p_contado_por   text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv          RECORD;
  v_linha        jsonb;
  v_descricao    text;
  v_descricao_n  text;
  v_unidade_raw  text;
  v_unidade      est_unidade;
  v_marca        text;
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

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'inventario nao encontrado');
  END IF;

  IF v_inv.status NOT IN ('aberto', 'em_contagem') THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      format('inventario com status %s nao aceita importacao', v_inv.status));
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'p_itens deve ser array json');
  END IF;

  IF v_inv.status = 'aberto' THEN
    UPDATE est_inventarios SET status = 'em_contagem' WHERE id = p_inventario_id;
  END IF;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_descricao   := nullif(trim(v_linha->>'descricao'), '');
    v_unidade_raw := upper(coalesce(trim(v_linha->>'unidade'), 'UN'));
    v_marca       := nullif(trim(v_linha->>'marca'), '');
    v_qtd         := nullif(v_linha->>'quantidade', '')::numeric;

    IF v_descricao IS NULL THEN
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'descricao vazia');
      CONTINUE;
    END IF;
    IF v_qtd IS NULL OR v_qtd < 0 THEN
      v_erros := v_erros || jsonb_build_object('linha', v_linha, 'motivo', 'quantidade invalida');
      CONTINUE;
    END IF;

    BEGIN
      v_unidade := v_unidade_raw::est_unidade;
    EXCEPTION WHEN OTHERS THEN
      v_unidade := 'UN';
    END;

    v_descricao_n := upper(public.unaccent(v_descricao));

    SELECT id INTO v_item_id
    FROM est_itens
    WHERE upper(public.unaccent(descricao)) = v_descricao_n
      AND ativo = true
    LIMIT 1;

    IF v_item_id IS NULL THEN
      -- Classificacao por descricao + proximo codigo sequencial atomico
      v_prefixo := public.est_classificar_descricao(v_descricao);
      v_codigo_novo := public.est_proximo_codigo(v_prefixo);

      INSERT INTO est_itens (
        codigo, descricao, categoria, subcategoria, unidade,
        ativo, valor_medio, destino_operacional, controle_estoque, descricao_complementar
      ) VALUES (
        v_codigo_novo, upper(v_descricao),
        CASE v_prefixo
          WHEN '01.01' THEN 'EPI/EPC'
          WHEN '01.02' THEN 'MATERIAL DE OBRA'
          WHEN '01.03' THEN 'MATERIAL DE ESCRITORIO'
          WHEN '01.04' THEN 'USO E CONSUMO'
          WHEN '01.05' THEN 'FERRAMENTAL'
          WHEN '01.06' THEN 'EQUIPAMENTOS'
          WHEN '01.07' THEN 'TI'
          WHEN '01.08' THEN 'PECAS PARA MANUTENCAO'
          WHEN '01.09' THEN 'FARMACIA E MEDICAMENTOS'
          WHEN '01.10' THEN 'MAQUINAS E VEICULOS'
          ELSE 'USO E CONSUMO'
        END,
        'INVENTARIO_XLSX', v_unidade,
        true, 0, 'estoque', true, v_marca
      )
      RETURNING id INTO v_item_id;
      v_criados := v_criados + 1;
    END IF;

    SELECT coalesce(sum(
      CASE WHEN tipo IN ('entrada', 'transferencia_in', 'ajuste_positivo', 'devolucao')
           THEN quantidade
           ELSE -quantidade
      END
    ), 0)
    INTO v_saldo
    FROM est_movimentacoes
    WHERE item_id = v_item_id
      AND (v_inv.base_id IS NULL OR base_id = v_inv.base_id);

    INSERT INTO est_inventario_itens (
      inventario_id, item_id, base_id,
      saldo_sistema, saldo_contado,
      divergencia_pct,
      contado_por, observacao, contado_em
    ) VALUES (
      p_inventario_id, v_item_id, v_inv.base_id,
      v_saldo, v_qtd,
      CASE WHEN v_saldo = 0 THEN NULL ELSE round(((v_qtd - v_saldo) / v_saldo) * 100, 2) END,
      coalesce(p_contado_por, v_linha->>'contado_por'),
      v_marca,
      now()
    )
    ON CONFLICT (inventario_id, item_id) DO UPDATE SET
      saldo_sistema   = EXCLUDED.saldo_sistema,
      saldo_contado   = EXCLUDED.saldo_contado,
      divergencia_pct = EXCLUDED.divergencia_pct,
      contado_por     = coalesce(EXCLUDED.contado_por, est_inventario_itens.contado_por),
      observacao      = coalesce(EXCLUDED.observacao, est_inventario_itens.observacao),
      contado_em      = EXCLUDED.contado_em;

    v_importados := v_importados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'importados', v_importados,
    'criados', v_criados,
    'erros_count', jsonb_array_length(v_erros),
    'erros', v_erros
  );
END;
$$;

-- ============================================================================
-- (4) Backfill: renomeia os 184 itens ja auto-criados
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  v_prefixo text;
  v_codigo_novo text;
  v_categoria_nova text;
BEGIN
  FOR r IN
    SELECT id, codigo, descricao
    FROM est_itens
    WHERE codigo ~ '^AG-\d{14}-' OR codigo ~ '^AG-\d+$'  -- timestamps + sequenciais antigos
    ORDER BY criado_em ASC
  LOOP
    v_prefixo := public.est_classificar_descricao(r.descricao);
    v_codigo_novo := public.est_proximo_codigo(v_prefixo);

    v_categoria_nova := CASE v_prefixo
      WHEN '01.01' THEN 'EPI/EPC'
      WHEN '01.02' THEN 'MATERIAL DE OBRA'
      WHEN '01.03' THEN 'MATERIAL DE ESCRITORIO'
      WHEN '01.04' THEN 'USO E CONSUMO'
      WHEN '01.05' THEN 'FERRAMENTAL'
      WHEN '01.06' THEN 'EQUIPAMENTOS'
      WHEN '01.07' THEN 'TI'
      WHEN '01.08' THEN 'PECAS PARA MANUTENCAO'
      WHEN '01.09' THEN 'FARMACIA E MEDICAMENTOS'
      WHEN '01.10' THEN 'MAQUINAS E VEICULOS'
      ELSE 'USO E CONSUMO'
    END;

    UPDATE est_itens
       SET codigo = v_codigo_novo,
           categoria = v_categoria_nova
     WHERE id = r.id;
  END LOOP;
END;
$$;
