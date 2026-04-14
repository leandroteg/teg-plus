-- 080_frotas_kpi_views.sql — RPC functions for fleet KPI dashboards
-- Custo por KM, Consumo Real, Score Motorista

-- 1. Custo por KM: join abastecimentos + OS concluidas, divide by hodometro delta
CREATE OR REPLACE FUNCTION rpc_frotas_custo_por_km(p_inicio date, p_fim date)
RETURNS TABLE (
  veiculo_id    uuid,
  placa         text,
  marca         text,
  modelo        text,
  custo_total   numeric,
  km_percorrido real,
  custo_por_km  numeric
)
LANGUAGE sql STABLE AS $$
  WITH custos AS (
    SELECT
      v.id          AS veiculo_id,
      v.placa,
      v.marca,
      v.modelo,
      COALESCE(ab.total_abast, 0) + COALESCE(os.total_os, 0) AS custo_total
    FROM fro_veiculos v
    LEFT JOIN (
      SELECT veiculo_id, SUM(valor_total) AS total_abast
      FROM fro_abastecimentos
      WHERE data_abastecimento BETWEEN p_inicio AND p_fim
      GROUP BY veiculo_id
    ) ab ON ab.veiculo_id = v.id
    LEFT JOIN (
      SELECT veiculo_id, SUM(valor_final) AS total_os
      FROM fro_ordens_servico
      WHERE status = 'concluida'
        AND data_conclusao::date BETWEEN p_inicio AND p_fim
      GROUP BY veiculo_id
    ) os ON os.veiculo_id = v.id
    WHERE COALESCE(ab.total_abast, 0) + COALESCE(os.total_os, 0) > 0
  ),
  km AS (
    SELECT
      veiculo_id,
      MAX(hodometro) - MIN(hodometro) AS km_percorrido
    FROM tel_posicoes
    WHERE hodometro IS NOT NULL
      AND cobli_ts::date BETWEEN p_inicio AND p_fim
    GROUP BY veiculo_id
    HAVING MAX(hodometro) - MIN(hodometro) > 0
  )
  SELECT
    c.veiculo_id,
    c.placa,
    c.marca,
    c.modelo,
    c.custo_total,
    COALESCE(k.km_percorrido, 0)::real AS km_percorrido,
    ROUND((c.custo_total / NULLIF(k.km_percorrido::numeric, 0))::numeric, 2) AS custo_por_km
  FROM custos c
  LEFT JOIN km k ON k.veiculo_id = c.veiculo_id
  ORDER BY custo_por_km DESC NULLS LAST;
$$;

-- 2. Consumo Real: litros vs km from hodometro
CREATE OR REPLACE FUNCTION rpc_frotas_consumo_real(p_inicio date, p_fim date)
RETURNS TABLE (
  veiculo_id    uuid,
  placa         text,
  km_percorrido real,
  litros_total  numeric,
  km_por_litro  numeric
)
LANGUAGE sql STABLE AS $$
  WITH litros AS (
    SELECT
      a.veiculo_id,
      v.placa,
      SUM(a.litros) AS litros_total
    FROM fro_abastecimentos a
    JOIN fro_veiculos v ON v.id = a.veiculo_id
    WHERE a.data_abastecimento BETWEEN p_inicio AND p_fim
    GROUP BY a.veiculo_id, v.placa
  ),
  km AS (
    SELECT
      veiculo_id,
      MAX(hodometro) - MIN(hodometro) AS km_percorrido
    FROM tel_posicoes
    WHERE hodometro IS NOT NULL
      AND cobli_ts::date BETWEEN p_inicio AND p_fim
    GROUP BY veiculo_id
    HAVING MAX(hodometro) - MIN(hodometro) > 0
  )
  SELECT
    l.veiculo_id,
    l.placa,
    COALESCE(k.km_percorrido, 0)::real AS km_percorrido,
    l.litros_total,
    ROUND((COALESCE(k.km_percorrido, 0)::numeric / NULLIF(l.litros_total, 0))::numeric, 2) AS km_por_litro
  FROM litros l
  LEFT JOIN km k ON k.veiculo_id = l.veiculo_id
  ORDER BY km_por_litro ASC NULLS LAST;
$$;

-- 3. Score Motorista: count ocorrencias per motorista
CREATE OR REPLACE FUNCTION rpc_frotas_score_motorista(p_inicio date, p_fim date)
RETURNS TABLE (
  motorista_id        uuid,
  nome                text,
  total_ocorrencias   bigint,
  ocorrencias_por_1000km numeric
)
LANGUAGE sql STABLE AS $$
  WITH oc AS (
    SELECT
      motorista_id,
      COUNT(*) AS total_ocorrencias
    FROM fro_ocorrencias_telemetria
    WHERE data_ocorrencia::date BETWEEN p_inicio AND p_fim
      AND motorista_id IS NOT NULL
    GROUP BY motorista_id
  ),
  motorista_veiculos AS (
    SELECT DISTINCT
      o.motorista_id,
      o2.veiculo_id
    FROM fro_ocorrencias_telemetria o
    JOIN fro_ocorrencias_telemetria o2 ON o2.motorista_id = o.motorista_id
    WHERE o.data_ocorrencia::date BETWEEN p_inicio AND p_fim
      AND o.motorista_id IS NOT NULL
  ),
  km AS (
    SELECT
      mv.motorista_id,
      SUM(GREATEST(sub.km_percorrido, 0)) AS km_total
    FROM motorista_veiculos mv
    JOIN LATERAL (
      SELECT MAX(hodometro) - MIN(hodometro) AS km_percorrido
      FROM tel_posicoes
      WHERE veiculo_id = mv.veiculo_id
        AND hodometro IS NOT NULL
        AND cobli_ts::date BETWEEN p_inicio AND p_fim
    ) sub ON true
    GROUP BY mv.motorista_id
  )
  SELECT
    oc.motorista_id,
    COALESCE(u.raw_user_meta_data->>'nome', u.email, 'Desconhecido') AS nome,
    oc.total_ocorrencias,
    CASE
      WHEN COALESCE(km.km_total, 0) > 0
      THEN ROUND(((oc.total_ocorrencias * 1000.0) / km.km_total)::numeric, 2)
      ELSE 0
    END AS ocorrencias_por_1000km
  FROM oc
  LEFT JOIN auth.users u ON u.id = oc.motorista_id
  LEFT JOIN km ON km.motorista_id = oc.motorista_id
  ORDER BY ocorrencias_por_1000km DESC;
$$;
