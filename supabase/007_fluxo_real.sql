-- ══════════════════════════════════════════════════════════════════════════════
-- TEG+ ERP · 007_fluxo_real.sql
-- Migração: dados reais do fluxo de compras (PDF Fev/2026)
--   • Expande ENUM status_requisicao com 8 novos estados
--   • Adiciona colunas em cmp_categorias (comprador, alçadas, política)
--   • Substitui categorias genéricas pelas 12 reais do fluxo
--   • Substitui compradores fictícios por Lauany / Fernando / Aline
--   • Cria tabela cmp_pedidos (etapas 5-7 do fluxo)
-- Rodar no Supabase SQL Editor ─ idempotente (IF NOT EXISTS / ON CONFLICT)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Expandir ENUM status_requisicao ────────────────────────────────────────
-- ADD VALUE é seguro em produção (não trava tabela, não exige transação especial)
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'cotacao_enviada';
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'cotacao_aprovada';
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'cotacao_rejeitada';
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'pedido_emitido';
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'em_entrega';
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'entregue';
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'aguardando_pgto';
ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'pago';

-- ── 2. Adicionar colunas em cmp_categorias ────────────────────────────────────
ALTER TABLE cmp_categorias
  ADD COLUMN IF NOT EXISTS comprador_nome      TEXT,
  ADD COLUMN IF NOT EXISTS alcada1_aprovador   TEXT,        -- 'Welton' ou 'Claudinor'
  ADD COLUMN IF NOT EXISTS alcada1_limite      DECIMAL(15,2) DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS cotacoes_regras     JSONB
    DEFAULT '{"ate_500":1,"501_a_2k":2,"acima_2k":3}'::jsonb,
  ADD COLUMN IF NOT EXISTS politica_resumo     TEXT;

-- ── 3. Substituir categorias por dados reais (12 do PDF) ──────────────────────
TRUNCATE TABLE cmp_categorias CASCADE;

INSERT INTO cmp_categorias
  (codigo, nome, comprador_nome, alcada1_aprovador, alcada1_limite,
   cotacoes_regras, politica_resumo, cor, icone, keywords, ativo)
VALUES
  -- ● LAUANY ──────────────────────────────────────────────────────────────────
  ('MATERIAIS_OBRA', 'Materiais de Obra',
   'Lauany', 'Welton', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Materiais para canteiro, aço, concreto, madeira e EPC. Acima R$5k: mín. 3 cotações + Laucídio.',
   '#8b5cf6', 'Building2',
   ARRAY['material','obra','aço','concreto','madeira','cimento','ferro','construção','epc'],
   true),

  ('EPI_EPC', 'EPI e EPC',
   'Lauany', 'Welton', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Somente CA válido MTE. Distribuidores homologados (varejo só em emergência documentada). Pedido trimestral em atacado para alto giro.',
   '#ef4444', 'ShieldCheck',
   ARRAY['epi','epc','capacete','luva','bota','óculos','cinto','proteção','segurança','uniforme'],
   true),

  ('FERRAMENTAL', 'Ferramental',
   'Lauany', 'Welton', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Ferramentas manuais e itens de consumo. Acima R$300: NF + registro na planilha de patrimônio.',
   '#06b6d4', 'Wrench',
   ARRAY['ferramenta','marreta','chave','alicate','furadeira','esmerilhadeira','consumo','equipamento'],
   true),

  ('CENTRO_DIST', 'Centro de Distribuição',
   'Lauany', 'Welton', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Compras rotativas e reposição de estoque do CD. Seguir lista padronizada de reposição automática.',
   '#10b981', 'Package',
   ARRAY['cd','centro','distribuição','estoque','reposição','rotativo','almoxarifado'],
   true),

  ('AQUISICOES_ESP', 'Demais Aquisições Específicas',
   'Lauany', 'Claudinor', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Compras pontuais e demandas específicas direcionadas pela diretoria. Exige justificativa detalhada.',
   '#6b7280', 'ShoppingBag',
   ARRAY['específico','pontual','diretoria','especial','demanda','avulso'],
   true),

  -- ● FERNANDO ────────────────────────────────────────────────────────────────
  ('FROTA_EQUIP', 'Frota e Equipamentos',
   'Fernando', 'Claudinor', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Preventiva obrigatória conforme calendário km/meses. Somente em oficinas credenciadas. Orçamento aprovado ANTES da execução.',
   '#f59e0b', 'Truck',
   ARRAY['frota','veículo','carro','caminhão','manutenção','peça','revisão','mecânica','motor','pneu'],
   true),

  ('SERVICOS', 'Contratação de Serviços',
   'Fernando', 'Claudinor', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Escopo detalhado por escrito antes de qualquer cotação. Contrato/OS formal obrigatório. Medição e aceite técnico pelo engenheiro antes do pagamento.',
   '#3b82f6', 'Briefcase',
   ARRAY['serviço','contratação','terceirizado','manutenção','elétrica','civil','especializado'],
   true),

  ('LOCACAO', 'Locação de Veículos e Equipamentos',
   'Fernando', 'Claudinor', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Locação > R$2k/mês: contrato formal obrigatório. Uso pontual ou < 3 meses → locação. Uso contínuo → compra com aprovação.',
   '#14b8a6', 'Car',
   ARRAY['locação','aluguel','máquina','mangote','prensa','cavalete','equipamento','grua','guindaste'],
   true),

  -- ● ALINE ───────────────────────────────────────────────────────────────────
  ('MOBILIZACAO', 'Mobilização e Deslocamentos',
   'Aline', 'Welton', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'MOB/DESMOB, viagens e deslocamentos para mobilizações ou serviços pontuais. Justificativa de obra obrigatória.',
   '#7c3aed', 'MapPin',
   ARRAY['mobilização','viagem','deslocamento','passagem','hotel','desmobilização','mob','desmob'],
   true),

  ('ALOJAMENTO', 'Alojamento e Imóveis',
   'Aline', 'Welton', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Adequação de canteiros e alojamentos, contratos de locação de imóveis. Contrato formal para locações.',
   '#059669', 'Home',
   ARRAY['alojamento','canteiro','imóvel','locação','casa','moradia','kitnet','adequação'],
   true),

  ('ALIMENTACAO', 'Alimentação',
   'Aline', 'Welton', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Somente via contrato formal com restaurante. Restaurante deve comprovar alvará sanitário vigente. Valor máximo por refeição aprovado por Laucídio.',
   '#f97316', 'Utensils',
   ARRAY['alimentação','refeição','restaurante','marmita','almoço','jantar','lanche','cantina'],
   true),

  ('ESCRITORIO', 'Escritório e Adequações',
   'Aline', 'Welton', 2000,
   '{"ate_500":1,"501_a_2k":2,"acima_2k":3}',
   'Material de escritório, papelaria, itens de adequação de espaços administrativos. Pedido mensal consolidado.',
   '#6366f1', 'Monitor',
   ARRAY['escritório','papelaria','caneta','papel','toner','impressora','informática','adequação','mobiliário'],
   true);

-- ── 4. Substituir compradores por dados reais (Lauany / Fernando / Aline) ─────
TRUNCATE TABLE cmp_compradores CASCADE;

INSERT INTO cmp_compradores (nome, email, telefone, categorias, ativo)
VALUES
  ('Lauany',
   'lauany@teguniao.com.br',
   NULL,
   ARRAY['MATERIAIS_OBRA','EPI_EPC','FERRAMENTAL','CENTRO_DIST','AQUISICOES_ESP'],
   true),

  ('Fernando',
   'fernando@teguniao.com.br',
   NULL,
   ARRAY['FROTA_EQUIP','SERVICOS','LOCACAO'],
   true),

  ('Aline',
   'aline@teguniao.com.br',
   NULL,
   ARRAY['MOBILIZACAO','ALOJAMENTO','ALIMENTACAO','ESCRITORIO'],
   true);

-- ── 5. Criar tabela cmp_pedidos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cmp_pedidos (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_id         UUID          REFERENCES cmp_requisicoes(id) ON DELETE SET NULL,
  cotacao_id            UUID          REFERENCES cmp_cotacoes(id)    ON DELETE SET NULL,
  comprador_id          UUID          REFERENCES cmp_compradores(id) ON DELETE SET NULL,
  numero_pedido         VARCHAR(20)   UNIQUE,
  fornecedor_nome       TEXT          NOT NULL,
  valor_total           DECIMAL(15,2),
  status                TEXT          NOT NULL DEFAULT 'emitido'
    CHECK (status IN ('emitido','confirmado','em_entrega','entregue','cancelado')),
  data_pedido           DATE,
  data_prevista_entrega DATE,
  data_entrega_real     DATE,
  nf_numero             TEXT,
  nf_url                TEXT,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cmp_pedidos IS
  'Pedidos emitidos após aprovação da cotação (etapa 5 do fluxo de compras)';

-- RLS
ALTER TABLE cmp_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidos_anon_all"   ON cmp_pedidos;
DROP POLICY IF EXISTS "pedidos_auth_all"   ON cmp_pedidos;

CREATE POLICY "pedidos_anon_all" ON cmp_pedidos
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "pedidos_auth_all" ON cmp_pedidos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER cmp_pedidos_updated_at
  BEFORE UPDATE ON cmp_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_req     ON cmp_pedidos(requisicao_id);
CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_status  ON cmp_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_cmp_pedidos_data    ON cmp_pedidos(data_prevista_entrega);

-- ── 6. Seed de obras reais ────────────────────────────────────────────────────
-- Garante que obras do PDF existam (ON CONFLICT ignora se já existir)
INSERT INTO sys_obras (codigo, nome, municipio, uf, status)
VALUES
  ('FRUTAL',      'SE Frutal',           'Frutal',      'MG', 'ativa'),
  ('PARACATU',    'SE Paracatu',         'Paracatu',    'MG', 'ativa'),
  ('PERDIZES',    'SE Perdizes',         'Perdizes',    'MG', 'ativa'),
  ('TRESMARIAS',  'SE Três Marias',      'Três Marias', 'MG', 'ativa'),
  ('RIOPAR',      'Rio Paranaíba',       'Rio Paranaíba','MG','ativa'),
  ('ITUIUTABA',   'SE Ituiutaba',        'Ituiutaba',   'MG', 'ativa'),
  ('CD_MATRIZ',   'CD — Matriz',         'Uberlândia',  'MG', 'ativa')
ON CONFLICT (codigo) DO NOTHING;

-- ── Verificação ───────────────────────────────────────────────────────────────
SELECT 'cmp_categorias' AS tabela, COUNT(*) AS registros FROM cmp_categorias
UNION ALL
SELECT 'cmp_compradores', COUNT(*) FROM cmp_compradores
UNION ALL
SELECT 'cmp_pedidos', COUNT(*) FROM cmp_pedidos
UNION ALL
SELECT 'sys_obras', COUNT(*) FROM sys_obras;
