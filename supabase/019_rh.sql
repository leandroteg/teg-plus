-- ══════════════════════════════════════════════════════════════════════════════
-- 019_rh.sql — Módulo RH + DP — TEG+ ERP
-- ══════════════════════════════════════════════════════════════════════════════
-- Tabelas: rh_funcoes, rh_departamentos, rh_colaboradores,
--          rh_mobilizacoes, rh_desmobilizacoes, rh_banco_talentos
-- Depende de: sys_obras (001), sys_perfis (006)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Funções / Cargos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_funcoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(20) UNIQUE NOT NULL,
  descricao   VARCHAR(100) NOT NULL,
  categoria   VARCHAR(50),          -- operacional, tecnico, administrativo, gestao
  cbo         VARCHAR(10),          -- Código Brasileiro de Ocupações
  nivel       VARCHAR(20) DEFAULT 'operacional'
              CHECK (nivel IN ('operacional','tecnico','lideranca','gestao','diretoria')),
  requer_cnh  BOOLEAN DEFAULT false,
  requer_nr   TEXT[],               -- ex: {'NR-10','NR-35'}
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO rh_funcoes (codigo, descricao, categoria, nivel) VALUES
  ('ELET', 'Eletricista',             'operacional', 'operacional'),
  ('ENC',  'Encarregado',             'operacional', 'lideranca'),
  ('TEC',  'Técnico de Campo',        'tecnico',     'tecnico'),
  ('MONT', 'Montador',                'operacional', 'operacional'),
  ('OPE',  'Operador de Máquina',     'operacional', 'operacional'),
  ('ADM',  'Administrativo',          'administrativo','tecnico'),
  ('SUP',  'Supervisor de Obra',      'gestao',      'gestao'),
  ('ENG',  'Engenheiro',              'tecnico',     'gestao'),
  ('SSM',  'Técnico SSMA',            'tecnico',     'tecnico'),
  ('AUX',  'Auxiliar Geral',          'operacional', 'operacional')
ON CONFLICT (codigo) DO NOTHING;

-- ── 2. Departamentos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_departamentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(20) UNIQUE NOT NULL,
  nome        VARCHAR(100) NOT NULL,
  responsavel VARCHAR(100),
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO rh_departamentos (codigo, nome) VALUES
  ('OBR', 'Obras e Engenharia'),
  ('SUP', 'Suprimentos'),
  ('FIN', 'Financeiro'),
  ('RH',  'Recursos Humanos'),
  ('SSM', 'SSMA'),
  ('ADM', 'Administrativo'),
  ('DIR', 'Diretoria')
ON CONFLICT (codigo) DO NOTHING;

-- ── 3. Colaboradores ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_colaboradores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificação
  nome                TEXT NOT NULL,
  cpf                 VARCHAR(14) UNIQUE,
  rg                  VARCHAR(20),
  data_nascimento     DATE,
  -- Vínculo
  matricula           VARCHAR(30) UNIQUE,
  funcao_id           UUID REFERENCES rh_funcoes(id),
  departamento_id     UUID REFERENCES rh_departamentos(id),
  obra_atual_id       UUID REFERENCES sys_obras(id),   -- obra onde está agora
  -- Status
  status              VARCHAR(20) DEFAULT 'ativo'
                      CHECK (status IN ('ativo','afastado','ferias','desmobilizado','desligado')),
  tipo_contrato       VARCHAR(20) DEFAULT 'clt'
                      CHECK (tipo_contrato IN ('clt','pj','estagio','aprendiz','terceiro')),
  data_admissao       DATE,
  data_desligamento   DATE,
  -- Habilitação
  cnh_numero          VARCHAR(20),
  cnh_categoria       VARCHAR(5),
  cnh_vencimento      DATE,
  -- Saúde
  aso_vencimento      DATE,           -- Atestado de Saúde Ocupacional
  tipo_sanguineo      VARCHAR(5),
  -- Contato emergência
  contato_emergencia  TEXT,
  contato_telefone    VARCHAR(20),
  -- Integração
  omie_id             BIGINT,         -- ID no Omie para folha
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  created_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_rh_col_obra      ON rh_colaboradores(obra_atual_id);
CREATE INDEX IF NOT EXISTS idx_rh_col_status    ON rh_colaboradores(status);
CREATE INDEX IF NOT EXISTS idx_rh_col_funcao    ON rh_colaboradores(funcao_id);
CREATE INDEX IF NOT EXISTS idx_rh_col_aso       ON rh_colaboradores(aso_vencimento);
CREATE INDEX IF NOT EXISTS idx_rh_col_cnh       ON rh_colaboradores(cnh_vencimento);

-- ── 4. Mobilizações (processo de contratação → chegada na obra) ───────────────
CREATE TABLE IF NOT EXISTS rh_mobilizacoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      UUID REFERENCES rh_colaboradores(id) NOT NULL,
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL,
  -- Datas chave do processo
  data_solicitacao    DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista       DATE,           -- quando precisa na obra
  data_chegada        DATE,           -- quando chegou de fato
  -- Checklist de mobilização
  docs_pessoais_ok    BOOLEAN DEFAULT false,
  aso_ok              BOOLEAN DEFAULT false,
  epi_entregue        BOOLEAN DEFAULT false,
  uniforme_entregue   BOOLEAN DEFAULT false,
  treinamentos_ok     BOOLEAN DEFAULT false,
  crachá_ok           BOOLEAN DEFAULT false,
  -- Logística
  origem_cidade       VARCHAR(100),
  transporte          VARCHAR(50),    -- onibus, aviao, veiculo_proprio, empresa
  acomodacao          TEXT,
  -- Status
  status              VARCHAR(20) DEFAULT 'solicitado'
                      CHECK (status IN ('solicitado','agendado','em_transito','chegou','cancelado')),
  -- Obs
  observacoes         TEXT,
  responsavel_rh      TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_mob_colaborador ON rh_mobilizacoes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_mob_obra        ON rh_mobilizacoes(obra_id);
CREATE INDEX IF NOT EXISTS idx_rh_mob_status      ON rh_mobilizacoes(status);

-- ── 5. Desmobilizações (checklist de saída) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS rh_desmobilizacoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id      UUID REFERENCES rh_colaboradores(id) NOT NULL,
  obra_id             UUID REFERENCES sys_obras(id) NOT NULL,
  -- Datas
  data_solicitacao    DATE NOT NULL DEFAULT CURRENT_DATE,
  data_saida          DATE,
  motivo              VARCHAR(50)
                      CHECK (motivo IN ('fim_contrato','transferencia','demissao',
                                        'pedido_demissao','ferias','afastamento','outro')),
  -- Checklist de devolução
  epi_devolvido       BOOLEAN DEFAULT false,
  ferramentas_devol   BOOLEAN DEFAULT false,
  uniforme_devolvido  BOOLEAN DEFAULT false,
  cracha_devolvido    BOOLEAN DEFAULT false,
  chaves_devolvidas   BOOLEAN DEFAULT false,
  acesso_revogado     BOOLEAN DEFAULT false,   -- acesso ao sistema
  -- Status
  status              VARCHAR(20) DEFAULT 'solicitado'
                      CHECK (status IN ('solicitado','em_andamento','concluido','cancelado')),
  -- Destino (se transferência)
  obra_destino_id     UUID REFERENCES sys_obras(id),
  -- Obs
  observacoes         TEXT,
  responsavel_rh      TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_desm_colaborador ON rh_desmobilizacoes(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_desm_obra        ON rh_desmobilizacoes(obra_id);

-- ── 6. Banco de Talentos (histórico de obras por colaborador) ─────────────────
CREATE TABLE IF NOT EXISTS rh_banco_talentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  UUID REFERENCES rh_colaboradores(id) NOT NULL,
  obra_id         UUID REFERENCES sys_obras(id) NOT NULL,
  funcao_id       UUID REFERENCES rh_funcoes(id),
  data_inicio     DATE NOT NULL,
  data_fim        DATE,
  avaliacao       INTEGER CHECK (avaliacao BETWEEN 1 AND 5),  -- nota do supervisor
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_bt_colaborador ON rh_banco_talentos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_rh_bt_obra        ON rh_banco_talentos(obra_id);

-- ── 7. Trigger: updated_at automático ────────────────────────────────────────
CREATE OR REPLACE FUNCTION rh_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_rh_col_updated
  BEFORE UPDATE ON rh_colaboradores
  FOR EACH ROW EXECUTE FUNCTION rh_set_updated_at();

CREATE OR REPLACE TRIGGER trg_rh_mob_updated
  BEFORE UPDATE ON rh_mobilizacoes
  FOR EACH ROW EXECUTE FUNCTION rh_set_updated_at();

CREATE OR REPLACE TRIGGER trg_rh_desm_updated
  BEFORE UPDATE ON rh_desmobilizacoes
  FOR EACH ROW EXECUTE FUNCTION rh_set_updated_at();

-- ── 8. Trigger: registra banco de talentos ao desmobilizar ───────────────────
CREATE OR REPLACE FUNCTION rh_registrar_historico_obra()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando desmobilização concluída, registra histórico
  IF NEW.status = 'concluido' AND OLD.status != 'concluido' THEN
    INSERT INTO rh_banco_talentos (colaborador_id, obra_id, data_inicio, data_fim)
    SELECT
      NEW.colaborador_id,
      NEW.obra_id,
      mob.data_chegada,
      NEW.data_saida
    FROM rh_mobilizacoes mob
    WHERE mob.colaborador_id = NEW.colaborador_id
      AND mob.obra_id = NEW.obra_id
      AND mob.status = 'chegou'
    ORDER BY mob.data_chegada DESC
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_rh_historico_obra
  AFTER UPDATE ON rh_desmobilizacoes
  FOR EACH ROW EXECUTE FUNCTION rh_registrar_historico_obra();

-- ── 9. RPC: Headcount por obra ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_headcount_por_obra()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_to_json(h)) INTO result
  FROM (
    SELECT
      o.id AS obra_id,
      o.nome AS obra_nome,
      COUNT(c.id) FILTER (WHERE c.status = 'ativo') AS headcount_ativo,
      COUNT(c.id) FILTER (WHERE c.status = 'afastado') AS afastados,
      COUNT(c.id) FILTER (WHERE c.aso_vencimento < CURRENT_DATE + 30
                            AND c.aso_vencimento IS NOT NULL) AS aso_vencendo,
      COUNT(c.id) FILTER (WHERE c.cnh_vencimento < CURRENT_DATE + 30
                            AND c.cnh_vencimento IS NOT NULL) AS cnh_vencendo
    FROM sys_obras o
    LEFT JOIN rh_colaboradores c ON c.obra_atual_id = o.id
    WHERE o.status = 'ativa'
    GROUP BY o.id, o.nome
    ORDER BY o.nome
  ) h;

  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 10. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE rh_funcoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_departamentos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_colaboradores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_mobilizacoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_desmobilizacoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_banco_talentos    ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado
DROP POLICY IF EXISTS "rh_funcoes_read"       ON rh_funcoes;
DROP POLICY IF EXISTS "rh_depto_read"         ON rh_departamentos;
DROP POLICY IF EXISTS "rh_col_read"           ON rh_colaboradores;
DROP POLICY IF EXISTS "rh_mob_read"           ON rh_mobilizacoes;
DROP POLICY IF EXISTS "rh_desm_read"          ON rh_desmobilizacoes;
DROP POLICY IF EXISTS "rh_bt_read"            ON rh_banco_talentos;

CREATE POLICY "rh_funcoes_read"   ON rh_funcoes         FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_depto_read"     ON rh_departamentos   FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_col_read"       ON rh_colaboradores   FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_mob_read"       ON rh_mobilizacoes    FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_desm_read"      ON rh_desmobilizacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "rh_bt_read"        ON rh_banco_talentos  FOR SELECT TO authenticated USING (true);

-- Escrita: service_role (n8n) e admins
DROP POLICY IF EXISTS "rh_funcoes_write"      ON rh_funcoes;
DROP POLICY IF EXISTS "rh_depto_write"        ON rh_departamentos;
DROP POLICY IF EXISTS "rh_col_write"          ON rh_colaboradores;
DROP POLICY IF EXISTS "rh_mob_write"          ON rh_mobilizacoes;
DROP POLICY IF EXISTS "rh_desm_write"         ON rh_desmobilizacoes;
DROP POLICY IF EXISTS "rh_bt_write"           ON rh_banco_talentos;

CREATE POLICY "rh_funcoes_write"  ON rh_funcoes         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "rh_depto_write"    ON rh_departamentos   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "rh_col_write"      ON rh_colaboradores   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "rh_mob_write"      ON rh_mobilizacoes    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "rh_desm_write"     ON rh_desmobilizacoes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "rh_bt_write"       ON rh_banco_talentos  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated write (RH team)
DROP POLICY IF EXISTS "rh_col_auth_write" ON rh_colaboradores;
CREATE POLICY "rh_col_auth_write" ON rh_colaboradores
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rh_mob_auth_write" ON rh_mobilizacoes;
CREATE POLICY "rh_mob_auth_write" ON rh_mobilizacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rh_desm_auth_write" ON rh_desmobilizacoes;
CREATE POLICY "rh_desm_auth_write" ON rh_desmobilizacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM 019_rh.sql
-- ══════════════════════════════════════════════════════════════════════════════
