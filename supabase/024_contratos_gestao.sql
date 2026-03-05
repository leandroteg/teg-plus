-- ═════════════════════════════════════════════════════════════════════════════
-- 024 — Módulo de Contratos (Gestão de Contratos e Parcelas)
-- TEG+ ERP — Aplicado em produção 2026-03-05
-- ═════════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tipo_contrato AS ENUM ('receita', 'despesa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_contrato AS ENUM (
    'em_negociacao', 'assinado', 'vigente',
    'suspenso', 'encerrado', 'rescindido'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE recorrencia_contrato AS ENUM (
    'mensal', 'bimestral', 'trimestral',
    'semestral', 'anual', 'personalizado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_parcela_con AS ENUM (
    'previsto', 'pendente', 'liberado', 'pago', 'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_anexo_parcela AS ENUM (
    'nota_fiscal', 'medicao', 'recibo', 'comprovante', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_cliente AS ENUM ('publico', 'privado', 'governo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 1. con_clientes ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_clientes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  cnpj        text,
  tipo        tipo_cliente NOT NULL DEFAULT 'privado',
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE con_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "con_clientes_all" ON con_clientes
  FOR ALL USING (auth.role() = 'authenticated');

-- ── 2. con_contratos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_contratos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero              text NOT NULL UNIQUE,
  tipo_contrato       tipo_contrato NOT NULL,
  cliente_id          uuid REFERENCES con_clientes(id),
  fornecedor_id       uuid REFERENCES cmp_fornecedores(id),
  obra_id             uuid REFERENCES sys_obras(id),
  objeto              text NOT NULL,
  descricao           text,
  valor_total         numeric(15,2) NOT NULL DEFAULT 0,
  valor_aditivos      numeric(15,2) NOT NULL DEFAULT 0,
  valor_glosado       numeric(15,2) NOT NULL DEFAULT 0,
  valor_medido        numeric(15,2) NOT NULL DEFAULT 0,
  valor_a_medir       numeric(15,2) NOT NULL DEFAULT 0,
  data_assinatura     date,
  data_inicio         date NOT NULL,
  data_fim_previsto   date NOT NULL,
  data_fim_real       date,
  recorrencia         recorrencia_contrato NOT NULL DEFAULT 'mensal',
  dia_vencimento      int CHECK (dia_vencimento BETWEEN 1 AND 31),
  parcelas_geradas    boolean NOT NULL DEFAULT false,
  centro_custo        text,
  classe_financeira   text,
  indice_reajuste     text,
  garantia_tipo       text,
  garantia_valor      numeric(15,2),
  garantia_vencimento date,
  status              status_contrato NOT NULL DEFAULT 'em_negociacao',
  arquivo_url         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE con_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "con_contratos_all" ON con_contratos
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_con_contratos_status ON con_contratos(status);
CREATE INDEX IF NOT EXISTS idx_con_contratos_tipo ON con_contratos(tipo_contrato);
CREATE INDEX IF NOT EXISTS idx_con_contratos_cliente ON con_contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_con_contratos_obra ON con_contratos(obra_id);

-- ── 3. con_contrato_itens ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_contrato_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id     uuid NOT NULL REFERENCES con_contratos(id) ON DELETE CASCADE,
  codigo          text,
  descricao       text NOT NULL,
  unidade         text,
  quantidade      numeric(12,4) NOT NULL DEFAULT 1,
  valor_unitario  numeric(15,2) NOT NULL DEFAULT 0,
  valor_total     numeric(15,2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE con_contrato_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "con_contrato_itens_all" ON con_contrato_itens
  FOR ALL USING (auth.role() = 'authenticated');

-- ── 4. con_parcelas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_parcelas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id       uuid NOT NULL REFERENCES con_contratos(id) ON DELETE CASCADE,
  numero            int NOT NULL,
  valor             numeric(15,2) NOT NULL,
  data_vencimento   date NOT NULL,
  status            status_parcela_con NOT NULL DEFAULT 'previsto',
  liberado_em       timestamptz,
  liberado_por      uuid,
  data_pagamento    date,
  pago_em           timestamptz,
  nf_numero         text,
  nf_url            text,
  medicao_url       text,
  recibo_url        text,
  observacoes       text,
  fin_cp_id         uuid REFERENCES fin_contas_pagar(id),
  fin_cr_id         uuid REFERENCES fin_contas_receber(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contrato_id, numero)
);

ALTER TABLE con_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "con_parcelas_all" ON con_parcelas
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_con_parcelas_contrato ON con_parcelas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_con_parcelas_status ON con_parcelas(status);
CREATE INDEX IF NOT EXISTS idx_con_parcelas_vencimento ON con_parcelas(data_vencimento);

-- ── 5. con_parcela_anexos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS con_parcela_anexos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_id      uuid NOT NULL REFERENCES con_parcelas(id) ON DELETE CASCADE,
  tipo            tipo_anexo_parcela NOT NULL DEFAULT 'outro',
  nome_arquivo    text NOT NULL,
  url             text NOT NULL,
  mime_type       text,
  tamanho_bytes   bigint,
  observacao      text,
  uploaded_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE con_parcela_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "con_parcela_anexos_all" ON con_parcela_anexos
  FOR ALL USING (auth.role() = 'authenticated');

-- ── 6. Triggers updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION con_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_con_clientes_updated
  BEFORE UPDATE ON con_clientes
  FOR EACH ROW EXECUTE FUNCTION con_set_updated_at();

CREATE TRIGGER trg_con_contratos_updated
  BEFORE UPDATE ON con_contratos
  FOR EACH ROW EXECUTE FUNCTION con_set_updated_at();

CREATE TRIGGER trg_con_parcelas_updated
  BEFORE UPDATE ON con_parcelas
  FOR EACH ROW EXECUTE FUNCTION con_set_updated_at();

-- ── 7. RPC: Gerar parcelas recorrentes ──────────────────────────────────────
CREATE OR REPLACE FUNCTION con_gerar_parcelas_recorrentes(p_contrato_id uuid)
RETURNS void AS $$
DECLARE
  v_contrato RECORD;
  v_num_parcelas int;
  v_interval interval;
  v_data_base date;
  i int;
BEGIN
  SELECT * INTO v_contrato FROM con_contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  IF v_contrato.parcelas_geradas THEN RETURN; END IF;

  v_interval := CASE v_contrato.recorrencia
    WHEN 'mensal'     THEN '1 month'::interval
    WHEN 'bimestral'  THEN '2 months'::interval
    WHEN 'trimestral' THEN '3 months'::interval
    WHEN 'semestral'  THEN '6 months'::interval
    WHEN 'anual'      THEN '1 year'::interval
    ELSE '1 month'::interval
  END;

  v_num_parcelas := GREATEST(1, CEIL(
    EXTRACT(EPOCH FROM (v_contrato.data_fim_previsto - v_contrato.data_inicio)) /
    EXTRACT(EPOCH FROM v_interval)
  ));
  v_num_parcelas := LEAST(v_num_parcelas, 120);

  v_data_base := v_contrato.data_inicio;
  FOR i IN 1..v_num_parcelas LOOP
    INSERT INTO con_parcelas (contrato_id, numero, valor, data_vencimento, status)
    VALUES (
      p_contrato_id,
      i,
      ROUND(v_contrato.valor_total / v_num_parcelas, 2),
      CASE
        WHEN v_contrato.dia_vencimento IS NOT NULL THEN
          make_date(
            EXTRACT(YEAR FROM v_data_base)::int,
            EXTRACT(MONTH FROM v_data_base)::int,
            LEAST(v_contrato.dia_vencimento, EXTRACT(DAY FROM (date_trunc('month', v_data_base) + '1 month - 1 day'::interval))::int)
          )
        ELSE v_data_base
      END,
      'previsto'
    );
    v_data_base := v_data_base + v_interval;
  END LOOP;

  UPDATE con_contratos SET parcelas_geradas = true WHERE id = p_contrato_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 8. RPC: Dashboard de Contratos ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_contratos_gestao()
RETURNS json AS $$
DECLARE
  v_resumo json;
  v_parcelas json;
  v_proximas json;
  v_alertas int;
BEGIN
  SELECT json_build_object(
    'total_contratos', COUNT(*),
    'vigentes', COUNT(*) FILTER (WHERE status = 'vigente'),
    'contratos_receita', COUNT(*) FILTER (WHERE tipo_contrato = 'receita'),
    'contratos_despesa', COUNT(*) FILTER (WHERE tipo_contrato = 'despesa'),
    'valor_total_receita', COALESCE(SUM(valor_total) FILTER (WHERE tipo_contrato = 'receita'), 0),
    'valor_total_despesa', COALESCE(SUM(valor_total) FILTER (WHERE tipo_contrato = 'despesa'), 0)
  ) INTO v_resumo
  FROM con_contratos
  WHERE status NOT IN ('encerrado', 'rescindido');

  SELECT json_build_object(
    'previstas', COUNT(*) FILTER (WHERE p.status = 'previsto'),
    'pendentes', COUNT(*) FILTER (WHERE p.status = 'pendente'),
    'liberadas', COUNT(*) FILTER (WHERE p.status = 'liberado'),
    'pagas', COUNT(*) FILTER (WHERE p.status = 'pago'),
    'valor_pendente', COALESCE(SUM(p.valor) FILTER (WHERE p.status IN ('previsto','pendente')), 0),
    'valor_liberado', COALESCE(SUM(p.valor) FILTER (WHERE p.status = 'liberado'), 0)
  ) INTO v_parcelas
  FROM con_parcelas p
  JOIN con_contratos c ON c.id = p.contrato_id
  WHERE c.status NOT IN ('encerrado', 'rescindido');

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_proximas
  FROM (
    SELECT
      p.id, p.contrato_id, p.numero, p.valor, p.data_vencimento, p.status,
      c.numero AS contrato_numero,
      c.objeto AS contrato_objeto,
      c.tipo_contrato,
      COALESCE(cl.nome, f.razao_social, 'N/A') AS contraparte
    FROM con_parcelas p
    JOIN con_contratos c ON c.id = p.contrato_id
    LEFT JOIN con_clientes cl ON cl.id = c.cliente_id
    LEFT JOIN cmp_fornecedores f ON f.id = c.fornecedor_id
    WHERE p.status IN ('previsto', 'pendente', 'liberado')
      AND p.data_vencimento <= CURRENT_DATE + 30
    ORDER BY p.data_vencimento
    LIMIT 20
  ) t;

  SELECT COUNT(*) INTO v_alertas
  FROM con_parcelas p
  JOIN con_contratos c ON c.id = p.contrato_id
  WHERE p.status IN ('previsto', 'pendente', 'liberado')
    AND p.data_vencimento < CURRENT_DATE
    AND c.status NOT IN ('encerrado', 'rescindido');

  RETURN json_build_object(
    'resumo', v_resumo,
    'parcelas', v_parcelas,
    'proximas_parcelas', v_proximas,
    'alertas_ativos', v_alertas
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 9. Storage bucket para anexos ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-anexos', 'contratos-anexos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "contratos_anexos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'contratos-anexos' AND auth.role() = 'authenticated');

CREATE POLICY "contratos_anexos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'contratos-anexos');
