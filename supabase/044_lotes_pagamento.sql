-- ════════════════════════════════════════════════════════════════════════════
-- 044 — Lotes de Pagamento (Batch Payment Approval + Partial Decisions)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela principal: Lotes de Pagamento ──────────────────────────────────

CREATE TABLE IF NOT EXISTS fin_lotes_pagamento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_lote     VARCHAR(30) NOT NULL UNIQUE,
  criado_por      VARCHAR(100) NOT NULL,
  criado_por_id   UUID,
  valor_total     NUMERIC(15,2) NOT NULL DEFAULT 0,
  qtd_itens       INT NOT NULL DEFAULT 0,
  status          VARCHAR(30) DEFAULT 'montando'
                  CHECK (status IN (
                    'montando','enviado_aprovacao','parcialmente_aprovado',
                    'aprovado','em_pagamento','pago','cancelado'
                  )),
  observacao       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Tabela de itens do lote ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fin_lote_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id         UUID NOT NULL REFERENCES fin_lotes_pagamento(id) ON DELETE CASCADE,
  cp_id           UUID NOT NULL REFERENCES fin_contas_pagar(id),
  valor           NUMERIC(15,2) NOT NULL,
  decisao         VARCHAR(20) DEFAULT 'pendente'
                  CHECK (decisao IN ('pendente','aprovado','rejeitado')),
  decidido_por    VARCHAR(100),
  decidido_em     TIMESTAMPTZ,
  observacao      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lote_id, cp_id)
);

-- ── 3. FK opcional em fin_contas_pagar ───────────────────────────────────────

ALTER TABLE fin_contas_pagar
  ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES fin_lotes_pagamento(id);

-- ── 4. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_fin_lotes_status      ON fin_lotes_pagamento(status);
CREATE INDEX IF NOT EXISTS idx_fin_lote_itens_lote   ON fin_lote_itens(lote_id);
CREATE INDEX IF NOT EXISTS idx_fin_lote_itens_cp     ON fin_lote_itens(cp_id);
CREATE INDEX IF NOT EXISTS idx_fin_cp_lote           ON fin_contas_pagar(lote_id);

-- ── 5. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE fin_lotes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_lote_itens      ENABLE ROW LEVEL SECURITY;

-- Leitura (autenticados)
CREATE POLICY "fin_lotes_read" ON fin_lotes_pagamento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_lote_itens_read" ON fin_lote_itens
  FOR SELECT TO authenticated USING (true);

-- Escrita (service_role — n8n / triggers)
CREATE POLICY "fin_lotes_write_sr" ON fin_lotes_pagamento
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "fin_lote_itens_write_sr" ON fin_lote_itens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Escrita (authenticated — frontend hooks direto)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fin_lotes_pagamento' AND policyname = 'fin_lotes_write_auth') THEN
    CREATE POLICY "fin_lotes_write_auth" ON fin_lotes_pagamento
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fin_lote_itens' AND policyname = 'fin_lote_itens_write_auth') THEN
    CREATE POLICY "fin_lote_itens_write_auth" ON fin_lote_itens
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  -- Garantir que fin_contas_pagar tem write para authenticated (lote_id update)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fin_contas_pagar' AND policyname = 'fin_cp_write_auth') THEN
    CREATE POLICY "fin_cp_write_auth" ON fin_contas_pagar
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 6. Função: Gerar número sequencial do lote ──────────────────────────────

CREATE OR REPLACE FUNCTION generate_numero_lote()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT 'LP-' || to_char(now(), 'YYYYMM') || '-' ||
    lpad(
      (COALESCE(
        (SELECT COUNT(*) + 1 FROM fin_lotes_pagamento
         WHERE numero_lote LIKE 'LP-' || to_char(now(), 'YYYYMM') || '%'),
        1
      ))::text,
      4, '0'
    );
$$;

-- ── 7. RPC: Resolver status do lote após decisões ───────────────────────────

CREATE OR REPLACE FUNCTION rpc_resolver_lote_status(p_lote_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_total      INT;
  v_aprovados  INT;
  v_rejeitados INT;
  v_pendentes  INT;
  v_new_status TEXT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE decisao = 'aprovado'),
    COUNT(*) FILTER (WHERE decisao = 'rejeitado'),
    COUNT(*) FILTER (WHERE decisao = 'pendente')
  INTO v_total, v_aprovados, v_rejeitados, v_pendentes
  FROM fin_lote_itens
  WHERE lote_id = p_lote_id;

  IF v_total = 0 THEN
    RETURN 'montando';
  END IF;

  IF v_pendentes > 0 THEN
    v_new_status := 'enviado_aprovacao';
  ELSIF v_aprovados = v_total THEN
    v_new_status := 'aprovado';
  ELSIF v_aprovados > 0 THEN
    v_new_status := 'parcialmente_aprovado';
  ELSE
    v_new_status := 'cancelado';
  END IF;

  -- Atualizar status do lote
  UPDATE fin_lotes_pagamento
  SET status = v_new_status, updated_at = now()
  WHERE id = p_lote_id;

  -- CPs aprovados → aprovado_pgto
  UPDATE fin_contas_pagar
  SET status = 'aprovado_pgto',
      aprovado_por = li.decidido_por,
      aprovado_em  = li.decidido_em,
      updated_at   = now()
  FROM fin_lote_itens li
  WHERE fin_contas_pagar.id = li.cp_id
    AND li.lote_id = p_lote_id
    AND li.decisao = 'aprovado'
    AND fin_contas_pagar.status != 'aprovado_pgto';

  -- CPs rejeitados → cancelado
  UPDATE fin_contas_pagar
  SET status = 'cancelado', updated_at = now()
  FROM fin_lote_itens li
  WHERE fin_contas_pagar.id = li.cp_id
    AND li.lote_id = p_lote_id
    AND li.decisao = 'rejeitado'
    AND fin_contas_pagar.status NOT IN ('cancelado','pago','conciliado');

  RETURN v_new_status;
END;
$$;

-- ── 8. RPC: Registrar pagamento em batch ─────────────────────────────────────

CREATE OR REPLACE FUNCTION rpc_registrar_pagamento_batch(
  p_cp_ids UUID[],
  p_data_pagamento DATE DEFAULT CURRENT_DATE
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE fin_contas_pagar
  SET status = 'pago',
      data_pagamento = p_data_pagamento,
      updated_at = now()
  WHERE id = ANY(p_cp_ids)
    AND status = 'aprovado_pgto';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
