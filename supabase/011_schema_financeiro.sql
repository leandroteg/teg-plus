-- ══════════════════════════════════════════════════════════════════════════════
-- 011_schema_financeiro.sql — Módulo Financeiro TEG+ ERP
-- ══════════════════════════════════════════════════════════════════════════════
-- Tabelas: cmp_fornecedores, fin_contas_pagar, fin_contas_receber,
--          fin_documentos, fin_aprovacao_pagamento
-- Alterações: cmp_requisicoes + cmp_pedidos + apr_aprovacoes
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela de Fornecedores ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cmp_fornecedores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social    TEXT NOT NULL,
  nome_fantasia   TEXT,
  cnpj            VARCHAR(18) UNIQUE,
  inscricao_estadual VARCHAR(20),
  -- Endereço
  endereco        TEXT,
  cidade          VARCHAR(100),
  uf              VARCHAR(2),
  cep             VARCHAR(10),
  -- Contato
  telefone        VARCHAR(20),
  email           VARCHAR(255),
  contato_nome    VARCHAR(100),
  -- Dados bancários (para remessa)
  banco_codigo    VARCHAR(10),
  banco_nome      VARCHAR(60),
  agencia         VARCHAR(10),
  conta           VARCHAR(20),
  tipo_conta      VARCHAR(20) DEFAULT 'corrente', -- corrente, poupanca
  boleto          BOOLEAN DEFAULT false,
  pix_chave       VARCHAR(100),
  pix_tipo        VARCHAR(20), -- cpf, cnpj, email, telefone, aleatoria
  -- Integração
  omie_id         BIGINT,
  -- Status
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON cmp_fornecedores(cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_omie ON cmp_fornecedores(omie_id);

-- ── 2. Campos de classificação financeira em cmp_requisicoes ─────────────────
ALTER TABLE cmp_requisicoes
  ADD COLUMN IF NOT EXISTS centro_custo     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS classe_financeira VARCHAR(50),
  ADD COLUMN IF NOT EXISTS projeto_id       UUID;

-- ── 3. Campos financeiros em cmp_pedidos ─────────────────────────────────────
ALTER TABLE cmp_pedidos
  ADD COLUMN IF NOT EXISTS fornecedor_id     UUID REFERENCES cmp_fornecedores(id),
  ADD COLUMN IF NOT EXISTS centro_custo      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS classe_financeira VARCHAR(50),
  ADD COLUMN IF NOT EXISTS projeto_id        UUID,
  ADD COLUMN IF NOT EXISTS condicao_pagamento VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_vencimento   DATE,
  ADD COLUMN IF NOT EXISTS omie_cp_id        BIGINT;

-- ── 4. Contas a Pagar ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_contas_pagar (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Origem
  pedido_id           UUID REFERENCES cmp_pedidos(id),
  requisicao_id       UUID REFERENCES cmp_requisicoes(id),
  -- Fornecedor
  fornecedor_id       UUID REFERENCES cmp_fornecedores(id),
  fornecedor_nome     TEXT NOT NULL,
  -- Valores
  valor_original      NUMERIC(15,2) NOT NULL,
  valor_pago          NUMERIC(15,2) DEFAULT 0,
  -- Datas
  data_emissao        DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento     DATE NOT NULL,
  data_vencimento_orig DATE NOT NULL, -- nunca alterado automaticamente
  data_pagamento      DATE,
  -- Classificação
  centro_custo        VARCHAR(50),
  classe_financeira   VARCHAR(50),
  projeto_id          UUID,
  natureza            VARCHAR(50), -- servico, material, folha, imposto, etc
  -- Pagamento
  forma_pagamento     VARCHAR(30), -- boleto, transferencia, pix, cheque
  cartao_id           UUID REFERENCES fin_cartoes_credito(id),
  numero_documento    VARCHAR(50), -- numero NF, boleto, etc
  -- Status
  status              VARCHAR(30) DEFAULT 'previsto'
                      CHECK (status IN (
                        'previsto','aprovado','aguardando_docs',
                        'aguardando_aprovacao','aprovado_pgto',
                        'em_remessa','pago','conciliado','cancelado'
                      )),
  -- Aprovação pagamento
  aprovado_por        VARCHAR(100),
  aprovado_em         TIMESTAMPTZ,
  -- Integração
  omie_cp_id          BIGINT,
  -- Observações
  descricao           TEXT,
  observacoes         TEXT,
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  created_by          UUID
);

CREATE INDEX IF NOT EXISTS idx_fin_cp_status ON fin_contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_fin_cp_vencimento ON fin_contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_cp_fornecedor ON fin_contas_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fin_cp_pedido ON fin_contas_pagar(pedido_id);
CREATE INDEX IF NOT EXISTS idx_fin_cp_cartao ON fin_contas_pagar(cartao_id);
CREATE INDEX IF NOT EXISTS idx_fin_cp_cc ON fin_contas_pagar(centro_custo);
CREATE INDEX IF NOT EXISTS idx_fin_cp_projeto ON fin_contas_pagar(projeto_id);

-- ── 5. Contas a Receber ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_contas_receber (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Cliente
  cliente_nome        TEXT NOT NULL,
  cliente_cnpj        VARCHAR(18),
  -- NF
  numero_nf           VARCHAR(30),
  serie_nf            VARCHAR(5),
  chave_nfe           VARCHAR(50),
  -- Valores
  valor_original      NUMERIC(15,2) NOT NULL,
  valor_recebido      NUMERIC(15,2) DEFAULT 0,
  -- Datas
  data_emissao        DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento     DATE NOT NULL,
  data_recebimento    DATE,
  -- Classificação
  centro_custo        VARCHAR(50),
  classe_financeira   VARCHAR(50),
  projeto_id          UUID,
  natureza            VARCHAR(50),
  -- Status
  status              VARCHAR(30) DEFAULT 'previsto'
                      CHECK (status IN (
                        'previsto','faturado','parcial','recebido','conciliado',
                        'vencido','cancelado'
                      )),
  -- Integração
  omie_cr_id          BIGINT,
  -- Audit
  descricao           TEXT,
  observacoes         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_cr_status ON fin_contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_fin_cr_vencimento ON fin_contas_receber(data_vencimento);

-- ── 6. Documentos Financeiros (anexos) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_documentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referência polimórfica
  entity_type     VARCHAR(20) NOT NULL CHECK (entity_type IN ('cp','cr','pedido')),
  entity_id       UUID NOT NULL,
  -- Documento
  tipo            VARCHAR(30) NOT NULL
                  CHECK (tipo IN (
                    'ordem_compra','contrato','boleto','fatura',
                    'nota_fiscal','recibo','comprovante',
                    'relatorio_pagamento','extrato_bancario','outro'
                  )),
  nome_arquivo    TEXT NOT NULL,
  arquivo_url     TEXT NOT NULL,
  mime_type       VARCHAR(50),
  tamanho_bytes   BIGINT,
  -- Audit
  uploaded_by     UUID,
  uploaded_at     TIMESTAMPTZ DEFAULT now(),
  observacao      TEXT
);

CREATE INDEX IF NOT EXISTS idx_fin_docs_entity ON fin_documentos(entity_type, entity_id);

-- ── 7. Aprovação de Pagamento (entidade genérica) ────────────────────────────
-- Estende o conceito de apr_aprovacoes para pagamentos
ALTER TABLE apr_aprovacoes
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20) DEFAULT 'requisicao'
    CHECK (entity_type IN ('requisicao','pagamento','cotacao')),
  ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Backfill: preencher entity_id com requisicao_id para registros existentes
UPDATE apr_aprovacoes
SET entity_id = requisicao_id, entity_type = 'requisicao'
WHERE entity_id IS NULL AND requisicao_id IS NOT NULL;

-- ── 8. RPC: Dashboard Financeiro ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_financeiro(
  p_periodo TEXT DEFAULT '30d'
)
RETURNS JSON AS $$
DECLARE
  dt_inicio DATE;
  result JSON;
BEGIN
  dt_inicio := CASE p_periodo
    WHEN '7d'  THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN '30d' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN '90d' THEN CURRENT_DATE - INTERVAL '90 days'
    ELSE CURRENT_DATE - INTERVAL '365 days'
  END;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total_cp',             COUNT(*),
        'cp_a_vencer',          COUNT(*) FILTER (WHERE status IN ('previsto','aprovado','aprovado_pgto') AND data_vencimento >= CURRENT_DATE),
        'cp_vencidas',          COUNT(*) FILTER (WHERE status IN ('previsto','aprovado','aprovado_pgto') AND data_vencimento < CURRENT_DATE),
        'cp_pagas_periodo',     COUNT(*) FILTER (WHERE status IN ('pago','conciliado') AND data_pagamento >= dt_inicio),
        'valor_total_aberto',   COALESCE(SUM(valor_original) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado')), 0),
        'valor_pago_periodo',   COALESCE(SUM(valor_pago) FILTER (WHERE status IN ('pago','conciliado') AND data_pagamento >= dt_inicio), 0),
        'valor_a_vencer_7d',    COALESCE(SUM(valor_original) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7), 0),
        'aguardando_aprovacao', COUNT(*) FILTER (WHERE status = 'aguardando_aprovacao'),
        'total_cr',             (SELECT COUNT(*) FROM fin_contas_receber WHERE status NOT IN ('cancelado')),
        'valor_cr_aberto',      (SELECT COALESCE(SUM(valor_original),0) FROM fin_contas_receber WHERE status NOT IN ('recebido','conciliado','cancelado'))
      )
      FROM fin_contas_pagar
    ),
    'por_status', (
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT status, COUNT(*) as total, COALESCE(SUM(valor_original),0) as valor
        FROM fin_contas_pagar
        GROUP BY status
        ORDER BY total DESC
      ) s
    ),
    'por_centro_custo', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM (
        SELECT centro_custo, COUNT(*) as total,
               COALESCE(SUM(valor_original),0) as valor,
               COALESCE(SUM(valor_pago),0) as pago
        FROM fin_contas_pagar
        WHERE centro_custo IS NOT NULL
        GROUP BY centro_custo
        ORDER BY valor DESC
      ) c
    ),
    'vencimentos_proximos', (
      SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json)
      FROM (
        SELECT id, fornecedor_nome, valor_original, data_vencimento, status, natureza
        FROM fin_contas_pagar
        WHERE status NOT IN ('pago','conciliado','cancelado')
          AND data_vencimento <= CURRENT_DATE + 30
        ORDER BY data_vencimento ASC
        LIMIT 20
      ) v
    ),
    'recentes', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
      FROM (
        SELECT id, fornecedor_nome, valor_original, status, data_vencimento,
               centro_custo, natureza, created_at
        FROM fin_contas_pagar
        ORDER BY created_at DESC
        LIMIT 10
      ) r
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 9. RLS policies ──────────────────────────────────────────────────────────
ALTER TABLE cmp_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_documentos ENABLE ROW LEVEL SECURITY;

-- Leitura pública (autenticados)
DROP POLICY IF EXISTS "fornecedores_read" ON cmp_fornecedores;
CREATE POLICY "fornecedores_read" ON cmp_fornecedores
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fin_cp_read" ON fin_contas_pagar;
CREATE POLICY "fin_cp_read" ON fin_contas_pagar
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fin_cr_read" ON fin_contas_receber;
CREATE POLICY "fin_cr_read" ON fin_contas_receber
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fin_docs_read" ON fin_documentos;
CREATE POLICY "fin_docs_read" ON fin_documentos
  FOR SELECT TO authenticated USING (true);

-- Escrita via service_role (n8n)
DROP POLICY IF EXISTS "fornecedores_write" ON cmp_fornecedores;
CREATE POLICY "fornecedores_write" ON cmp_fornecedores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fin_cp_write" ON fin_contas_pagar;
CREATE POLICY "fin_cp_write" ON fin_contas_pagar
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fin_cr_write" ON fin_contas_receber;
CREATE POLICY "fin_cr_write" ON fin_contas_receber
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fin_docs_write" ON fin_documentos;
CREATE POLICY "fin_docs_write" ON fin_documentos
  FOR ALL TO service_role USING (true) WITH CHECK (true);
