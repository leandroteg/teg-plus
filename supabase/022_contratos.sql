-- ══════════════════════════════════════════════════════════════════════════════
-- 022_contratos.sql — Módulo Contratos e Faturamento — TEG+ ERP
-- ══════════════════════════════════════════════════════════════════════════════
-- Controla o faturamento da empresa com CEMIG e outros clientes
-- Tabelas: con_clientes, con_contratos, con_medicoes, con_medicao_itens,
--          con_pleitos, con_alertas
-- Depende de: sys_obras (001)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Clientes (CEMIG e outros) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_clientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  cnpj            VARCHAR(18) UNIQUE,
  tipo            VARCHAR(20) DEFAULT 'publico'
                  CHECK (tipo IN ('publico','privado','governo')),
  -- Contato
  contato_nome    TEXT,
  contato_email   TEXT,
  contato_telefone TEXT,
  -- Endereço
  cidade          VARCHAR(100),
  uf              VARCHAR(2),
  -- Integração
  omie_id         BIGINT,
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

INSERT INTO con_clientes (nome, cnpj, tipo) VALUES
  ('CEMIG – Companhia Energética de Minas Gerais', '17.155.730/0001-64', 'publico'),
  ('TEG União Engenharia (interno)',               NULL,                  'privado')
ON CONFLICT (cnpj) DO NOTHING;

-- ── 2. Contratos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_contratos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              VARCHAR(50) UNIQUE NOT NULL,  -- número do contrato CEMIG ou interno
  -- Partes
  cliente_id          UUID REFERENCES con_clientes(id) NOT NULL,
  obra_id             UUID REFERENCES sys_obras(id),    -- obra principal vinculada
  -- Escopo
  objeto              TEXT NOT NULL,
  descricao           TEXT,
  -- Valores
  valor_total         NUMERIC(15,2) NOT NULL,
  valor_aditivos      NUMERIC(15,2) DEFAULT 0,
  valor_glosado       NUMERIC(15,2) DEFAULT 0,
  valor_medido        NUMERIC(15,2) DEFAULT 0,      -- atualizado por trigger
  valor_a_medir       NUMERIC(15,2)                 -- calculado
    GENERATED ALWAYS AS (valor_total + valor_aditivos - valor_glosado - valor_medido) STORED,
  -- Datas
  data_assinatura     DATE,
  data_inicio         DATE NOT NULL,
  data_fim_previsto   DATE NOT NULL,
  data_fim_real       DATE,
  -- Reajuste
  indice_reajuste     VARCHAR(20),                  -- IPCA, INPC, IGP-M, etc.
  data_base_reajuste  DATE,
  proxima_revisao     DATE,
  -- Garantia
  garantia_tipo       VARCHAR(30),                  -- seguro_garantia, fianca_bancaria, retencao
  garantia_valor      NUMERIC(15,2),
  garantia_vencimento DATE,
  -- Status
  status              VARCHAR(20) DEFAULT 'vigente'
                      CHECK (status IN (
                        'em_negociacao','assinado','vigente',
                        'suspenso','encerrado','rescindido'
                      )),
  -- Aditivos (histórico)
  aditivos            JSONB DEFAULT '[]',
  -- Arquivos
  arquivo_url         TEXT,                         -- contrato assinado
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  created_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_con_cont_cliente ON con_contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_con_cont_obra    ON con_contratos(obra_id);
CREATE INDEX IF NOT EXISTS idx_con_cont_status  ON con_contratos(status);
CREATE INDEX IF NOT EXISTS idx_con_cont_datas   ON con_contratos(data_fim_previsto);

-- ── 3. Medições ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_medicoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              VARCHAR(30) UNIQUE,           -- ex: "MED-2026-001"
  contrato_id         UUID REFERENCES con_contratos(id) NOT NULL,
  obra_id             UUID REFERENCES sys_obras(id),
  -- Período
  periodo_inicio      DATE NOT NULL,
  periodo_fim         DATE NOT NULL,
  sequencia           INTEGER,                      -- número da medição (1ª, 2ª...)
  -- Valores
  valor_bruto         NUMERIC(15,2) NOT NULL,       -- total dos serviços medidos
  desconto            NUMERIC(15,2) DEFAULT 0,
  retencao_garantia   NUMERIC(15,2) DEFAULT 0,
  valor_liquido       NUMERIC(15,2)
    GENERATED ALWAYS AS (valor_bruto - desconto - retencao_garantia) STORED,
  -- Status do fluxo de aprovação
  status              VARCHAR(30) DEFAULT 'rascunho'
                      CHECK (status IN (
                        'rascunho','submetida','em_analise_cliente',
                        'aprovada_parcial','aprovada','glosada','faturada','paga'
                      )),
  -- Datas do fluxo
  data_submissao      DATE,
  data_aprovacao_cliente DATE,
  data_faturamento    DATE,
  data_recebimento    DATE,
  -- Aprovação (reutiliza ApprovaAi)
  token_aprovacao     UUID DEFAULT gen_random_uuid(),
  aprovado_por        TEXT,
  aprovado_em         TIMESTAMPTZ,
  motivo_glosa        TEXT,
  -- Nota Fiscal
  numero_nf           VARCHAR(30),
  chave_nfe           VARCHAR(50),
  nf_url              TEXT,
  -- Integração
  omie_cr_id          BIGINT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  created_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_con_med_contrato ON con_medicoes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_med_status   ON con_medicoes(status);
CREATE INDEX IF NOT EXISTS idx_con_med_periodo  ON con_medicoes(periodo_inicio, periodo_fim);

-- Gera número da medição
CREATE OR REPLACE FUNCTION con_gerar_numero_medicao()
RETURNS TRIGGER AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  IF NEW.numero IS NULL THEN
    SELECT COALESCE(MAX(sequencia), 0) + 1
    INTO v_seq
    FROM con_medicoes
    WHERE contrato_id = NEW.contrato_id;

    NEW.sequencia = v_seq;
    NEW.numero = 'MED-' || TO_CHAR(now(), 'YYYY') || '-' ||
                 LPAD(v_seq::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_con_med_numero
  BEFORE INSERT ON con_medicoes
  FOR EACH ROW EXECUTE FUNCTION con_gerar_numero_medicao();

-- ── 4. Itens da Medição (discriminação dos serviços) ──────────────────────────
CREATE TABLE IF NOT EXISTS con_medicao_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id      UUID REFERENCES con_medicoes(id) NOT NULL,
  -- Serviço
  codigo          VARCHAR(30),
  descricao       TEXT NOT NULL,
  unidade         VARCHAR(20),
  -- Quantidades
  qtd_contratada  NUMERIC(12,4),
  qtd_anterior    NUMERIC(12,4) DEFAULT 0,    -- medido em medições anteriores
  qtd_atual       NUMERIC(12,4) NOT NULL,
  qtd_acumulada   NUMERIC(12,4)               -- atual + anterior
    GENERATED ALWAYS AS (qtd_anterior + qtd_atual) STORED,
  -- Valores
  preco_unitario  NUMERIC(12,4),
  valor_atual     NUMERIC(15,2),
  valor_anterior  NUMERIC(15,2) DEFAULT 0,
  -- Glosa (se parcialmente aprovado)
  qtd_glosada     NUMERIC(12,4) DEFAULT 0,
  motivo_glosa    TEXT,
  -- Avançamento físico
  percentual_anterior NUMERIC(5,2) DEFAULT 0,
  percentual_atual    NUMERIC(5,2),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_con_med_itens ON con_medicao_itens(medicao_id);

-- Trigger: atualiza valor_medido no contrato
CREATE OR REPLACE FUNCTION con_atualizar_valor_contrato()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE con_contratos
  SET valor_medido = (
    SELECT COALESCE(SUM(valor_liquido), 0)
    FROM con_medicoes
    WHERE contrato_id = (SELECT contrato_id FROM con_medicoes WHERE id = NEW.id)
      AND status IN ('aprovada','faturada','paga')
  ),
  updated_at = now()
  WHERE id = (SELECT contrato_id FROM con_medicoes WHERE id = NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_con_valor_contrato
  AFTER UPDATE ON con_medicoes
  FOR EACH ROW
  WHEN (NEW.status IN ('aprovada','faturada','paga'))
  EXECUTE FUNCTION con_atualizar_valor_contrato();

-- ── 5. Pleitos (reclames de desvio de escopo) ────────────────────────────────
CREATE TABLE IF NOT EXISTS con_pleitos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              VARCHAR(30) UNIQUE,
  contrato_id         UUID REFERENCES con_contratos(id) NOT NULL,
  obra_id             UUID REFERENCES sys_obras(id),
  -- Classificação
  tipo                VARCHAR(30) DEFAULT 'adicional_escopo'
                      CHECK (tipo IN (
                        'adicional_escopo','reequilibrio_precos',
                        'prazo','suspensao','condicoes_adversas','outro'
                      )),
  -- Descrição
  titulo              TEXT NOT NULL,
  descricao           TEXT NOT NULL,
  justificativa       TEXT,
  -- Valores
  valor_pleiteado     NUMERIC(15,2) NOT NULL,
  valor_aprovado      NUMERIC(15,2),
  -- Documentação
  documentos          TEXT[] DEFAULT '{}',      -- URLs dos documentos
  -- Status
  status              VARCHAR(20) DEFAULT 'em_elaboracao'
                      CHECK (status IN (
                        'em_elaboracao','submetido','em_analise',
                        'aprovado','aprovado_parcial','rejeitado','retirado'
                      )),
  -- Datas
  data_evento         DATE,                     -- quando ocorreu o fato gerador
  data_submissao      DATE,
  data_resposta       DATE,
  prazo_resposta      DATE,
  -- Resultado
  motivo_rejeicao     TEXT,
  observacoes         TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  created_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_con_plei_contrato ON con_pleitos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_plei_status   ON con_pleitos(status);

CREATE SEQUENCE IF NOT EXISTS con_pleito_seq START 1;

CREATE OR REPLACE FUNCTION con_gerar_numero_pleito()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero = 'PLE-' || TO_CHAR(now(), 'YYYY') || '-' ||
                 LPAD(nextval('con_pleito_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_con_pleito_numero
  BEFORE INSERT ON con_pleitos
  FOR EACH ROW EXECUTE FUNCTION con_gerar_numero_pleito();

-- ── 6. Alertas de Contratos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_alertas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id     UUID REFERENCES con_contratos(id) NOT NULL,
  tipo            VARCHAR(30) NOT NULL
                  CHECK (tipo IN (
                    'vencimento_proximo','garantia_vencendo',
                    'revisao_reajuste','medicao_atrasada','pleito_sem_resposta'
                  )),
  titulo          TEXT NOT NULL,
  mensagem        TEXT,
  data_alerta     DATE NOT NULL,
  status          VARCHAR(20) DEFAULT 'pendente'
                  CHECK (status IN ('pendente','enviado','ignorado','resolvido')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_con_alert_contrato ON con_alertas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_alert_status   ON con_alertas(status);

-- Função: gera alertas de contratos
CREATE OR REPLACE FUNCTION con_gerar_alertas(p_dias INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  -- Contratos vencendo
  INSERT INTO con_alertas (contrato_id, tipo, titulo, mensagem, data_alerta)
  SELECT
    id, 'vencimento_proximo',
    'Contrato vencendo: ' || numero,
    'Contrato ' || numero || ' com ' || (SELECT nome FROM con_clientes WHERE id = cliente_id) ||
    ' vence em ' || data_fim_previsto,
    CURRENT_DATE
  FROM con_contratos
  WHERE status = 'vigente'
    AND data_fim_previsto BETWEEN CURRENT_DATE AND CURRENT_DATE + p_dias
    AND NOT EXISTS (
      SELECT 1 FROM con_alertas a WHERE a.contrato_id = con_contratos.id
        AND a.tipo = 'vencimento_proximo' AND a.data_alerta = CURRENT_DATE
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Garantias vencendo
  INSERT INTO con_alertas (contrato_id, tipo, titulo, mensagem, data_alerta)
  SELECT
    id, 'garantia_vencendo',
    'Garantia vencendo: ' || numero,
    'A garantia do contrato ' || numero || ' vence em ' || garantia_vencimento,
    CURRENT_DATE
  FROM con_contratos
  WHERE status = 'vigente'
    AND garantia_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + p_dias
    AND NOT EXISTS (
      SELECT 1 FROM con_alertas a WHERE a.contrato_id = con_contratos.id
        AND a.tipo = 'garantia_vencendo' AND a.data_alerta = CURRENT_DATE
    );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. RPC: Dashboard Contratos ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_contratos()
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'resumo', (
      SELECT json_build_object(
        'total_contratos',    COUNT(*),
        'vigentes',           COUNT(*) FILTER (WHERE status = 'vigente'),
        'valor_total',        COALESCE(SUM(valor_total + valor_aditivos), 0),
        'valor_medido',       COALESCE(SUM(valor_medido), 0),
        'valor_a_medir',      COALESCE(SUM(valor_a_medir), 0),
        'percentual_geral',   ROUND(
          COALESCE(SUM(valor_medido), 0) /
          NULLIF(COALESCE(SUM(valor_total + valor_aditivos), 0), 0) * 100, 1
        )
      )
      FROM con_contratos WHERE status IN ('vigente','assinado')
    ),
    'contratos', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM (
        SELECT
          ct.id, ct.numero, ct.objeto, ct.status,
          cl.nome AS cliente,
          ct.valor_total + ct.valor_aditivos AS valor_contrato,
          ct.valor_medido,
          ct.valor_a_medir,
          ct.data_fim_previsto,
          ROUND(ct.valor_medido / NULLIF(ct.valor_total + ct.valor_aditivos, 0) * 100, 1) AS percentual
        FROM con_contratos ct
        JOIN con_clientes cl ON cl.id = ct.cliente_id
        WHERE ct.status IN ('vigente','assinado')
        ORDER BY ct.data_fim_previsto ASC
      ) c
    ),
    'medicoes_pendentes', (
      SELECT COUNT(*) FROM con_medicoes
      WHERE status IN ('submetida','em_analise_cliente','aprovada_parcial')
    ),
    'pleitos_abertos', (
      SELECT COUNT(*) FROM con_pleitos
      WHERE status IN ('em_elaboracao','submetido','em_analise')
    ),
    'alertas_ativos', (
      SELECT COUNT(*) FROM con_alertas WHERE status = 'pendente'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 8. Triggers updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION con_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_con_cont_updated
  BEFORE UPDATE ON con_contratos
  FOR EACH ROW EXECUTE FUNCTION con_set_updated_at();

CREATE OR REPLACE TRIGGER trg_con_med_updated
  BEFORE UPDATE ON con_medicoes
  FOR EACH ROW EXECUTE FUNCTION con_set_updated_at();

CREATE OR REPLACE TRIGGER trg_con_plei_updated
  BEFORE UPDATE ON con_pleitos
  FOR EACH ROW EXECUTE FUNCTION con_set_updated_at();

-- ── 9. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE con_clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_contratos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_medicoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_medicao_itens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_pleitos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_alertas         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "con_cli_read"  ON con_clientes      FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_cont_read" ON con_contratos     FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_med_read"  ON con_medicoes      FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_medi_read" ON con_medicao_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_ple_read"  ON con_pleitos       FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_ale_read"  ON con_alertas       FOR SELECT TO authenticated USING (true);

CREATE POLICY "con_cli_write"  ON con_clientes      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "con_cont_write" ON con_contratos     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "con_med_write"  ON con_medicoes      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "con_medi_write" ON con_medicao_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "con_ple_write"  ON con_pleitos       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "con_ale_write"  ON con_alertas       FOR ALL TO service_role   USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM 022_contratos.sql
-- ══════════════════════════════════════════════════════════════════════════════
