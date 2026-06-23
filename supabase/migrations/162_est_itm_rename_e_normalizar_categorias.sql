-- 162_est_itm_rename_e_normalizar_categorias.sql
-- Continuacao da mig 161: aplica o mesmo padrao 01.NN.NNNN aos itens
-- legados ITM-XXXXXXXX (importados via Omie/cadastros antigos) e
-- consolida categorias duplicadas (com/sem acento, UPPER/lower).
--
-- (1) Renomeia 223 ITM-* via est_classificar_descricao + est_proximo_codigo,
--     atualizando tambem a copia textual em cmp_requisicao_itens.est_item_codigo.
-- (2) Reconfere categoria de TODOS os itens 01.NN.NNNN pelo prefixo do codigo
--     (canoniza qualquer categoria estranha que estava nesses itens).
-- (3) Mapeamento direto para itens com codigo fora do padrao 01.NN.NNNN:
--     Frotas/FROTAS -> PECAS PARA MANUTENCAO, Sistemas -> TI, etc.

-- (1) Renomeia 223 ITM-*
DO $$
DECLARE
  r RECORD;
  v_prefixo text;
  v_codigo_novo text;
  v_categoria_nova text;
  v_codigo_antigo text;
BEGIN
  FOR r IN SELECT id, codigo, descricao FROM est_itens
           WHERE codigo ILIKE 'ITM%' ORDER BY criado_em ASC
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
    UPDATE cmp_requisicao_itens SET est_item_codigo = v_codigo_novo
    WHERE est_item_codigo = v_codigo_antigo;
  END LOOP;
END;
$$;

-- (2) Canoniza categoria por prefixo do codigo (so para 01.NN.NNNN)
UPDATE est_itens SET categoria = CASE substring(codigo from 1 for 5)
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
  WHEN '01.11' THEN 'IMOBILIZADO'
  WHEN '02.01' THEN 'SERVICOS DE OBRA E LOGISTICA'
  WHEN '02.02' THEN 'SERVICOS DE OBRA E LOGISTICA'
  ELSE categoria END
WHERE codigo ~ '^\d{2}\.\d{2}\.\d{4}$'
  AND categoria IN (
    'Insumos e Materiais','Materiais de Escritório e Uso','Frotas e Veículos (Operacional)',
    'MATERIAIS DE ESCRITORIO E USO','INSUMOS E MATERIAIS','FROTAS E VEICULOS (OPERACIONAL)',
    'Sistemas e Tecnologia','Locação de Equipamentos','SERVICOS DE TERCEIROS','SOFTWARE E SISTEMAS',
    'ESCRITORIO','ALMOXARIFADO GERAL','LUVAS EPI','SISTEMAS E TECNOLOGIA','FOLHA DE PAGAMENTO',
    'HONORARIOS PROFISSIONAIS','CALCADO SEGURANCA','ELETRICO','ELETRONICO','CAPACETE SEGURANCA','GERAL'
  );

-- (3) Mapeamento direto para itens fora do padrao
UPDATE est_itens SET categoria='MATERIAL DE ESCRITORIO' WHERE categoria IN ('Materiais de Escritório e Uso','MATERIAIS DE ESCRITORIO E USO','ESCRITORIO');
UPDATE est_itens SET categoria='PECAS PARA MANUTENCAO' WHERE categoria IN ('Frotas e Veículos (Operacional)','FROTAS E VEICULOS (OPERACIONAL)');
UPDATE est_itens SET categoria='TI' WHERE categoria IN ('Sistemas e Tecnologia','SISTEMAS E TECNOLOGIA','SOFTWARE E SISTEMAS');
UPDATE est_itens SET categoria='SERVICOS DE OBRA E LOGISTICA' WHERE categoria IN ('SERVICOS DE TERCEIROS','Locação de Equipamentos');
UPDATE est_itens SET categoria='EPI/EPC' WHERE categoria IN ('LUVAS EPI','CALCADO SEGURANCA','CAPACETE SEGURANCA');
UPDATE est_itens SET categoria='MATERIAL ELETRICO' WHERE categoria IN ('ELETRICO','ELETRONICO');
UPDATE est_itens SET categoria='USO E CONSUMO' WHERE categoria IN ('ALMOXARIFADO GERAL','GERAL','FOLHA DE PAGAMENTO','HONORARIOS PROFISSIONAIS');
UPDATE est_itens SET categoria='INSUMOS E MATERIAIS' WHERE categoria='Insumos e Materiais';
