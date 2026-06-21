-- 155_cmp_corrige_parcela_revisar_manualmente.sql
-- Backfill: troca a descricao "Revisar manualmente" em parcelas de pedidos ja
-- emitidos e nas contas a pagar correspondentes pelo rotulo padrao
-- "Parcela N/M" (ou "Parcela unica" quando ha so uma parcela).
--
-- Motivacao: gerarPreviaParcelas caia no fallback "Revisar manualmente" quando
-- a condicao de pagamento nao era interpretavel (ex.: "25"), e isso aparecia
-- no PDF do pedido e na descricao do CP.

-- 1) cmp_pedidos.parcelas_preview (JSONB) — troca descricao dentro do array
WITH alvo AS (
  SELECT p.id, p.parcelas_preview
  FROM cmp_pedidos p
  WHERE p.parcelas_preview IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p.parcelas_preview) parc
      WHERE LOWER(TRIM(COALESCE(parc->>'descricao',''))) = 'revisar manualmente'
    )
),
recalc AS (
  SELECT
    a.id,
    jsonb_agg(
      CASE
        WHEN LOWER(TRIM(COALESCE(parc->>'descricao',''))) = 'revisar manualmente' THEN
          parc || jsonb_build_object(
            'descricao',
            CASE
              WHEN jsonb_array_length(a.parcelas_preview) = 1 THEN 'Parcela única'
              ELSE 'Parcela ' || (parc->>'numero') || '/' || jsonb_array_length(a.parcelas_preview)::text
            END
          )
        ELSE parc
      END
      ORDER BY (parc->>'numero')::int
    ) AS novas
  FROM alvo a, jsonb_array_elements(a.parcelas_preview) parc
  GROUP BY a.id, a.parcelas_preview
)
UPDATE cmp_pedidos p
SET parcelas_preview = r.novas
FROM recalc r
WHERE p.id = r.id;

-- 2) fin_contas_pagar.descricao — substitui "Revisar manualmente" por rotulo
-- baseado na ordem de vencimento da parcela dentro do pedido.
-- Importante: fin_contas_pagar nao tem coluna numero_parcela; usamos
-- ROW_NUMBER por pedido_id ordenado por (data_vencimento, id) para inferir
-- N e o total M.
WITH numerada AS (
  SELECT
    cp.id,
    ROW_NUMBER() OVER (PARTITION BY cp.pedido_id ORDER BY cp.data_vencimento, cp.id) AS n,
    COUNT(*)   OVER (PARTITION BY cp.pedido_id) AS total
  FROM fin_contas_pagar cp
  WHERE cp.descricao ILIKE '%Revisar manualmente%'
    AND cp.status <> 'pago'
)
UPDATE fin_contas_pagar cp
SET descricao = REGEXP_REPLACE(
  cp.descricao,
  'Revisar manualmente',
  CASE
    WHEN n.total <= 1 THEN 'Parcela única'
    ELSE 'Parcela ' || n.n::text || '/' || n.total::text
  END,
  'gi'
)
FROM numerada n
WHERE cp.id = n.id;
