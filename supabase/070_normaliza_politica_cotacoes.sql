BEGIN;

-- Normaliza regras de categorias para o padrao "cotacoes"
UPDATE public.cmp_categorias
SET alcada1_limite = 3000
WHERE codigo = 'OUTROS_MAT_OBRA';

UPDATE public.cmp_categorias
SET politica_resumo = '3 cotacoes. Recorrentes: 5 referencias. Fornecedor unico preferencial. Alvara sanitario obrigatorio e contrato pelo periodo da obra.'
WHERE codigo = 'ALIMENTACAO_CANTEIRO';

UPDATE public.cmp_categorias
SET politica_resumo = '2 cotacoes para manutencao. Solicitacao com relatorio fotografico do prefeito ou almoxarife.'
WHERE codigo = 'ITENS_ALOJAMENTO';

UPDATE public.cmp_categorias
SET politica_resumo = '2 cotacoes para manutencao. Oficinas revisadas a cada 3 meses. Preventiva por calendario e corretiva com relatorio fotografico.'
WHERE codigo = 'MANUT_FROTA';

UPDATE public.cmp_categorias
SET politica_resumo = '2 cotacoes. Manutencao predial e demandas administrativas com relatorio fotografico e preferencia por fornecedores cadastrados.'
WHERE codigo = 'SERV_ADMIN';

UPDATE public.cmp_categorias
SET
  cotacoes_regras = '{"ate_500":5,"501_a_2k":5,"acima_2k":5}'::jsonb,
  politica_resumo = '5 cotacoes minimas. Equipe de mobilizacao busca e vistoria com relatorio fotografico. Contratacao somente com aprovacao do Laucidio.'
WHERE codigo = 'LOCACAO_IMOVEIS';

UPDATE public.cmp_categorias
SET
  cotacoes_regras = '{"ate_500":2,"501_a_2k":2,"acima_2k":2}'::jsonb,
  politica_resumo = 'Minimo de 2 cotacoes. Demandas pontuais direcionadas pela diretoria, com justificativa obrigatoria e aprovacao sempre do Laucidio.'
WHERE codigo = 'COMPRAS_EXTRA';

-- Reforca validacao de cotacoes minimas por categoria (quando houver regra)
CREATE OR REPLACE FUNCTION public.get_alerta_cotacao(p_requisicao_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result           JSONB;
  v_valor            NUMERIC;
  v_categoria        TEXT;
  v_regras           JSONB;
  v_cotacao_id       UUID;
  v_sem_minimas      BOOLEAN;
  v_justificativa    TEXT;
  v_forn_count       INT;
  v_minimo           INT;
  v_ate500           INT;
  v_501a2k           INT;
  v_acima2k          INT;
BEGIN
  SELECT COALESCE(
    (SELECT SUM(ri.quantidade * ri.valor_unitario_estimado)
     FROM cmp_requisicao_itens ri
     WHERE ri.requisicao_id = p_requisicao_id),
    r.valor_estimado,
    0
  ),
  r.categoria
  INTO v_valor, v_categoria
  FROM cmp_requisicoes r
  WHERE r.id = p_requisicao_id;

  SELECT c.cotacoes_regras
  INTO v_regras
  FROM cmp_categorias c
  WHERE c.codigo = v_categoria
    AND c.ativo = true
  LIMIT 1;

  IF v_regras IS NULL THEN
    v_minimo := CASE
      WHEN v_valor <= 500 THEN 1
      WHEN v_valor <= 2000 THEN 2
      ELSE 3
    END;
  ELSE
    v_ate500 := CASE
      WHEN COALESCE(v_regras->>'ate_500', '') ~ '^[0-9]+$' THEN (v_regras->>'ate_500')::INT
      ELSE NULL
    END;

    v_501a2k := CASE
      WHEN COALESCE(v_regras->>'501_a_2k', '') ~ '^[0-9]+$' THEN (v_regras->>'501_a_2k')::INT
      ELSE NULL
    END;

    v_acima2k := CASE
      WHEN COALESCE(v_regras->>'acima_2k', '') ~ '^[0-9]+$' THEN (v_regras->>'acima_2k')::INT
      ELSE NULL
    END;

    IF v_valor <= 500 THEN
      v_minimo := GREATEST(COALESCE(v_ate500, 1), 1);
    ELSIF v_valor <= 2000 THEN
      v_minimo := GREATEST(COALESCE(v_501a2k, v_ate500, 2), 1);
    ELSE
      v_minimo := GREATEST(COALESCE(v_acima2k, v_501a2k, v_ate500, 3), 1);
    END IF;
  END IF;

  SELECT c.id, COALESCE(c.sem_cotacoes_minimas, false), c.justificativa_sem_cotacoes
  INTO v_cotacao_id, v_sem_minimas, v_justificativa
  FROM cmp_cotacoes c
  WHERE c.requisicao_id = p_requisicao_id
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_cotacao_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_forn_count
    FROM cmp_cotacao_fornecedores cf
    WHERE cf.cotacao_id = v_cotacao_id;
  ELSE
    v_forn_count := 0;
  END IF;

  v_result := jsonb_build_object(
    'sem_cotacoes_minimas',   v_sem_minimas,
    'justificativa',          v_justificativa,
    'cotacoes_count',         v_forn_count,
    'cotacoes_minimo',        v_minimo,
    'cotacoes_insuficientes', (v_cotacao_id IS NOT NULL AND v_forn_count < v_minimo)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMIT;

