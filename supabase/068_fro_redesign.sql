-- 068_fro_redesign.sql — Frotas & Máquinas redesign

-- 1. Adicionar campos em fro_veiculos
ALTER TABLE fro_veiculos
  ADD COLUMN IF NOT EXISTS tipo_ativo       text NOT NULL DEFAULT 'veiculo' CHECK (tipo_ativo IN ('veiculo','maquina')),
  ADD COLUMN IF NOT EXISTS numero_serie     text,
  ADD COLUMN IF NOT EXISTS horimetro_atual  numeric(10,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pat_item_id      uuid,
  ADD COLUMN IF NOT EXISTS con_contrato_id  uuid,
  ADD COLUMN IF NOT EXISTS base_atual_id    uuid,
  ADD COLUMN IF NOT EXISTS responsavel_id   uuid;

-- 2. Adicionar novos valores ao enum fro_status_veiculo
ALTER TYPE fro_status_veiculo ADD VALUE IF NOT EXISTS 'em_entrada';
ALTER TYPE fro_status_veiculo ADD VALUE IF NOT EXISTS 'aguardando_saida';

-- 3. Acessórios
CREATE TABLE IF NOT EXISTS fro_acessorios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  descricao   text,
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fro_veiculo_acessorios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id   uuid NOT NULL REFERENCES fro_veiculos(id) ON DELETE CASCADE,
  acessorio_id uuid NOT NULL REFERENCES fro_acessorios(id),
  observacoes  text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(veiculo_id, acessorio_id)
);

-- 4. Alocações
CREATE TABLE IF NOT EXISTS fro_alocacoes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id           uuid NOT NULL REFERENCES fro_veiculos(id),
  obra_id              uuid,
  centro_custo_id      uuid,
  responsavel_id       uuid,
  responsavel_nome     text,
  data_saida           timestamptz NOT NULL DEFAULT now(),
  data_retorno_prev    date,
  data_retorno_real    timestamptz,
  hodometro_saida      numeric(10,0),
  hodometro_retorno    numeric(10,0),
  horimetro_saida      numeric(10,1),
  horimetro_retorno    numeric(10,1),
  checklist_saida_id   uuid,
  checklist_retorno_id uuid,
  status               text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada','cancelada')),
  observacoes          text,
  created_by           uuid,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- 5. Templates de checklist
CREATE TABLE IF NOT EXISTS fro_checklist_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('pre_viagem','pos_viagem','entrega_locadora','devolucao_locadora','pre_manutencao','pos_manutencao')),
  tipo_ativo  text DEFAULT 'todos' CHECK (tipo_ativo IN ('todos','veiculo','maquina')),
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fro_checklist_template_itens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES fro_checklist_templates(id) ON DELETE CASCADE,
  ordem        int NOT NULL DEFAULT 0,
  descricao    text NOT NULL,
  obrigatorio  boolean DEFAULT true,
  permite_foto boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS fro_checklist_execucoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      uuid NOT NULL REFERENCES fro_checklist_templates(id),
  veiculo_id       uuid NOT NULL REFERENCES fro_veiculos(id),
  alocacao_id      uuid REFERENCES fro_alocacoes(id),
  hodometro        numeric(10,0),
  horimetro        numeric(10,1),
  responsavel_id   uuid,
  responsavel_nome text,
  status           text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido')),
  assinatura_url   text,
  observacoes      text,
  created_at       timestamptz DEFAULT now(),
  concluido_at     timestamptz
);

CREATE TABLE IF NOT EXISTS fro_checklist_execucao_itens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id      uuid NOT NULL REFERENCES fro_checklist_execucoes(id) ON DELETE CASCADE,
  template_item_id uuid NOT NULL REFERENCES fro_checklist_template_itens(id),
  conforme         boolean,
  foto_url         text,
  observacao       text
);

-- 6. Multas e Pedágios
CREATE TABLE IF NOT EXISTS fro_multas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id      uuid NOT NULL REFERENCES fro_veiculos(id),
  tipo            text NOT NULL CHECK (tipo IN ('multa','pedagio')),
  data_infracao   date,
  data_vencimento date,
  valor           numeric(10,2) NOT NULL DEFAULT 0,
  ait             text,
  descricao       text,
  local           text,
  responsavel_id  uuid,
  obra_id         uuid,
  status          text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','contestada','paga','vencida','cancelada')),
  data_pagamento  date,
  fin_cp_id       uuid,
  observacoes     text,
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 7. Atualizar OS: adicionar status 'pendente' ao enum fro_status_os
ALTER TYPE fro_status_os ADD VALUE IF NOT EXISTS 'pendente' BEFORE 'em_cotacao';

-- 8. RLS
ALTER TABLE fro_acessorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_veiculo_acessorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklist_template_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklist_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklist_execucao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_multas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON fro_acessorios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all"    ON fro_acessorios FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select" ON fro_veiculo_acessorios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all"    ON fro_veiculo_acessorios FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select" ON fro_alocacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all"    ON fro_alocacoes FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select" ON fro_checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all"    ON fro_checklist_templates FOR ALL   TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select" ON fro_checklist_template_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all"    ON fro_checklist_template_itens FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select" ON fro_checklist_execucoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all"    ON fro_checklist_execucoes FOR ALL   TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select" ON fro_checklist_execucao_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all"    ON fro_checklist_execucao_itens FOR ALL    TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_select" ON fro_multas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all"    ON fro_multas FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- 9. Seeds
INSERT INTO fro_checklist_templates (nome, tipo, tipo_ativo) VALUES
  ('Pre-Viagem — Veiculo',     'pre_viagem',         'veiculo'),
  ('Pos-Viagem — Veiculo',     'pos_viagem',         'veiculo'),
  ('Pre-Viagem — Maquina',     'pre_viagem',         'maquina'),
  ('Entrega p/ Locadora',      'entrega_locadora',   'todos'),
  ('Recebimento de Locadora',  'devolucao_locadora', 'todos'),
  ('Entrada em Manutencao',    'pre_manutencao',     'todos'),
  ('Saida de Manutencao',      'pos_manutencao',     'todos')
ON CONFLICT DO NOTHING;

INSERT INTO fro_acessorios (nome) VALUES
  ('Munck'),('Carroceria Aberta'),('Carroceria Fechada'),
  ('Guincho'),('Cacamba'),('Tanque Extra'),('Camera de Re'),
  ('Rastreador GPS'),('Tacografo'),('Extintor'),('Triangulo'),('Macaco')
ON CONFLICT DO NOTHING;
