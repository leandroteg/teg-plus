-- 200_classes_financeiras_rm.sql
-- Adota o plano de Naturezas Orçamentárias do Totvs RM como Classes Financeiras (decisão controladoria 03/ago/2026).
-- Rótulo na UI permanece "Classe Financeira". Códigos passam a ser os do RM (G.SS.III).
-- Classes CLS-* antigas: as em uso são REMAPEADAS (vínculos migrados), extensões TEG+ recodificadas (.9xx), demais desativadas.
-- Sintéticas do RM entram ativo=false (hierarquia/consulta, fora dos seletores).

ALTER TABLE public.fin_classes_financeiras
  ADD COLUMN IF NOT EXISTS codigo_legado text,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'teg',
  ADD COLUMN IF NOT EXISTS gera_estoque boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.fin_classes_financeiras.origem IS 'rm = importada do plano Totvs RM; teg_ext = extensão TEG+ (competência); teg = legado pré-RM';
COMMENT ON COLUMN public.fin_classes_financeiras.gera_estoque IS 'Pedido Direto: true = destino default Estoque (substitui a regra de prefixo 01/02)';

-- ── Plano RM ──
INSERT INTO public.fin_classes_financeiras (codigo, descricao, tipo, ativo, origem, gera_estoque) VALUES
  ('1', 'FATURAMENTO LIQUIDO', 'receita', false, 'rm', false),
  ('1.01', 'FATURAMENTO', 'receita', false, 'rm', false),
  ('1.01.001', 'FATURAMENTO LIQUIDO', 'receita', true, 'rm', false),
  ('1.01.002', 'HISTÓRICO FINANCEIRO', 'receita', true, 'rm', false),
  ('1.02', 'RECEITA FINANCEIRA', 'receita', false, 'rm', false),
  ('1.02.001', 'RECEITA APLICAÇÃO FINANCEIRA', 'receita', true, 'rm', false),
  ('1.02.002', 'ESTORNO/DEVOLUÇÕES', 'receita', true, 'rm', false),
  ('1.02.003', 'OPERAÇÃO CAPITAL DE GIRO', 'receita', true, 'rm', false),
  ('1.02.004', 'OPERAÇÃO ROTATIVO', 'receita', true, 'rm', false),
  ('1.03', 'APORTE FINANCEIRA', 'receita', false, 'rm', false),
  ('1.03.001', 'APORTES TERCEIROS', 'receita', true, 'rm', false),
  ('1.03.002', 'RECEITA RENTABILIZACAO', 'receita', true, 'rm', false),
  ('1.03.003', 'APORTE FINANCEIRA', 'receita', true, 'rm', false),
  ('1.03.004', 'APORTES DE CAPITAL SOCIOS', 'receita', true, 'rm', false),
  ('1.04', 'ARRECADAÇÃO OUTROS', 'receita', false, 'rm', false),
  ('1.04.001', 'DESCONTOS RECEBIDOS', 'receita', true, 'rm', false),
  ('1.04.002', 'RECEITA DE CONSÓRCIOS', 'receita', true, 'rm', false),
  ('1.04.003', 'REEMBOLSOS', 'receita', true, 'rm', false),
  ('2', 'CUSTO TOTAL', 'despesa', false, 'rm', false),
  ('2.01', 'FOLHA DE PAGAMENTO', 'despesa', false, 'rm', false),
  ('2.01.001', 'SALARIOS/ORDENADOS', 'despesa', true, 'rm', false),
  ('2.01.002', 'MARKETING/PROPAGANDA', 'despesa', true, 'rm', false),
  ('2.01.003', 'ALOJAMENTO', 'despesa', true, 'rm', false),
  ('2.01.004', 'LANCHES/REFEIÇÕES', 'despesa', true, 'rm', false),
  ('2.01.005', 'ADIANTAMENTO SALÁRIOS', 'despesa', true, 'rm', false),
  ('2.01.006', 'DISPONIVEL', 'despesa', true, 'rm', false),
  ('2.01.007', 'CONVÊNIOS/BENEFICIOS', 'despesa', true, 'rm', false),
  ('2.01.008', '13º SALÁRIO', 'despesa', true, 'rm', false),
  ('2.01.009', 'AJUDA DE CUSTO/REEMBOLSO', 'despesa', true, 'rm', false),
  ('2.01.010', 'RESCISÕES', 'despesa', true, 'rm', false),
  ('2.01.011', 'DESCONTO EM FOLHA', 'despesa', true, 'rm', false),
  ('2.01.012', 'EPI´S / EQUIPAMENTOS DE SEGURANÇA', 'despesa', true, 'rm', true),
  ('2.01.013', 'EXAMES MEDICOS / LAUDOS TECNICOS', 'despesa', true, 'rm', false),
  ('2.01.014', 'FÉRIAS E 1/3 SOBRE FÉRIAS', 'despesa', true, 'rm', false),
  ('2.01.015', 'HOSPEDAGEM', 'despesa', true, 'rm', false),
  ('2.01.016', 'VALE TRANSPORTE', 'despesa', true, 'rm', false),
  ('2.01.017', 'PENSÃO ALIMENTICIA', 'despesa', true, 'rm', false),
  ('2.01.018', 'RATEIO/REPASSES (PENDENTES)', 'despesa', true, 'rm', false),
  ('2.01.019', 'UNIFORMES', 'despesa', true, 'rm', false),
  ('2.01.020', 'SEGURO VIDA', 'despesa', true, 'rm', false),
  ('2.01.021', 'EMPRESTIMO CONSIGNADO', 'despesa', true, 'rm', false),
  ('2.01.022', 'FOLGA/ACORDO COLETIVO', 'despesa', true, 'rm', false),
  ('2.01.023', 'PRO-LABORE', 'despesa', true, 'rm', false),
  ('2.02', 'IMPOSTOS FOPAG', 'despesa', false, 'rm', false),
  ('2.02.001', 'INSS FOPAG -1138', 'despesa', true, 'rm', false),
  ('2.02.002', 'INSS FOPAG - FUNC -1082', 'despesa', true, 'rm', false),
  ('2.02.003', 'RAT -PATRONAL - 1646', 'despesa', true, 'rm', false),
  ('2.02.004', 'GRRF - RESCISÃO', 'despesa', true, 'rm', false),
  ('2.02.005', 'IRRF - FOPAG - 0561-1162', 'despesa', true, 'rm', false),
  ('2.02.006', 'INSS/IRRPF - PJ (RETENÇÃO)', 'despesa', true, 'rm', false),
  ('2.02.007', 'CP TERCEIROS FOPAG -1170-1176-1181-1184-1200', 'despesa', true, 'rm', false),
  ('2.02.008', 'FGTS - FOPAG', 'despesa', true, 'rm', false),
  ('2.02.009', 'CP SEGURADOS IND. - FOPAG 1099', 'despesa', true, 'rm', false),
  ('2.02.010', 'IRRF PREST. PJ - FOPAG - 1708', 'despesa', true, 'rm', false),
  ('2.02.011', 'RET. CONTR. PJ - FOPAG - 5952 - 8045', 'despesa', true, 'rm', false),
  ('2.03', 'CUSTOS INDIRETOS', 'despesa', false, 'rm', false),
  ('2.03.001', 'HONORÁRIOS CONTABEIS', 'despesa', true, 'rm', false),
  ('2.03.002', 'HONORÁRIOS ADVOCATICIOS', 'despesa', true, 'rm', false),
  ('2.03.003', 'INSUMOS / MATERIAIS', 'despesa', true, 'rm', true),
  ('2.03.004', 'MATERIAL COPA E COZINHA', 'despesa', true, 'rm', true),
  ('2.03.005', 'MATERIAL DE ESCRITORIO', 'despesa', true, 'rm', true),
  ('2.03.006', 'SEGUROS OBRAS', 'despesa', true, 'rm', false),
  ('2.03.007', 'SEGUROS VEICULOS', 'despesa', true, 'rm', false),
  ('2.03.008', 'SEGUROS ESCRITORIO', 'despesa', true, 'rm', false),
  ('2.03.009', 'AGUA - OP', 'despesa', true, 'rm', false),
  ('2.03.010', 'ENERGIA - OP', 'despesa', true, 'rm', false),
  ('2.03.011', 'ENERGIA - ADM', 'despesa', true, 'rm', false),
  ('2.03.012', 'AGUA - ADM', 'despesa', true, 'rm', false),
  ('2.03.013', 'CERTIFICADO DIGITAL', 'despesa', true, 'rm', false),
  ('2.03.014', 'COMBUSTIVEL/LUBRIFICANTES', 'despesa', true, 'rm', false),
  ('2.03.015', 'LOCAÇÃO VEICULOS', 'despesa', true, 'rm', false),
  ('2.03.016', 'LOCAÇÃO EQUIPAMENTOS', 'despesa', true, 'rm', false),
  ('2.03.017', 'MANUTENÇÃO VEICULOS', 'despesa', true, 'rm', false),
  ('2.03.018', 'MANUTENÇÃO MAQ EQUIPAMENTOS', 'despesa', true, 'rm', false),
  ('2.03.019', 'HISTÓRICO FINANCEIRO', 'despesa', true, 'rm', false),
  ('2.03.020', 'IPVA', 'despesa', true, 'rm', false),
  ('2.03.021', 'PEDÁGIO', 'despesa', true, 'rm', false),
  ('2.03.022', 'TRANSPORTES/TRANSLADO', 'despesa', true, 'rm', false),
  ('2.03.023', 'CURSOS/TREINAMENTOS', 'despesa', true, 'rm', false),
  ('2.03.024', 'INTERNET', 'despesa', true, 'rm', false),
  ('2.03.025', 'TELEFONIA', 'despesa', true, 'rm', false),
  ('2.03.026', 'MONITORAMENTO / ALARME', 'despesa', true, 'rm', false),
  ('2.03.027', 'SOFTWARE / SISTEMAS', 'despesa', true, 'rm', false),
  ('2.03.028', 'SISTEMA TOTVS', 'despesa', true, 'rm', false),
  ('2.03.029', 'TAXAS E CONTRIBUIÇÕES', 'despesa', true, 'rm', false),
  ('2.03.030', 'SERVIÇOS TERCEIROS', 'despesa', true, 'rm', false),
  ('2.03.031', 'ALUGUEL - ADM E OPERACIONAL', 'despesa', true, 'rm', false),
  ('2.03.032', 'MATERIAL DE INFORMÁTICA', 'despesa', true, 'rm', true),
  ('2.03.033', 'IPTU', 'despesa', true, 'rm', false),
  ('2.03.034', 'MATERIAL DE FARMACIA/PRIMEIROS SOCORROS', 'despesa', true, 'rm', true),
  ('2.03.035', 'LICENCIAMENTO', 'despesa', true, 'rm', false),
  ('2.03.036', 'ART', 'despesa', true, 'rm', false),
  ('2.03.037', 'ADIANTAMENTO A FORNECEDOR', 'despesa', true, 'rm', false),
  ('2.03.038', 'INDENIZACOES/ASSISTENCIAS - EXTRAORDINARIAS', 'despesa', true, 'rm', false),
  ('2.04', 'ANTECIPAÇÃO RESULTADOS SOCIOS', 'despesa', false, 'rm', false),
  ('2.04.002', 'LAUCIDIO', 'despesa', true, 'rm', false),
  ('2.04.003', 'OUTROS', 'despesa', true, 'rm', false),
  ('2.05', 'BRINDES/TREINAMENTO/PRODUTIVIDADE', 'despesa', false, 'rm', false),
  ('2.05.001', 'BRINDES', 'despesa', true, 'rm', false),
  ('2.05.002', 'TREINAMENTO', 'despesa', true, 'rm', false),
  ('2.05.003', 'PRODUTIVIDADE', 'despesa', true, 'rm', false),
  ('2.06', 'EMPRESTIMOS', 'despesa', false, 'rm', false),
  ('2.06.001', 'CAPITAL GIRO - SICREDI C50631003', 'despesa', true, 'rm', false),
  ('2.06.002', 'CAPITAL GIRO - SICREDI C50631454', 'despesa', true, 'rm', false),
  ('2.06.003', 'CAPITAL GIRO -SICREDI C408224505', 'despesa', true, 'rm', false),
  ('2.06.004', 'CAPITAL GIRO -SICREDI (13º) C308238628', 'despesa', true, 'rm', false),
  ('2.06.005', 'CAPITAL GIRO - BANCO DO BRASIL C580710835', 'despesa', true, 'rm', false),
  ('2.06.006', 'INVESTIMENTO EMPRESARIAL SICREDI C40631279', 'despesa', true, 'rm', false),
  ('2.06.007', 'INVESTIMENTO EMPRESARIAL SICREDI C406300859', 'despesa', true, 'rm', false),
  ('2.06.008', 'INVESTIMENTO PECUNIÁRIO PF SICREDI C406303726', 'despesa', true, 'rm', false),
  ('2.06.009', 'EMPRESTIMO PF- SICREDI 406303726 -MUNCK', 'despesa', true, 'rm', false),
  ('2.06.010', 'FCO BANCO DO BRASIL C580707174', 'despesa', true, 'rm', false),
  ('2.06.011', 'CARTÃO BNDS SICREDI C40623829-0', 'despesa', true, 'rm', false),
  ('2.06.012', 'CARTÃO BNDS SICREDI C40624655-2', 'despesa', true, 'rm', false),
  ('2.06.013', 'EMPRESTIMO PF- SICREDI 406303688 (1/1)', 'despesa', true, 'rm', false),
  ('2.06.014', 'EMPRESTIMO (PF APORTE R$ 4MM)', 'despesa', true, 'rm', false),
  ('2.06.015', 'CAPTAÇÃO APLICAÇÃO FINANCEIRA', 'despesa', true, 'rm', false),
  ('2.06.016', 'FCO BANCO DO BRASIL C580713719', 'despesa', true, 'rm', false),
  ('2.06.017', 'DEVOLUÇÃO APORTES TERCEIROS', 'despesa', true, 'rm', false),
  ('2.07', 'ESTACIONAMENTO', 'despesa', false, 'rm', false),
  ('2.07.001', 'ESTACIONAMENTO', 'despesa', true, 'rm', false),
  ('2.08', 'IMOBILIZADO', 'despesa', false, 'rm', false),
  ('2.08.001', 'VEICULOS PESADOS - SICREDI C306333615', 'despesa', true, 'rm', false),
  ('2.08.002', 'VEICULOS PESADOS - SICREDI C306333631', 'despesa', true, 'rm', false),
  ('2.08.003', 'AQUISIÇÃO BENS (VEICULOS) C308226875', 'despesa', true, 'rm', false),
  ('2.08.004', 'AQUISIÇÃO BENS (VEICULOS) C308224201', 'despesa', true, 'rm', false),
  ('2.08.005', 'AQUISIÇÃO BENS (VEICULOS) C308222276', 'despesa', true, 'rm', false),
  ('2.08.006', 'FINAME (TFB) RETROESCAVADEIRA C306340603', 'despesa', true, 'rm', false),
  ('2.08.007', 'FINAME RETROESCAVADEIRA C406352743', 'despesa', true, 'rm', false),
  ('2.08.008', 'FINAME ÔNIBUS E CAMINHÃO C406306660', 'despesa', true, 'rm', false),
  ('2.08.009', 'FINAME ÔNIBUS E CAMINHÃO C40631011', 'despesa', true, 'rm', false),
  ('2.08.010', 'FINAME BK AQUISIÇÃO VEICULOS C40631160', 'despesa', true, 'rm', false),
  ('2.08.011', 'FINAME MUNCK - BRADESCO C6114208', 'despesa', true, 'rm', false),
  ('2.08.012', 'FINANCIAMENTO CAMINHÕES BBC C300039468-8', 'despesa', true, 'rm', false),
  ('2.08.013', 'CDC HILLUX - BRADESCO C24633411', 'despesa', true, 'rm', false),
  ('2.08.014', 'CDC RETROESCAVADEIRA - BRADESCO C3634416765', 'despesa', true, 'rm', false),
  ('2.08.015', 'AERONAVE', 'despesa', true, 'rm', false),
  ('2.08.016', 'STRADA - MOVIDA RUQ 5G11', 'despesa', true, 'rm', false),
  ('2.08.017', 'STRADA - MOVIDA RUQ 6B41', 'despesa', true, 'rm', false),
  ('2.08.018', 'CONSORCIO SICREDI GRUPO 050125 COTA 0635 CONTRATO 1194623', 'despesa', true, 'rm', false),
  ('2.08.019', 'CONSORCIO SICREDI GRUPO 050130 COTA 0240 CONTRATO 1256000', 'despesa', true, 'rm', false),
  ('2.08.020', 'CONSORCIO BANCO BRASIL - GRUPO 1450 COTA 3569', 'despesa', true, 'rm', false),
  ('2.08.021', 'CONSORCIO B.BRASIL - GRUPO 1291 COTA 9590', 'despesa', true, 'rm', false),
  ('2.08.022', 'CONSORCIO B.BRASIL - GRUPO 1347 COTA 5312', 'despesa', true, 'rm', false),
  ('2.08.023', 'CONSORCIO B.BRASIL - GRUPO 1450 COTA 2417', 'despesa', true, 'rm', false),
  ('2.08.024', 'CONSORCIO B.BRASIL - GRUPO 1347 COTA 3166', 'despesa', true, 'rm', false),
  ('2.08.025', 'CONSORCIO B.BRASIL - GRUPO 1584 COTA 1705', 'despesa', true, 'rm', false),
  ('2.08.026', 'CONSORCIO B.BRASIL - GRUPO 1405 COTA 6326', 'despesa', true, 'rm', false),
  ('2.08.027', 'CONSORCIO B.BRASIL - GRUPO 1584 COTA 5762', 'despesa', true, 'rm', false),
  ('2.08.028', 'CONSORCIO B.BRASIL - GRUPO 1450 COTA 958', 'despesa', true, 'rm', false),
  ('2.08.029', 'CONSORCIO B.BRASIL - GRUPO 1347 COTA 9224', 'despesa', true, 'rm', false),
  ('2.08.030', 'CONSORCIO B.BRASIL - GRUPO 1450 COTA 1123', 'despesa', true, 'rm', false),
  ('2.08.031', 'CONSORCIO B.BRASIL - GRUPO 1584 COTA 5711', 'despesa', true, 'rm', false),
  ('2.08.032', 'CONSORCIO B.BRASIL - GRUPO 1450 COTA 9249', 'despesa', true, 'rm', false),
  ('2.08.033', 'PROCAPCREDI SICREDI - C300105392', 'despesa', true, 'rm', false),
  ('2.08.034', 'EQUIPAMENTO (RTK- N9A70)', 'despesa', true, 'rm', false),
  ('2.08.035', 'AQUISIÇÃO DE EQUIPAMENTOS', 'despesa', true, 'rm', true),
  ('2.08.036', 'FERRAMENTAL', 'despesa', true, 'rm', true),
  ('2.08.037', 'AQUISIÇÃO BENS (VEICULOS) C50631481-9', 'despesa', true, 'rm', false),
  ('2.08.038', 'AQUISIÇÃO BENS (VEICULOS) C50631486-0', 'despesa', true, 'rm', false),
  ('2.08.039', 'AQUISIÇÃO BENS (VEICULOS) C50631478-9', 'despesa', true, 'rm', false),
  ('2.08.040', 'AQUISIÇÃO BENS (VEICULOS) C506315157', 'despesa', true, 'rm', false),
  ('2.08.041', 'PROCAPCREDI SICREDI - C506314096', 'despesa', true, 'rm', false),
  ('2.08.042', 'AQUISIÇÃO BENS (VEICULOS) CAMINHAO NOVO 1', 'despesa', true, 'rm', false),
  ('2.08.043', 'AQUISIÇÃO BENS (VEICULOS) CAMINHAO NOVO 2', 'despesa', true, 'rm', false),
  ('2.08.044', 'AQUISIÇÃO BENS (VEICULOS) CAMINHAO NOVO 3', 'despesa', true, 'rm', false),
  ('2.08.045', 'AQUISIÇÃO BENS (VEICULOS) CAMINHAO NOVO 4', 'despesa', true, 'rm', false),
  ('2.08.046', 'AQUISIÇÃO BENS (VEICULOS) CAMINHAO NOVO 5', 'despesa', true, 'rm', false),
  ('2.08.047', 'AQUISIÇÃO BENS (VEICULOS) CAMINHAO NOVO 6', 'despesa', true, 'rm', false),
  ('2.08.048', 'IMOBILIZADO', 'despesa', true, 'rm', false),
  ('2.08.049', 'CONSORCIO B.BRASIL - GRUPO 1755 COTA 7343', 'despesa', true, 'rm', false),
  ('2.08.050', 'CONSORCIO B.BRASIL - GRUPO 1755 COTA 9026', 'despesa', true, 'rm', false),
  ('2.08.051', 'CONSORCIO B. BRASIL - GRUPO 1799 COTA 4290', 'despesa', true, 'rm', false),
  ('2.08.052', 'CONSROCIO B. BRASIL - GRUPO 1799 COTA 1067', 'despesa', true, 'rm', false),
  ('2.08.053', 'CONSROCIO B. BRASIL - GRUPO 1803 COTA 6674', 'despesa', true, 'rm', false),
  ('2.09', 'IMPOSTOS S/ FATURAMENTO-LUCRO', 'despesa', false, 'rm', false),
  ('2.09.001', 'PIS S/ FATURAMENTO', 'despesa', true, 'rm', false),
  ('2.09.002', 'COFINS S/ FATURAMENTO', 'despesa', true, 'rm', false),
  ('2.09.003', 'CSLL - LUCRO - 6012', 'despesa', true, 'rm', false),
  ('2.09.004', 'CSLL RETIDO', 'despesa', true, 'rm', false),
  ('2.09.005', 'ICMS - DIFAL', 'despesa', true, 'rm', false),
  ('2.09.006', 'IRPJ - LUCRO - 3373', 'despesa', true, 'rm', false),
  ('2.09.007', 'SIMPLES NACIONAL', 'despesa', true, 'rm', false),
  ('2.09.008', 'IRRF RETIDO', 'despesa', true, 'rm', false),
  ('2.09.009', 'ISS RETIDO', 'despesa', true, 'rm', false),
  ('2.09.010', 'PIS RETIDO', 'despesa', true, 'rm', false),
  ('2.09.011', 'COFINS RETIDO', 'despesa', true, 'rm', false),
  ('2.09.012', 'IMPOSTOS PARCELAMENTO', 'despesa', true, 'rm', false),
  ('2.10', 'INTEGRALIZAÇÃO DO CAPITAL', 'despesa', false, 'rm', false),
  ('2.10.001', 'DEVOLUÇÃO APORTES SOCIO', 'despesa', true, 'rm', false),
  ('2.10.002', 'DIVIDENDO', 'despesa', true, 'rm', false),
  ('2.10.003', 'INTEGRALIZAÇÃO DO CAPITAL', 'despesa', true, 'rm', false),
  ('2.11', 'PARCELAMENTOS', 'despesa', false, 'rm', false),
  ('2.11.001', 'SIMPLES NACIONAL -1471-1472-1469-1470', 'despesa', true, 'rm', false),
  ('2.11.002', 'IRPJ/CSLL/COFINS/PIS - 1001-1002-1004-1005', 'despesa', true, 'rm', false),
  ('2.11.003', 'PREV INSS - 008136271 - 3202', 'despesa', true, 'rm', false),
  ('2.11.004', 'PREVIDÊNCIARIO -PGN', 'despesa', true, 'rm', false),
  ('2.11.005', 'IRRF - 0049770872.23 - DEBITO AUTOMATICO', 'despesa', true, 'rm', false),
  ('2.11.006', 'IRRF - C006292299 - 0138', 'despesa', true, 'rm', false),
  ('2.11.007', 'SIMPLIFICADO - 0099978117.23 DEBITO AUTOMATICO', 'despesa', true, 'rm', false),
  ('2.11.008', 'SIMPLIFICADO INSS - 00179153255.22 - DEBITO AUTOMATICO', 'despesa', true, 'rm', false),
  ('2.11.009', 'CONTRIB-PREV 10140405061 - DEBITO AUTOMATICO', 'despesa', true, 'rm', false),
  ('2.12', 'JUROS/MORA/DESCONTOS/MULTAS', 'despesa', false, 'rm', false),
  ('2.12.001', 'CUSTAS JUDICIAIS', 'despesa', true, 'rm', false),
  ('2.12.002', 'TARIFAS', 'despesa', true, 'rm', false),
  ('2.12.003', 'JUROS', 'despesa', true, 'rm', false),
  ('2.12.004', 'IOF', 'despesa', true, 'rm', false),
  ('2.12.005', 'MULTAS/ CONTRATUAL', 'despesa', true, 'rm', false),
  ('2.12.006', 'MULTAS/TRÂNSITO', 'despesa', true, 'rm', false),
  ('2.12.007', 'CREDITO ROTATIVO', 'despesa', true, 'rm', false),
  ('2.12.008', 'JUROS CREDITO ROTATIVO', 'despesa', true, 'rm', false),
  ('2.12.009', 'INDENIZACOES', 'despesa', true, 'rm', false),
  ('2.13', 'PERDA/EXTRAVIO', 'despesa', true, 'rm', false),
  ('2.14', 'UNIAO SERVICOS INTEGRADOS LTDA', 'despesa', false, 'rm', false),
  ('2.14.001', 'SERVICOS - UNIAO SERVICOS', 'ambos', true, 'rm', false),
  ('2.15', 'HOLDING ADMINISTRATIVA JL UNIAO', 'despesa', false, 'rm', false),
  ('2.15.001', 'SERVICOS - HOLDING', 'ambos', true, 'rm', false),
  ('3', 'INVESTIMENTO', 'ambos', true, 'rm', false),
  ('4', 'MOVIMENTACOES BANCARIAS', 'ambos', false, 'rm', false),
  ('4.01', 'MOVIMENTACOES BANCARIAS', 'ambos', false, 'rm', false),
  ('4.01.001', 'TRANSFERENCIA ENTRE CONTAS/DISPONIBILIDADE', 'ambos', true, 'rm', false)
ON CONFLICT (codigo) DO UPDATE SET descricao = EXCLUDED.descricao, tipo = EXCLUDED.tipo, ativo = EXCLUDED.ativo, origem = 'rm', gera_estoque = EXCLUDED.gera_estoque;

-- ── Extensões TEG+ (recodifica a própria linha; mantém id e vínculos por id) ──
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '2.03.901', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-02.10.01';
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '1.04.901', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-02.10.02';
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '2.09.901', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-02.10.03';
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '2.09.902', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-02.10.04';
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '2.01.901', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-04.04.01';
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '2.01.902', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-04.04.02';
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '2.01.903', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-04.04.03';
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '2.01.904', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-04.04.04';
UPDATE public.fin_classes_financeiras SET codigo_legado = codigo, codigo = '1.04.902', origem = 'teg_ext', updated_at = now() WHERE codigo = 'CLS-04.05.01';

-- ── De/para dos vínculos existentes (só classes em uso) ──
CREATE TEMP TABLE _depara (antigo text PRIMARY KEY, novo text NOT NULL);
INSERT INTO _depara VALUES
  ('CLS-02.06.04', '2.03.018'),
  ('CLS-02.05.02', '2.03.003'),
  ('CLS-03.03.05', '2.03.003'),
  ('CLS-02.05.04', '2.01.012'),
  ('CLS-02.05.03', '2.08.036'),
  ('CLS-02.09.02', '2.03.030'),
  ('CLS-03.06.03', '2.03.032'),
  ('CLS-03.03.01', '2.03.005'),
  ('CLS-02.05.01', '2.03.003'),
  ('CLS-03.03.04', '2.03.003'),
  ('CLS-02.07.02', '2.08.035'),
  ('CLS-03.06.04', '2.03.032'),
  ('CLS-02.06.03', '2.03.017'),
  ('CLS-02.04.01', '2.01.003'),
  ('CLS-02.01.02', '2.05.003'),
  ('CLS-03.06.01', '2.03.027'),
  ('CLS-02.09.01', '2.03.030'),
  ('CLS-02.04.02', '2.01.004'),
  ('CLS-03.01.03', '2.03.030'),
  ('CLS-02.06.01', '2.03.014'),
  ('CLS-03.02.07', '2.03.018'),
  ('CLS-03.01.02', '2.03.002'),
  ('CLS-02.01.01', '2.01.001'),
  ('CLS-06.03.09', '1.02.002');

-- também remapeia vínculos gravados por DESCRIÇÃO (con_solicitacoes, fin_apontamentos_cartao)
CREATE TEMP TABLE _depara_desc (antiga text PRIMARY KEY, novo text NOT NULL);
INSERT INTO _depara_desc VALUES
  ('Serviços de Terceiros Contratados', '2.03.030'),
  ('PJ - Serviços de Terceiros', '2.03.030'),
  ('Assessoria e Consultoria', '2.03.030'),
  ('Salários e Ordenados', '2.01.001'),
  ('Material Aplicado', '2.03.003'),
  ('(-) Estorno / Devoluções', '1.02.002'),
  ('(-) PIS sobre Compras', '2.09.901');

UPDATE public.est_itens x SET classe_financeira_codigo = d.novo, classe_financeira_id = cf.id, classe_financeira_descricao = cf.descricao
FROM _depara d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira_codigo = d.antigo;
UPDATE public.cmp_requisicao_itens x SET classe_financeira_codigo = d.novo, classe_financeira_id = cf.id, classe_financeira_descricao = cf.descricao
FROM _depara d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira_codigo = d.antigo;
UPDATE public.cmp_requisicoes x SET classe_financeira = d.novo, classe_financeira_id = cf.id
FROM _depara d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira = d.antigo;
UPDATE public.cmp_pedidos x SET classe_financeira = d.novo, classe_financeira_id = cf.id
FROM _depara d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira = d.antigo;
UPDATE public.fin_contas_pagar x SET classe_financeira = d.novo
FROM _depara d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira = d.antigo;
UPDATE public.fin_contas_receber x SET classe_financeira = d.novo
FROM _depara d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira = d.antigo;
UPDATE public.con_contratos x SET classe_financeira = d.novo
FROM _depara d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira = d.antigo;
UPDATE public.desp_adiantamentos x SET classe_financeira = d.novo, classe_financeira_id = cf.id
FROM _depara d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira = d.antigo;

-- vínculos por descrição
UPDATE public.con_solicitacoes x SET classe_financeira = cf.descricao
FROM _depara_desc d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira = d.antiga;
UPDATE public.fin_apontamentos_cartao x SET classe_financeira = cf.descricao
FROM _depara_desc d JOIN public.fin_classes_financeiras cf ON cf.codigo = d.novo
WHERE x.classe_financeira = d.antiga;

-- ── Desativa o plano CLS-* antigo (fica p/ auditoria, some dos seletores) ──
UPDATE public.fin_classes_financeiras
SET ativo = false, codigo_legado = codigo, updated_at = now()
WHERE codigo LIKE 'CLS-%';

DROP TABLE _depara; DROP TABLE _depara_desc;
