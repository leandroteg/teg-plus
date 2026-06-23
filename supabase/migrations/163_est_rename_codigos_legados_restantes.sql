-- 163_est_rename_codigos_legados_restantes.sql
-- Finaliza a normalizacao iniciada nas migs 161/162: pega os 59 itens
-- restantes com prefixos legados (FE, ME, EP, ES, EQ) + ~9 codigos
-- customizados (AGU-, LUV-, teg-6767, etc.) e converte para 01.NN.NNNN.
--
-- Apos esta migration: 100% do catalogo est_itens segue o padrao
-- {01|02}.NN.NNNN sequencial.

DO $$
DECLARE
  r RECORD;
  v_prefixo text;
  v_codigo_novo text;
  v_categoria_nova text;
  v_codigo_antigo text;
BEGIN
  FOR r IN
    SELECT id, codigo, descricao FROM est_itens
    WHERE codigo !~ '^\d{2}\.\d{2}\.\d{4}$'
    ORDER BY criado_em ASC
  LOOP
    v_codigo_antigo := r.codigo;
    v_prefixo := public.est_classificar_descricao(r.descricao);
    v_codigo_novo := public.est_proximo_codigo(v_prefixo);
    v_categoria_nova := CASE v_prefixo
      WHEN '01.01' THEN 'EPI/EPC' WHEN '01.02' THEN 'MATERIAL DE OBRA'
      WHEN '01.03' THEN 'MATERIAL DE ESCRITORIO' WHEN '01.04' THEN 'USO E CONSUMO'
      WHEN '01.05' THEN 'FERRAMENTAL' WHEN '01.06' THEN 'EQUIPAMENTOS'
      WHEN '01.07' THEN 'TI' WHEN '01.08' THEN 'PECAS PARA MANUTENCAO'
      WHEN '01.09' THEN 'FARMACIA E MEDICAMENTOS' WHEN '01.10' THEN 'MAQUINAS E VEICULOS'
      ELSE 'USO E CONSUMO' END;

    UPDATE est_itens SET codigo=v_codigo_novo, categoria=v_categoria_nova WHERE id=r.id;
    UPDATE cmp_requisicao_itens SET est_item_codigo=v_codigo_novo WHERE est_item_codigo=v_codigo_antigo;
  END LOOP;
END;
$$;
