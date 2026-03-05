-- ══════════════════════════════════════════════════════════════════════════════
-- 024_contratos_gestao.sql — Gestão de Contratos com Parcelas e Fluxo Financeiro
-- TEG+ ERP
-- ══════════════════════════════════════════════════════════════════════════════
-- Estende o módulo 022_contratos.sql com:
--   - Vínculo a fornecedor (cmp_fornecedores)
--   - Itens de contrato
--   - Parcelas recorrentes ou personalizadas (a pagar / a receber)
--   - Geração automática de previsão no financeiro
--   - Fluxo de liberação de pagamento/recebimento com anexo de NF/medição
-- Depende de: 022_contratos.sql, 011_schema_financeiro.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Ampliar con_contratos para suportar contratos de fornecedor ──────────
ALTER TABLE con_contratos
  ADD COLUMN IF NOT EXISTS tipo_contrato   VARCHAR(20) DEFAULT 'receita'
    CHECK (tipo_contrato IN ('receita', 'despesa')),
  ADD COLUMN IF NOT EXISTS fornecedor_id   UUID REFERENCES cmp_fornecedores(id),
  ADD COLUMN IF NOT EXISTS centro_custo    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS classe_financeira VARCHAR(50),
  ADD COLUMN IF NOT EXISTS recorrencia     VARCHAR(20) DEFAULT 'personalizado'
    CHECK (recorrencia IN ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'personalizado')),
  ADD COLUMN IF NOT EXISTS dia_vencimento  INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS parcelas_geradas BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_con_cont_fornecedor ON con_contratos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_con_cont_tipo       ON con_contratos(tipo_contrato);

-- ── 2. Itens do Contrato ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_contrato_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id     UUID REFERENCES con_contratos(id) ON DELETE CASCADE NOT NULL,
  -- Item
  codigo          VARCHAR(30),
  descricao       TEXT NOT NULL,
  unidade         VARCHAR(20),
  quantidade      NUMERIC(12,4) NOT NULL DEFAULT 1,
  valor_unitario  NUMERIC(15,4) NOT NULL,
  valor_total     NUMERIC(15,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  -- Audit
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_con_itens_contrato ON con_contrato_itens(contrato_id);

-- ── 3. Parcelas (Recorrentes ou Personalizadas) ────────────────────────────
CREATE TABLE IF NOT EXISTS con_parcelas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id         UUID REFERENCES con_contratos(id) ON DELETE CASCADE NOT NULL,
  numero              INTEGER NOT NULL,           -- sequência: 1, 2, 3...
  -- Valores
  valor               NUMERIC(15,2) NOT NULL,
  -- Datas
  data_vencimento     DATE NOT NULL,
  -- Status do fluxo
  status              VARCHAR(30) DEFAULT 'previsto'
    CHECK (status IN (
      'previsto',            -- gerada, aguardando data
      'pendente',            -- data chegou, aguarda liberação
      'liberado',            -- liberado para pagamento/recebimento
      'pago',                -- pago/recebido
      'cancelado'
    )),
  -- Liberação
  liberado_em         TIMESTAMPTZ,
  liberado_por        TEXT,
  -- Pagamento/Recebimento
  data_pagamento      DATE,
  pago_em             TIMESTAMPTZ,
  -- Documentos
  nf_numero           VARCHAR(30),
  nf_url              TEXT,
  medicao_url         TEXT,
  recibo_url          TEXT,
  observacoes         TEXT,
  -- Vínculo financeiro
  fin_cp_id           UUID,    -- referência a fin_contas_pagar (se despesa)
  fin_cr_id           UUID,    -- referência a fin_contas_receber (se receita)
  -- Audit
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_con_parc_contrato    ON con_parcelas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_parc_vencimento  ON con_parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_con_parc_status      ON con_parcelas(status);

-- ── 4. Anexos de Parcela ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_parcela_anexos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id      UUID REFERENCES con_parcelas(id) ON DELETE CASCADE NOT NULL,
  tipo            VARCHAR(30) NOT NULL
    CHECK (tipo IN ('nota_fiscal', 'medicao', 'recibo', 'comprovante', 'outro')),
  nome_arquivo    TEXT NOT NULL,
  url             TEXT NOT NULL,
  mime_type       VARCHAR(50),
  tamanho_bytes   BIGINT,
  uploaded_by     UUID,
  uploaded_at     TIMESTAMPTZ DEFAULT now(),
  observacao      TEXT
);

CREATE INDEX IF NOT EXISTS idx_con_parc_anex ON con_parcela_anexos(parcela_id);

-- ── 5. Trigger: updated_at para parcelas ────────────────────────────────────
CREATE OR REPLACE TRIGGER trg_con_parc_updated
  BEFORE UPDATE ON con_parcelas
  FOR EACH ROW EXECUTE FUNCTION con_set_updated_at();

-- ── 6. Função: Gerar parcelas recorrentes ──────────────────────────────────
CREATE OR REPLACE FUNCTION con_gerar_parcelas_recorrentes(p_contrato_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_contrato    con_contratos%ROWTYPE;
  v_interval    INTERVAL;
  v_data        DATE;
  v_num         INTEGER := 0;
  v_valor_parc  NUMERIC(15,2);
  v_total_parc  INTEGER;
BEGIN
  SELECT * INTO v_contrato FROM con_contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contrato.parcelas_geradas THEN RETURN 0; END IF;
  IF v_contrato.recorrencia = 'personalizado' THEN RETURN 0; END IF;

  -- Determinar intervalo
  v_interval := CASE v_contrato.recorrencia
    WHEN 'mensal'     THEN INTERVAL '1 month'
    WHEN 'bimestral'  THEN INTERVAL '2 months'
    WHEN 'trimestral' THEN INTERVAL '3 months'
    WHEN 'semestral'  THEN INTERVAL '6 months'
    WHEN 'anual'      THEN INTERVAL '1 year'
  END;

  -- Calcular número de parcelas e valor
  v_data := v_contrato.data_inicio;
  v_total_parc := 0;
  WHILE v_data <= v_contrato.data_fim_previsto LOOP
    v_total_parc := v_total_parc + 1;
    v_data := v_data + v_interval;
  END LOOP;

  IF v_total_parc = 0 THEN RETURN 0; END IF;
  v_valor_parc := ROUND(v_contrato.valor_total / v_total_parc, 2);

  -- Gerar parcelas
  v_data := v_contrato.data_inicio;
  WHILE v_data <= v_contrato.data_fim_previsto LOOP
    v_num := v_num + 1;

    -- Ajustar dia de vencimento se especificado
    IF v_contrato.dia_vencimento IS NOT NULL THEN
      v_data := make_date(
        EXTRACT(YEAR FROM v_data)::INTEGER,
        EXTRACT(MONTH FROM v_data)::INTEGER,
        LEAST(v_contrato.dia_vencimento, EXTRACT(DAY FROM (date_trunc('month', v_data) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER)
      );
    END IF;

    INSERT INTO con_parcelas (contrato_id, numero, valor, data_vencimento, status)
    VALUES (p_contrato_id, v_num, v_valor_parc, v_data, 'previsto');

    v_data := (date_trunc('month', v_data) + v_interval)::DATE;
    IF v_contrato.dia_vencimento IS NOT NULL THEN
      v_data := make_date(
        EXTRACT(YEAR FROM v_data)::INTEGER,
        EXTRACT(MONTH FROM v_data)::INTEGER,
        LEAST(v_contrato.dia_vencimento, EXTRACT(DAY FROM (date_trunc('month', v_data) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER)
      );
    END IF;
  END LOOP;

  -- Marcar como gerado
  UPDATE con_contratos SET parcelas_geradas = true WHERE id = p_contrato_id;

  RETURN v_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Função: Gerar previsão financeira ao criar parcela ──────────────────
-- Ao inserir parcela, cria automaticamente registro em fin_contas_pagar ou
-- fin_contas_receber com status 'previsto'.
CREATE OR REPLACE FUNCTION con_criar_previsao_financeira()
RETURNS TRIGGER AS $$
DECLARE
  v_contrato  con_contratos%ROWTYPE;
  v_fin_id    UUID;
BEGIN
  SELECT * INTO v_contrato FROM con_contratos WHERE id = NEW.contrato_id;

  IF v_contrato.tipo_contrato = 'despesa' THEN
    -- Contas a Pagar
    INSERT INTO fin_contas_pagar (
      fornecedor_id, fornecedor_nome, valor_original,
      data_emissao, data_vencimento, data_vencimento_orig,
      status, centro_custo, classe_financeira,
      natureza, descricao
    ) VALUES (
      v_contrato.fornecedor_id,
      COALESCE(
        (SELECT razao_social FROM cmp_fornecedores WHERE id = v_contrato.fornecedor_id),
        (SELECT nome FROM con_clientes WHERE id = v_contrato.cliente_id),
        'Contrato ' || v_contrato.numero
      ),
      NEW.valor,
      CURRENT_DATE,
      NEW.data_vencimento,
      NEW.data_vencimento,
      'previsto',
      v_contrato.centro_custo,
      v_contrato.classe_financeira,
      'contrato',
      'Contrato ' || v_contrato.numero || ' — Parcela ' || NEW.numero
    )
    RETURNING id INTO v_fin_id;

    UPDATE con_parcelas SET fin_cp_id = v_fin_id WHERE id = NEW.id;

  ELSIF v_contrato.tipo_contrato = 'receita' THEN
    -- Contas a Receber
    INSERT INTO fin_contas_receber (
      cliente_nome, cliente_cnpj,
      valor_original, data_emissao, data_vencimento,
      status, centro_custo, classe_financeira,
      natureza, descricao
    ) VALUES (
      COALESCE(
        (SELECT nome FROM con_clientes WHERE id = v_contrato.cliente_id),
        'Contrato ' || v_contrato.numero
      ),
      (SELECT cnpj FROM con_clientes WHERE id = v_contrato.cliente_id),
      NEW.valor,
      CURRENT_DATE,
      NEW.data_vencimento,
      'previsto',
      v_contrato.centro_custo,
      v_contrato.classe_financeira,
      'contrato',
      'Contrato ' || v_contrato.numero || ' — Parcela ' || NEW.numero
    )
    RETURNING id INTO v_fin_id;

    UPDATE con_parcelas SET fin_cr_id = v_fin_id WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_con_criar_previsao
  AFTER INSERT ON con_parcelas
  FOR EACH ROW EXECUTE FUNCTION con_criar_previsao_financeira();

-- ── 8. Função: Atualizar financeiro ao liberar parcela ─────────────────────
-- Quando status muda para 'liberado', atualiza fin_contas_pagar/cr
-- Quando status muda para 'pago', marca como pago no financeiro
CREATE OR REPLACE FUNCTION con_atualizar_financeiro_parcela()
RETURNS TRIGGER AS $$
BEGIN
  -- Liberação
  IF NEW.status = 'liberado' AND OLD.status != 'liberado' THEN
    IF NEW.fin_cp_id IS NOT NULL THEN
      UPDATE fin_contas_pagar SET
        status = 'aguardando_aprovacao',
        updated_at = now()
      WHERE id = NEW.fin_cp_id;
    END IF;
    IF NEW.fin_cr_id IS NOT NULL THEN
      UPDATE fin_contas_receber SET
        status = 'faturado',
        updated_at = now()
      WHERE id = NEW.fin_cr_id;
    END IF;
  END IF;

  -- Pagamento / Recebimento
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.fin_cp_id IS NOT NULL THEN
      UPDATE fin_contas_pagar SET
        status = 'pago',
        data_pagamento = COALESCE(NEW.data_pagamento, CURRENT_DATE),
        valor_pago = NEW.valor,
        updated_at = now()
      WHERE id = NEW.fin_cp_id;
    END IF;
    IF NEW.fin_cr_id IS NOT NULL THEN
      UPDATE fin_contas_receber SET
        status = 'recebido',
        data_recebimento = COALESCE(NEW.data_pagamento, CURRENT_DATE),
        valor_recebido = NEW.valor,
        updated_at = now()
      WHERE id = NEW.fin_cr_id;
    END IF;
  END IF;

  -- Cancelamento
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    IF NEW.fin_cp_id IS NOT NULL THEN
      UPDATE fin_contas_pagar SET status = 'cancelado', updated_at = now()
      WHERE id = NEW.fin_cp_id;
    END IF;
    IF NEW.fin_cr_id IS NOT NULL THEN
      UPDATE fin_contas_receber SET status = 'cancelado', updated_at = now()
      WHERE id = NEW.fin_cr_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_con_fin_parcela
  AFTER UPDATE ON con_parcelas
  FOR EACH ROW EXECUTE FUNCTION con_atualizar_financeiro_parcela();

-- ── 9. Função cron: Marcar parcelas previstas como pendentes ───────────────
-- Deve ser chamada diariamente (via n8n ou pg_cron).
-- Parcelas com data_vencimento <= hoje e status 'previsto' viram 'pendente'.
CREATE OR REPLACE FUNCTION con_verificar_parcelas_vencendo()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE con_parcelas
  SET status = 'pendente', updated_at = now()
  WHERE status = 'previsto'
    AND data_vencimento <= CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 10. RPC: Dashboard de Contratos Gestão ─────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_contratos_gestao()
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'resumo', (
      SELECT json_build_object(
        'total_contratos',         COUNT(*),
        'vigentes',                COUNT(*) FILTER (WHERE status = 'vigente'),
        'contratos_receita',       COUNT(*) FILTER (WHERE tipo_contrato = 'receita'),
        'contratos_despesa',       COUNT(*) FILTER (WHERE tipo_contrato = 'despesa'),
        'valor_total_receita',     COALESCE(SUM(valor_total) FILTER (WHERE tipo_contrato = 'receita'), 0),
        'valor_total_despesa',     COALESCE(SUM(valor_total) FILTER (WHERE tipo_contrato = 'despesa'), 0)
      )
      FROM con_contratos WHERE status IN ('vigente','assinado')
    ),
    'parcelas', (
      SELECT json_build_object(
        'previstas',   COUNT(*) FILTER (WHERE status = 'previsto'),
        'pendentes',   COUNT(*) FILTER (WHERE status = 'pendente'),
        'liberadas',   COUNT(*) FILTER (WHERE status = 'liberado'),
        'pagas',       COUNT(*) FILTER (WHERE status = 'pago'),
        'valor_pendente', COALESCE(SUM(valor) FILTER (WHERE status = 'pendente'), 0),
        'valor_liberado', COALESCE(SUM(valor) FILTER (WHERE status = 'liberado'), 0)
      )
      FROM con_parcelas
      WHERE contrato_id IN (SELECT id FROM con_contratos WHERE status IN ('vigente','assinado'))
    ),
    'proximas_parcelas', (
      SELECT COALESCE(json_agg(row_to_json(p)), '[]'::json)
      FROM (
        SELECT
          cp.id, cp.numero, cp.valor, cp.data_vencimento, cp.status,
          c.numero AS contrato_numero, c.objeto AS contrato_objeto,
          c.tipo_contrato,
          COALESCE(
            (SELECT razao_social FROM cmp_fornecedores WHERE id = c.fornecedor_id),
            (SELECT nome FROM con_clientes WHERE id = c.cliente_id)
          ) AS contraparte
        FROM con_parcelas cp
        JOIN con_contratos c ON c.id = cp.contrato_id
        WHERE cp.status IN ('previsto','pendente','liberado')
          AND cp.data_vencimento <= CURRENT_DATE + 30
        ORDER BY cp.data_vencimento ASC
        LIMIT 20
      ) p
    ),
    'alertas_ativos', (
      SELECT COUNT(*) FROM con_alertas WHERE status = 'pendente'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 11. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE con_contrato_itens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_parcelas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE con_parcela_anexos  ENABLE ROW LEVEL SECURITY;

-- Leitura
CREATE POLICY "con_itens_read"  ON con_contrato_itens  FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_parc_read"   ON con_parcelas        FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_panex_read"  ON con_parcela_anexos   FOR SELECT TO authenticated USING (true);

-- Escrita
CREATE POLICY "con_itens_write"  ON con_contrato_itens  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "con_parc_write"   ON con_parcelas        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "con_panex_write"  ON con_parcela_anexos   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket para anexos de parcelas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contratos-anexos',
  'contratos-anexos',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS "contratos_anexos_storage_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contratos-anexos');

CREATE POLICY IF NOT EXISTS "contratos_anexos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratos-anexos');

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM 024_contratos_gestao.sql
-- ══════════════════════════════════════════════════════════════════════════════
