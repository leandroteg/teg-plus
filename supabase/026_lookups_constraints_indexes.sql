-- ══════════════════════════════════════════════════════════════════════════════
-- 026_lookups_constraints_indexes.sql — Tabelas Lookup, Constraints e Índices
-- TEG+ ERP — Fundação de Integridade de Dados
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. TABELAS LOOKUP ───────────────────────────────────────────────────────

-- 1a. Centro de Custo
CREATE TABLE IF NOT EXISTS fin_centros_custo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(20) NOT NULL UNIQUE,
  nome        VARCHAR(100) NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fin_centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_read" ON fin_centros_custo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cc_write" ON fin_centros_custo
  FOR ALL TO authenticated
  USING (auth_at_least('gerente'))
  WITH CHECK (auth_at_least('gerente'));

-- Seed com valores distintos existentes em fin_contas_pagar
INSERT INTO fin_centros_custo (codigo, nome)
SELECT DISTINCT centro_custo, centro_custo
FROM fin_contas_pagar
WHERE centro_custo IS NOT NULL AND centro_custo != ''
ON CONFLICT (codigo) DO NOTHING;

-- Seed de con_contratos
INSERT INTO fin_centros_custo (codigo, nome)
SELECT DISTINCT centro_custo, centro_custo
FROM con_contratos
WHERE centro_custo IS NOT NULL AND centro_custo != ''
ON CONFLICT (codigo) DO NOTHING;

-- Seed de cmp_requisicoes
INSERT INTO fin_centros_custo (codigo, nome)
SELECT DISTINCT centro_custo, centro_custo
FROM cmp_requisicoes
WHERE centro_custo IS NOT NULL AND centro_custo != ''
ON CONFLICT (codigo) DO NOTHING;


-- 1b. Classe Financeira
CREATE TABLE IF NOT EXISTS fin_classes_financeiras (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      VARCHAR(20) NOT NULL UNIQUE,
  nome        VARCHAR(100) NOT NULL,
  tipo        VARCHAR(10) DEFAULT 'ambos' CHECK (tipo IN ('despesa', 'receita', 'ambos')),
  ativo       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fin_classes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cf_read" ON fin_classes_financeiras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cf_write" ON fin_classes_financeiras
  FOR ALL TO authenticated
  USING (auth_at_least('gerente'))
  WITH CHECK (auth_at_least('gerente'));

-- Seed com valores distintos existentes
INSERT INTO fin_classes_financeiras (codigo, nome)
SELECT DISTINCT classe_financeira, classe_financeira
FROM fin_contas_pagar
WHERE classe_financeira IS NOT NULL AND classe_financeira != ''
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO fin_classes_financeiras (codigo, nome)
SELECT DISTINCT classe_financeira, classe_financeira
FROM fin_contas_receber
WHERE classe_financeira IS NOT NULL AND classe_financeira != ''
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO fin_classes_financeiras (codigo, nome)
SELECT DISTINCT classe_financeira, classe_financeira
FROM con_contratos
WHERE classe_financeira IS NOT NULL AND classe_financeira != ''
ON CONFLICT (codigo) DO NOTHING;


-- ── 2. CHECK CONSTRAINTS — Valores monetários ≥ 0 ──────────────────────────

-- fin_contas_pagar
ALTER TABLE fin_contas_pagar
  ADD CONSTRAINT chk_cp_valor_original CHECK (valor_original >= 0),
  ADD CONSTRAINT chk_cp_valor_pago CHECK (valor_pago >= 0);

-- fin_contas_receber
ALTER TABLE fin_contas_receber
  ADD CONSTRAINT chk_cr_valor_original CHECK (valor_original >= 0),
  ADD CONSTRAINT chk_cr_valor_recebido CHECK (valor_recebido >= 0);

-- con_contratos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_cont_valor_total' AND table_name = 'con_contratos'
  ) THEN
    ALTER TABLE con_contratos ADD CONSTRAINT chk_cont_valor_total CHECK (valor_total >= 0);
  END IF;
END $$;

-- con_parcelas
ALTER TABLE con_parcelas
  ADD CONSTRAINT chk_parc_valor CHECK (valor >= 0);

-- con_contrato_itens
ALTER TABLE con_contrato_itens
  ADD CONSTRAINT chk_item_qtd CHECK (quantidade > 0),
  ADD CONSTRAINT chk_item_valor CHECK (valor_unitario >= 0);

-- est_saldos: impedir saldo negativo
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'est_saldos') THEN
    ALTER TABLE est_saldos ADD CONSTRAINT chk_saldo_positivo CHECK (saldo >= 0);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 3. UNIQUE CONSTRAINTS ──────────────────────────────────────────────────

-- sys_perfis.email: evitar perfis duplicados
DO $$
BEGIN
  ALTER TABLE sys_perfis ADD CONSTRAINT uq_perfis_email UNIQUE (email);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- cmp_pedidos.numero_pedido: evitar POs duplicados
DO $$
BEGIN
  ALTER TABLE cmp_pedidos ADD CONSTRAINT uq_pedido_numero UNIQUE (numero_pedido);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- con_parcelas: uma parcela por número por contrato
DO $$
BEGIN
  ALTER TABLE con_parcelas ADD CONSTRAINT uq_parcela_contrato_numero UNIQUE (contrato_id, numero);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── 4. ÍNDICES FALTANTES ───────────────────────────────────────────────────

-- Estoque
CREATE INDEX IF NOT EXISTS idx_est_mov_criado
  ON est_movimentacoes(criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_est_saldos_item_base
  ON est_saldos(item_id, base_id);

-- Frotas
CREATE INDEX IF NOT EXISTS idx_fro_os_status
  ON fro_ordens_servico(status);

CREATE INDEX IF NOT EXISTS idx_fro_abast_data
  ON fro_abastecimentos(data_abastecimento);

CREATE INDEX IF NOT EXISTS idx_fro_veic_placa
  ON fro_veiculos(placa);

-- Logística
CREATE INDEX IF NOT EXISTS idx_log_solic_status
  ON log_solicitacoes(status);

CREATE INDEX IF NOT EXISTS idx_log_transp_status
  ON log_transportes(status);

-- RH
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rh_colaboradores') THEN
    CREATE INDEX IF NOT EXISTS idx_rh_colab_cpf ON rh_colaboradores(cpf);
    CREATE INDEX IF NOT EXISTS idx_rh_colab_ativo ON rh_colaboradores(ativo);
  END IF;
END $$;

-- Contratos
CREATE INDEX IF NOT EXISTS idx_con_cont_status
  ON con_contratos(status);

CREATE INDEX IF NOT EXISTS idx_con_cont_data_fim
  ON con_contratos(data_fim_previsto);

-- HHt
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hht_lancamentos') THEN
    CREATE INDEX IF NOT EXISTS idx_hht_lanc_data ON hht_lancamentos(data_lancamento);
    CREATE INDEX IF NOT EXISTS idx_hht_lanc_status ON hht_lancamentos(status);
  END IF;
END $$;

-- SSMA
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ssm_ocorrencias') THEN
    CREATE INDEX IF NOT EXISTS idx_ssm_ocor_data ON ssm_ocorrencias(data_ocorrencia);
    CREATE INDEX IF NOT EXISTS idx_ssm_ocor_tipo ON ssm_ocorrencias(tipo);
  END IF;
END $$;

-- Controladoria
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ctrl_orcamentos') THEN
    CREATE INDEX IF NOT EXISTS idx_ctrl_orc_ano ON ctrl_orcamentos(ano);
    CREATE INDEX IF NOT EXISTS idx_ctrl_orc_status ON ctrl_orcamentos(status);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM 026_lookups_constraints_indexes.sql
-- ══════════════════════════════════════════════════════════════════════════════
