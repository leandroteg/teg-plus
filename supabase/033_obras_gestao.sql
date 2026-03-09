-- ============================================================================
-- 033_obras_gestao.sql
-- Módulo Obras: apontamentos, RDO, prestação contas, adiantamentos, equipes
-- ============================================================================

-- ── 1. obr_frentes — Frentes de trabalho por obra ───────────────────────────
CREATE TABLE IF NOT EXISTS obr_frentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  responsavel TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. obr_apontamentos — Apontamentos diários de produção ─────────────────
CREATE TABLE IF NOT EXISTS obr_apontamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  frente_id UUID REFERENCES obr_frentes(id),
  data_apontamento DATE NOT NULL,
  atividade TEXT NOT NULL,
  contrato_item_id UUID REFERENCES con_contrato_itens(id),
  quantidade_executada NUMERIC NOT NULL DEFAULT 0,
  unidade TEXT,
  equipe_responsavel TEXT,
  horas_trabalhadas NUMERIC(5,2) DEFAULT 0,
  observacoes TEXT,
  evidencia_fotos TEXT[],
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','confirmado','validado')),
  apontado_por UUID REFERENCES sys_perfis(id),
  validado_por UUID REFERENCES sys_perfis(id),
  validado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 3. obr_rdo — Diário de Obra ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS obr_rdo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  condicao_climatica TEXT NOT NULL DEFAULT 'sol'
    CHECK (condicao_climatica IN ('sol','nublado','chuva','chuva_forte','tempestade')),
  efetivo_proprio INTEGER DEFAULT 0,
  efetivo_terceiro INTEGER DEFAULT 0,
  equipamentos_operando INTEGER DEFAULT 0,
  equipamentos_parados INTEGER DEFAULT 0,
  resumo_atividades TEXT,
  ocorrencias TEXT,
  horas_improdutivas NUMERIC(5,2) DEFAULT 0,
  motivo_improdutividade TEXT,
  fotos TEXT[],
  responsavel UUID REFERENCES sys_perfis(id),
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','finalizado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(obra_id, data)
);

-- ── 4. obr_adiantamentos — Adiantamentos para obras ────────────────────────
CREATE TABLE IF NOT EXISTS obr_adiantamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  solicitante_id UUID NOT NULL REFERENCES sys_perfis(id),
  valor_solicitado NUMERIC(15,2) NOT NULL,
  valor_aprovado NUMERIC(15,2) DEFAULT 0,
  valor_prestado_contas NUMERIC(15,2) DEFAULT 0,
  saldo_pendente NUMERIC(15,2) GENERATED ALWAYS AS (
    COALESCE(valor_aprovado, 0) - COALESCE(valor_prestado_contas, 0)
  ) STORED,
  finalidade TEXT NOT NULL,
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_limite_prestacao DATE,
  status TEXT NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado','aprovado','parcial','prestado','vencido')),
  aprovado_por UUID REFERENCES sys_perfis(id),
  aprovado_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. obr_prestacao_contas — Prestação de contas de obra ───────────────────
CREATE TABLE IF NOT EXISTS obr_prestacao_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  centro_custo_id UUID REFERENCES sys_centros_custo(id),
  classe_financeira_id UUID REFERENCES fin_classes_financeiras(id),
  categoria TEXT NOT NULL
    CHECK (categoria IN (
      'combustivel','alimentacao','hospedagem','transporte',
      'material_consumo','manutencao_emergencial','servico_terceiro',
      'locacao_equipamento','telefonia_internet','outro'
    )),
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  data_gasto DATE NOT NULL,
  fornecedor_nome TEXT,
  fornecedor_cnpj_cpf TEXT,
  forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro'
    CHECK (forma_pagamento IN ('dinheiro','cartao_corporativo','pix','transferencia','adiantamento')),
  numero_nf TEXT,
  comprovante_urls TEXT[],
  adiantamento_id UUID REFERENCES obr_adiantamentos(id),
  solicitante_id UUID NOT NULL REFERENCES sys_perfis(id),
  solicitante_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_analise','aprovada','rejeitada','compensada')),
  aprovador_id UUID REFERENCES sys_perfis(id),
  aprovado_em TIMESTAMPTZ,
  motivo_rejeicao TEXT,
  fin_conta_pagar_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. obr_equipes — Equipes alocadas por frente ───────────────────────────
CREATE TABLE IF NOT EXISTS obr_equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  frente_id UUID REFERENCES obr_frentes(id),
  colaborador_nome TEXT NOT NULL,
  colaborador_id UUID REFERENCES sys_perfis(id),
  funcao TEXT NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 7. obr_mobilizacoes — Mobilizações/desmobilizações ─────────────────────
CREATE TABLE IF NOT EXISTS obr_mobilizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES sys_obras(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('mobilizacao','desmobilizacao')),
  colaboradores JSONB DEFAULT '[]'::jsonb,
  equipamentos JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'planejada'
    CHECK (status IN ('planejada','em_andamento','concluida')),
  data_prevista DATE,
  data_real DATE,
  responsavel TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 8. Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_obr_frentes_obra ON obr_frentes(obra_id);
CREATE INDEX IF NOT EXISTS idx_obr_apontamentos_obra ON obr_apontamentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_obr_apontamentos_data ON obr_apontamentos(data_apontamento);
CREATE INDEX IF NOT EXISTS idx_obr_apontamentos_status ON obr_apontamentos(status);
CREATE INDEX IF NOT EXISTS idx_obr_rdo_obra_data ON obr_rdo(obra_id, data);
CREATE INDEX IF NOT EXISTS idx_obr_adiantamentos_obra ON obr_adiantamentos(obra_id);
CREATE INDEX IF NOT EXISTS idx_obr_adiantamentos_status ON obr_adiantamentos(status);
CREATE INDEX IF NOT EXISTS idx_obr_prestacao_obra ON obr_prestacao_contas(obra_id);
CREATE INDEX IF NOT EXISTS idx_obr_prestacao_status ON obr_prestacao_contas(status);
CREATE INDEX IF NOT EXISTS idx_obr_prestacao_data ON obr_prestacao_contas(data_gasto);
CREATE INDEX IF NOT EXISTS idx_obr_equipes_obra ON obr_equipes(obra_id);
CREATE INDEX IF NOT EXISTS idx_obr_mobilizacoes_obra ON obr_mobilizacoes(obra_id);

-- ── 9. RLS ──────────────────────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'obr_frentes','obr_apontamentos','obr_rdo','obr_adiantamentos',
    'obr_prestacao_contas','obr_equipes','obr_mobilizacoes'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('
      CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true);
      CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (true);
      CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (true);
      CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (true);
    ',
      tbl || '_sel', tbl,
      tbl || '_ins', tbl,
      tbl || '_upd', tbl,
      tbl || '_del', tbl
    );
  END LOOP;
END $$;

-- ── 10. Trigger: update adiantamento on prestacao approval ──────────────────
CREATE OR REPLACE FUNCTION fn_obr_prestacao_update_adiantamento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovada' AND NEW.adiantamento_id IS NOT NULL
     AND (OLD IS NULL OR OLD.status <> 'aprovada') THEN
    UPDATE obr_adiantamentos
    SET valor_prestado_contas = COALESCE(valor_prestado_contas, 0) + NEW.valor,
        status = CASE
          WHEN COALESCE(valor_prestado_contas, 0) + NEW.valor >= COALESCE(valor_aprovado, 0)
          THEN 'prestado'
          ELSE 'parcial'
        END,
        updated_at = now()
    WHERE id = NEW.adiantamento_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_obr_prestacao_adiantamento ON obr_prestacao_contas;
CREATE TRIGGER trg_obr_prestacao_adiantamento
  AFTER INSERT OR UPDATE ON obr_prestacao_contas
  FOR EACH ROW EXECUTE FUNCTION fn_obr_prestacao_update_adiantamento();

-- ── 11. Views ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_obr_avanco_fisico AS
SELECT
  a.obra_id,
  o.nome AS obra_nome,
  DATE_TRUNC('week', a.data_apontamento)::DATE AS semana,
  SUM(a.quantidade_executada) AS qtd_executada,
  SUM(a.horas_trabalhadas) AS horas,
  COUNT(*) AS apontamentos
FROM obr_apontamentos a
JOIN sys_obras o ON o.id = a.obra_id
WHERE a.status IN ('confirmado','validado')
GROUP BY a.obra_id, o.nome, DATE_TRUNC('week', a.data_apontamento);

CREATE OR REPLACE VIEW vw_obr_prestacao_resumo AS
SELECT
  pc.obra_id,
  o.nome AS obra_nome,
  DATE_TRUNC('month', pc.data_gasto)::DATE AS mes,
  pc.status,
  pc.categoria,
  SUM(pc.valor) AS total,
  COUNT(*) AS qtd
FROM obr_prestacao_contas pc
JOIN sys_obras o ON o.id = pc.obra_id
GROUP BY pc.obra_id, o.nome, DATE_TRUNC('month', pc.data_gasto), pc.status, pc.categoria;

-- ── 12. Updated at triggers ─────────────────────────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'obr_apontamentos','obr_rdo','obr_adiantamentos',
    'obr_prestacao_contas','obr_mobilizacoes'
  ]) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
    ', tbl, tbl);
  END LOOP;
END $$;
