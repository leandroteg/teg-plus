-- loc_imoveis: master property record
CREATE TABLE IF NOT EXISTS loc_imoveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES sys_empresas(id),
  codigo text,
  descricao text NOT NULL,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cep text,
  cidade text,
  uf text,
  area_m2 numeric,
  valor_aluguel_mensal numeric,
  dia_vencimento int,
  locador_nome text,
  locador_cpf_cnpj text,
  locador_contato text,
  centro_custo_id uuid,
  obra_id uuid,
  responsavel_id uuid,
  contrato_id uuid,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','em_entrada','em_saida')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- loc_entradas: entry process
CREATE TABLE IF NOT EXISTS loc_entradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid REFERENCES loc_imoveis(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aguardando_vistoria','aguardando_assinatura','liberado')),
  responsavel_id uuid,
  centro_custo_id uuid,
  obra_id uuid,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cep text,
  cidade text,
  uf text,
  area_m2 numeric,
  valor_aluguel numeric,
  dia_vencimento int,
  locador_nome text,
  locador_cpf_cnpj text,
  locador_contato text,
  data_prevista_inicio date,
  observacoes text,
  contrato_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- loc_saidas: exit process
CREATE TABLE IF NOT EXISTS loc_saidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid REFERENCES loc_imoveis(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aguardando_vistoria','solucionando_pendencias','encerramento_contratual','encerrado')),
  responsavel_id uuid,
  data_aviso date,
  data_limite_saida date,
  caucao_valor numeric,
  caucao_devolvido boolean DEFAULT false,
  valores_em_aberto jsonb DEFAULT '[]',
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- loc_vistorias: inspection records
CREATE TABLE IF NOT EXISTS loc_vistorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid REFERENCES loc_imoveis(id),
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida')),
  entrada_id uuid REFERENCES loc_entradas(id),
  saida_id uuid REFERENCES loc_saidas(id),
  responsavel_id uuid,
  data_vistoria date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida')),
  tem_pendencias boolean DEFAULT false,
  observacoes_gerais text,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- loc_vistoria_itens: checklist items
CREATE TABLE IF NOT EXISTS loc_vistoria_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id uuid REFERENCES loc_vistorias(id) ON DELETE CASCADE,
  ambiente text NOT NULL,
  item text NOT NULL,
  estado_entrada text CHECK (estado_entrada IN ('otimo','bom','regular','ruim','nao_se_aplica')),
  estado_saida text CHECK (estado_saida IN ('otimo','bom','regular','ruim','nao_se_aplica')),
  divergencia boolean DEFAULT false,
  observacao text,
  ordem int DEFAULT 0
);

-- loc_vistoria_fotos
CREATE TABLE IF NOT EXISTS loc_vistoria_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id uuid REFERENCES loc_vistorias(id) ON DELETE CASCADE,
  item_id uuid REFERENCES loc_vistoria_itens(id),
  url text NOT NULL,
  descricao text,
  tipo text CHECK (tipo IN ('entrada','saida')),
  created_at timestamptz DEFAULT now()
);

-- loc_faturas: recurring bills
CREATE TABLE IF NOT EXISTS loc_faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid REFERENCES loc_imoveis(id),
  tipo text NOT NULL CHECK (tipo IN ('energia','agua','internet','iptu','condominio','telefone','limpeza','outro')),
  descricao text,
  competencia date,
  vencimento date,
  valor_previsto numeric,
  valor_confirmado numeric,
  status text NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto','lancado','enviado_pagamento','pago')),
  boleto_url text,
  comprovante_url text,
  recorrente boolean DEFAULT false,
  dia_recorrencia int,
  centro_custo_id uuid,
  obra_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- loc_solicitacoes: service/maintenance requests
CREATE TABLE IF NOT EXISTS loc_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid REFERENCES loc_imoveis(id),
  tipo text NOT NULL CHECK (tipo IN ('servico','manutencao','acordo','renovacao')),
  titulo text NOT NULL,
  descricao text,
  responsavel_id uuid,
  urgencia text DEFAULT 'normal' CHECK (urgencia IN ('baixa','normal','alta','urgente')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_andamento','concluida','cancelada')),
  cmp_requisicao_id uuid,
  con_contrato_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- loc_acordos: agreements
CREATE TABLE IF NOT EXISTS loc_acordos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid REFERENCES loc_imoveis(id),
  titulo text NOT NULL,
  tipo text CHECK (tipo IN ('benfeitoria','abatimento','multa','negociacao','outro')),
  descricao text,
  valor numeric,
  data_acordo date,
  documento_url text,
  responsavel_id uuid,
  created_at timestamptz DEFAULT now()
);

-- loc_aditivos: contract amendments
CREATE TABLE IF NOT EXISTS loc_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id uuid REFERENCES loc_imoveis(id),
  con_contrato_id uuid,
  tipo text CHECK (tipo IN ('renovacao','reajuste','alteracao_valor','outro')),
  descricao text,
  data_inicio date,
  data_fim date,
  valor_anterior numeric,
  valor_novo numeric,
  indice_reajuste text,
  status text DEFAULT 'rascunho' CHECK (status IN ('rascunho','aguardando_assinatura','assinado')),
  created_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE loc_imoveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_saidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_vistoria_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_vistoria_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_faturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_acordos ENABLE ROW LEVEL SECURITY;
ALTER TABLE loc_aditivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem loc_imoveis" ON loc_imoveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_imoveis" ON loc_imoveis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam loc_imoveis" ON loc_imoveis FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Autenticados leem loc_entradas" ON loc_entradas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_entradas" ON loc_entradas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam loc_entradas" ON loc_entradas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Autenticados leem loc_saidas" ON loc_saidas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_saidas" ON loc_saidas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam loc_saidas" ON loc_saidas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Autenticados leem loc_vistorias" ON loc_vistorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_vistorias" ON loc_vistorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam loc_vistorias" ON loc_vistorias FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Autenticados leem loc_vistoria_itens" ON loc_vistoria_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_vistoria_itens" ON loc_vistoria_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam loc_vistoria_itens" ON loc_vistoria_itens FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Autenticados leem loc_vistoria_fotos" ON loc_vistoria_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_vistoria_fotos" ON loc_vistoria_fotos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados leem loc_faturas" ON loc_faturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_faturas" ON loc_faturas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam loc_faturas" ON loc_faturas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Autenticados leem loc_solicitacoes" ON loc_solicitacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_solicitacoes" ON loc_solicitacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam loc_solicitacoes" ON loc_solicitacoes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Autenticados leem loc_acordos" ON loc_acordos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_acordos" ON loc_acordos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados leem loc_aditivos" ON loc_aditivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem loc_aditivos" ON loc_aditivos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam loc_aditivos" ON loc_aditivos FOR UPDATE TO authenticated USING (true);
