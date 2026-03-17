BEGIN;

UPDATE public.cmp_categorias
SET ativo = false
WHERE codigo IN (
  'MATERIAIS_OBRA',
  'EPI_EPC',
  'FERRAMENTAL',
  'CENTRO_DIST',
  'AQUISICOES_ESP',
  'FROTA_EQUIP',
  'SERVICOS',
  'LOCACAO',
  'MOBILIZACAO',
  'ALOJAMENTO',
  'ALIMENTACAO',
  'ESCRITORIO'
);

INSERT INTO public.cmp_categorias (
  codigo, nome, comprador_nome, alcada1_aprovador, alcada1_limite,
  cotacoes_regras, politica_resumo, cor, icone, keywords, ativo
)
VALUES
  ('ACO', 'Aco', 'Lauany', 'Welton', 3000, '{"ate_500":4,"501_a_2k":4,"acima_2k":4}', '4+ cotacoes. Preferencia por fabrica. Engenheiro define bitolas e quantidades. Entrega pelo fornecedor.', '#64748b', 'Building2', ARRAY['aco','ferro','vergalhao','ca-50','ca-60','bitola','bobina'], true),
  ('CONCRETO', 'Concreto', 'Lauany', 'Welton', 3000, '{"ate_500":4,"501_a_2k":4,"acima_2k":4}', '4+ cotacoes. Concreteira com laboratorio proprio. Informar volume, fck e uso de bomba. Sempre cotar retirada e entrega.', '#0f766e', 'Building2', ARRAY['concreto','concreteira','fck','m3','bomba','corpo de prova','cp'], true),
  ('OUTROS_MAT_OBRA', 'Outros Materiais de Obra', 'Lauany', 'Welton', 3000, '{"ate_500":3,"501_a_2k":3,"acima_2k":3}', '3 cotacoes. Recorrentes: 5 referencias a cada 3 meses. Pedido mensal pelo CD e compra por demanda da obra.', '#7c3aed', 'Package', ARRAY['material','obra','cimento','brita','areia','argamassa','tubo','construcao'], true),
  ('EQUIPAMENTOS', 'Equipamentos', 'Lauany', 'Welton', 3000, '{"ate_500":3,"501_a_2k":3,"acima_2k":3}', '3+ cotacoes e analise compra vs locacao. Laudo tecnico obrigatorio. Equipamento comprado recebe tombamento antes do uso.', '#0369a1', 'Wrench', ARRAY['equipamento','locacao','compra','vistoria','laudo','cemig','maquina'], true),
  ('FERRAMENTAS', 'Ferramentas', 'Lauany', 'Welton', 3000, '{"ate_500":2,"501_a_2k":2,"acima_2k":2}', '2 cotacoes para manutencao. Recorrentes: 5 referencias. Pedido mensal pelo CD. Locacao somente com autorizacao da diretoria.', '#ea580c', 'Wrench', ARRAY['ferramenta','alicate','marreta','furadeira','esmerilhadeira','manutencao'], true),
  ('EPI_EPC_UNIFORME', 'EPI / EPC / Uniforme', 'Lauany', 'Welton', 3000, '{"ate_500":3,"501_a_2k":3,"acima_2k":3}', '3 cotacoes. Recorrentes: 5 referencias. Somente CA valido e padrao de uniforme por funcao. Pedido mensal pelo CD.', '#dc2626', 'ShieldCheck', ARRAY['epi','epc','uniforme','ca','capacete','luva','bota','antichama'], true),
  ('ALIMENTACAO_CANTEIRO', 'Alimentacao', 'Aline', 'Welton', 3000, '{"ate_500":3,"501_a_2k":3,"acima_2k":3}', '3 orcamentos. Recorrentes: 5 referencias. Fornecedor unico preferencial. Alvara sanitario obrigatorio e contrato pelo periodo da obra.', '#f97316', 'Utensils', ARRAY['alimentacao','restaurante','padaria','marmita','almoco','jantar','cafe'], true),
  ('ITENS_ALOJAMENTO', 'Itens de Alojamento', 'Aline', 'Welton', 3000, '{"ate_500":2,"501_a_2k":2,"acima_2k":2}', '2 orcamentos para manutencao. Solicitacao com relatorio fotografico do prefeito ou almoxarife.', '#059669', 'Home', ARRAY['alojamento','movel','eletrodomestico','colchao','cama','geladeira','conforto'], true),
  ('PRODUTOS_LIMPEZA', 'Produtos de Limpeza', 'Aline', 'Welton', 3000, '{"ate_500":3,"501_a_2k":3,"acima_2k":3}', '3 cotacoes. Recorrentes: 5 referencias. Somente distribuidoras e lista padronizada. Pedido mensal consolidado pelo CD.', '#0ea5e9', 'Package', ARRAY['limpeza','desinfetante','sabao','papel higienico','agua sanitaria','distribuidora'], true),
  ('LOCACAO_IMOVEIS', 'Locacao de Imoveis', 'Aline', 'Laucidio', 0, '{"ate_500":5,"501_a_2k":5,"acima_2k":5}', 'Minimo de 5 imoveis visitados. Equipe de mobilizacao busca e vistoria com relatorio fotografico. Contratacao somente com aprovacao do Laucidio.', '#16a34a', 'Home', ARRAY['locacao','imovel','casa','apartamento','kitnet','aluguel','canteiro'], true),
  ('SERV_OBRA_LOG', 'Servicos de Obra e Logistica', 'Fernando', 'Welton', 3000, '{"ate_500":3,"501_a_2k":3,"acima_2k":3}', '3 cotacoes. Recorrentes: 5 referencias. Servicos especializados somente com homologados CEMIG e contrato formal antes do inicio.', '#2563eb', 'Truck', ARRAY['servico','obra','logistica','frete','guindaste','munck','opgw','terceirizado'], true),
  ('MAT_ESCRITORIO_CD', 'Mat. Escritorio / CD', 'Aline', 'Welton', 3000, '{"ate_500":2,"501_a_2k":2,"acima_2k":2}', '2 cotacoes. Recorrentes: 5 referencias. Pedido mensal consolidado pelo CD e compra em distribuidoras.', '#6366f1', 'Package', ARRAY['escritorio','cd','papelaria','toner','almoxarifado','expediente'], true),
  ('MANUT_FROTA', 'Manutencao Frotas e Maquinas', 'Fernando', 'Welton', 3000, '{"ate_500":2,"501_a_2k":2,"acima_2k":2}', '2 orcamentos para manutencao. Oficinas revisadas a cada 3 meses. Preventiva por calendario e corretiva com relatorio fotografico.', '#f59e0b', 'Car', ARRAY['frota','maquina','manutencao','oficina','motorista','km','horimetro'], true),
  ('AQUISICAO_ATIVOS', 'Aquisicao de Ativos', 'Fernando', 'Laucidio', 0, '{"ate_500":5,"501_a_2k":5,"acima_2k":5}', '5+ cotacoes. Mapa de cotacao obrigatorio e aprovacao sempre da diretoria. Tombamento patrimonial antes da entrega.', '#0f766e', 'ShoppingBag', ARRAY['ativo','patrimonio','tombamento','leasing','tco','numero de serie'], true),
  ('SERV_ADMIN', 'Servicos Administrativos', 'Leandro', 'Leandro', 3000, '{"ate_500":2,"501_a_2k":2,"acima_2k":2}', '2 orcamentos. Manutencao predial e demandas administrativas com relatorio fotografico e preferencia por fornecedores cadastrados.', '#64748b', 'Briefcase', ARRAY['administrativo','predial','jardinagem','dedetizacao','limpeza caixa dagua','moveis'], true),
  ('SOFTWARE_HARDWARE_TI', 'Software e Hardware - TI', 'Leandro', 'Leandro', 3000, '{"ate_500":2,"501_a_2k":2,"acima_2k":2}', '2 cotacoes em qualquer valor. Validacao de TI antes da cotacao. Licencas revisadas anualmente. Aprovacao tecnica segue para diretoria.', '#1d4ed8', 'Monitor', ARRAY['software','hardware','licenca','ti','notebook','monitor','impressora','sistema'], true),
  ('MAT_ESCRITORIO_SEDE', 'Mat. Escritorio - Sede', 'Leandro', 'Leandro', 3000, '{"ate_500":2,"501_a_2k":2,"acima_2k":2}', '2 cotacoes. Recorrentes: 5 referencias. Pedido mensal consolidado pela sede e compra em distribuidoras.', '#7c3aed', 'Monitor', ARRAY['escritorio','sede','papelaria','expediente','toner','caneta'], true),
  ('COMPRAS_EXTRA', 'Compras Extraordinarias', 'Lauany', 'Laucidio', 0, '{"ate_500":2,"501_a_2k":2,"acima_2k":2}', '2+ cotacoes quando viavel. Demandas pontuais direcionadas pela diretoria, com justificativa obrigatoria e aprovacao sempre do Laucidio.', '#dc2626', 'ShoppingBag', ARRAY['extraordinario','pontual','diretoria','nao categorizado','urgente especial'], true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  comprador_nome = EXCLUDED.comprador_nome,
  alcada1_aprovador = EXCLUDED.alcada1_aprovador,
  alcada1_limite = EXCLUDED.alcada1_limite,
  cotacoes_regras = EXCLUDED.cotacoes_regras,
  politica_resumo = EXCLUDED.politica_resumo,
  cor = EXCLUDED.cor,
  icone = EXCLUDED.icone,
  keywords = EXCLUDED.keywords,
  ativo = EXCLUDED.ativo;

INSERT INTO public.cmp_compradores (nome, email, telefone, categorias, ativo)
VALUES
  ('Lauany', 'lauany@teguniao.com.br', NULL, ARRAY['ACO','CONCRETO','OUTROS_MAT_OBRA','EQUIPAMENTOS','FERRAMENTAS','EPI_EPC_UNIFORME','COMPRAS_EXTRA'], true),
  ('Fernando', 'fernando@teguniao.com.br', NULL, ARRAY['SERV_OBRA_LOG','MANUT_FROTA','AQUISICAO_ATIVOS'], true),
  ('Aline', 'aline@teguniao.com.br', NULL, ARRAY['ALIMENTACAO_CANTEIRO','ITENS_ALOJAMENTO','PRODUTOS_LIMPEZA','LOCACAO_IMOVEIS','MAT_ESCRITORIO_CD'], true),
  ('Leandro', 'leandro@teguniao.com.br', NULL, ARRAY['SERV_ADMIN','SOFTWARE_HARDWARE_TI','MAT_ESCRITORIO_SEDE'], true)
ON CONFLICT (email) DO UPDATE SET
  nome = EXCLUDED.nome,
  categorias = EXCLUDED.categorias,
  ativo = EXCLUDED.ativo;

COMMIT;
