-- 209_depara_codigo_legado_busca.sql
-- A mig 200 trocou o plano CLS-* pelo plano RM e migrou os VÍNCULOS pelo
-- de/para, mas as naturezas do RM ficaram sem registro de qual código antigo
-- elas substituíram. Resultado: quem digita o código velho ("02.09.02") não
-- acha nada no seletor.
-- Aqui o de/para é carimbado em codigo_legado das naturezas RM de destino
-- (lista separada por vírgula quando mais de um código antigo caiu no mesmo),
-- para o seletor buscar também pelo código antigo.

WITH depara(antigo, novo) AS (
  VALUES
    ('02.06.04', '2.03.018'), ('02.05.02', '2.03.003'), ('03.03.05', '2.03.003'),
    ('02.05.04', '2.01.012'), ('02.05.03', '2.08.036'), ('02.09.02', '2.03.030'),
    ('03.06.03', '2.03.032'), ('03.03.01', '2.03.005'), ('02.05.01', '2.03.003'),
    ('03.03.04', '2.03.003'), ('02.07.02', '2.08.035'), ('03.06.04', '2.03.032'),
    ('02.06.03', '2.03.017'), ('02.04.01', '2.01.003'), ('02.01.02', '2.05.003'),
    ('03.06.01', '2.03.027'), ('02.09.01', '2.03.030'), ('02.04.02', '2.01.004'),
    ('03.01.03', '2.03.030'), ('02.06.01', '2.03.014'), ('03.02.07', '2.03.018'),
    ('03.01.02', '2.03.002'), ('02.01.01', '2.01.001'), ('06.03.09', '1.02.002')
), agrupado AS (
  SELECT novo, string_agg(antigo, ', ' ORDER BY antigo) AS antigos
  FROM depara GROUP BY novo
)
UPDATE public.fin_classes_financeiras c
SET codigo_legado = CASE
      WHEN c.codigo_legado IS NULL OR c.codigo_legado = '' THEN a.antigos
      ELSE c.codigo_legado || ', ' || a.antigos
    END,
    updated_at = now()
FROM agrupado a
WHERE c.codigo = a.novo
  AND (c.codigo_legado IS NULL OR c.codigo_legado NOT LIKE '%' || a.antigos || '%');
