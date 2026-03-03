-- =============================================================================
-- Migration 014: Fluxo de Pagamento
-- TEG+ ERP – Supabase PostgreSQL
-- Created: 2026-03-03
--
-- Sections:
--   1. Modify cmp_cotacoes (sem_cotacoes_minimas flag)
--   2. Create cmp_pedidos_anexos table
--   3. Add payment liberation fields to cmp_pedidos
--   4. Supabase Storage bucket for attachments
--   5. RLS policies for cmp_pedidos_anexos
--   6. Trigger: auto-create fin_contas_pagar on pedido INSERT
--   7. Trigger: update fin_contas_pagar on liberar_pagamento
--   8. Helper function: get_alerta_cotacao
-- =============================================================================


-- =============================================================================
-- 1. Modify cmp_cotacoes
--    Add flag to indicate when minimum quotation count was not reached,
--    along with a mandatory justification text.
-- =============================================================================

ALTER TABLE cmp_cotacoes
  ADD COLUMN IF NOT EXISTS sem_cotacoes_minimas     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS justificativa_sem_cotacoes TEXT;


-- =============================================================================
-- 2. Create cmp_pedidos_anexos table
--    Stores file attachments linked to purchase orders (cmp_pedidos).
--    Attachments can originate from the purchasing or finance department.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cmp_pedidos_anexos (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id        UUID        REFERENCES cmp_pedidos(id) ON DELETE CASCADE,
  tipo             VARCHAR(50) NOT NULL
                     CHECK (tipo IN (
                       'nota_fiscal',
                       'comprovante_entrega',
                       'medicao',
                       'comprovante_pagamento',
                       'contrato',
                       'outro'
                     )),
  nome_arquivo     TEXT        NOT NULL,
  url              TEXT        NOT NULL,
  tamanho_bytes    BIGINT,
  mime_type        VARCHAR(50),
  uploaded_by      UUID,
  uploaded_by_nome TEXT,
  origem           VARCHAR(20) DEFAULT 'compras'
                     CHECK (origem IN ('compras', 'financeiro')),
  uploaded_at      TIMESTAMPTZ DEFAULT now(),
  observacao       TEXT
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pedidos_anexos_pedido_id
  ON cmp_pedidos_anexos (pedido_id);

CREATE INDEX IF NOT EXISTS idx_pedidos_anexos_tipo
  ON cmp_pedidos_anexos (tipo);


-- =============================================================================
-- 3. Add payment liberation fields to cmp_pedidos
--    Tracks the lifecycle from purchasing releasing payment to finance marking
--    the order as paid.
-- =============================================================================

ALTER TABLE cmp_pedidos
  ADD COLUMN IF NOT EXISTS status_pagamento        VARCHAR(30)
    CHECK (status_pagamento IN ('liberado', 'pago')),
  ADD COLUMN IF NOT EXISTS liberado_pagamento_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS liberado_pagamento_por  TEXT,
  ADD COLUMN IF NOT EXISTS pago_em                 TIMESTAMPTZ;


-- =============================================================================
-- 4. Supabase Storage bucket for order attachments
--    Private bucket; access controlled via RLS policies below.
--    Max file size: 50 MB (52 428 800 bytes).
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pedidos-anexos',
  'pedidos-anexos',
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

-- Storage RLS: allow authenticated users to read objects in this bucket
CREATE POLICY IF NOT EXISTS "pedidos_anexos_storage_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'pedidos-anexos');

-- Storage RLS: allow authenticated users to upload objects to this bucket
CREATE POLICY IF NOT EXISTS "pedidos_anexos_storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pedidos-anexos');


-- =============================================================================
-- 5. RLS policies for cmp_pedidos_anexos
-- =============================================================================

ALTER TABLE cmp_pedidos_anexos ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all attachment records
CREATE POLICY IF NOT EXISTS "pedidos_anexos_select"
  ON cmp_pedidos_anexos
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert attachment records
CREATE POLICY IF NOT EXISTS "pedidos_anexos_insert"
  ON cmp_pedidos_anexos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- service_role has unrestricted access (bypasses RLS by default in Supabase,
-- but explicit policies are added here for clarity and forward compatibility)
CREATE POLICY IF NOT EXISTS "pedidos_anexos_service_role_all"
  ON cmp_pedidos_anexos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 6. Trigger: auto-create fin_contas_pagar when a pedido is inserted
--    Reads centro_custo and descricao from the linked requisicao.
--    Due date defaults to data_prevista_entrega + 30 days, or today + 30 days.
-- =============================================================================

CREATE OR REPLACE FUNCTION criar_cp_ao_emitir_pedido()
RETURNS TRIGGER AS $$
DECLARE
  v_req      cmp_requisicoes%ROWTYPE;
  v_data_venc DATE;
BEGIN
  -- Idempotency guard: skip if an AP record already exists for this pedido
  IF EXISTS (SELECT 1 FROM fin_contas_pagar WHERE pedido_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Fetch the related requisicao to copy centro_custo and descricao
  SELECT * INTO v_req
  FROM cmp_requisicoes
  WHERE id = NEW.requisicao_id;

  -- Calculate due date: expected delivery + 30 days, or fallback to today + 30
  v_data_venc := COALESCE(NEW.data_prevista_entrega::DATE + 30, CURRENT_DATE + 30);

  INSERT INTO fin_contas_pagar (
    pedido_id,
    requisicao_id,
    fornecedor_nome,
    valor_original,
    data_emissao,
    data_vencimento,
    data_vencimento_orig,
    status,
    centro_custo,
    descricao,
    natureza
  ) VALUES (
    NEW.id,
    NEW.requisicao_id,
    NEW.fornecedor_nome,
    NEW.valor_total,
    CURRENT_DATE,
    v_data_venc,
    v_data_venc,
    'previsto',
    v_req.centro_custo,
    v_req.descricao,
    'material'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_criar_cp_ao_emitir_pedido ON cmp_pedidos;

CREATE TRIGGER trig_criar_cp_ao_emitir_pedido
  AFTER INSERT ON cmp_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION criar_cp_ao_emitir_pedido();


-- =============================================================================
-- 7. Trigger: update fin_contas_pagar when cmp_pedidos.status_pagamento changes
--    - 'liberado' → AP status becomes 'aguardando_aprovacao' (finance review)
--    - 'pago'     → AP status becomes 'pago' and data_pagamento is recorded
-- =============================================================================

CREATE OR REPLACE FUNCTION atualizar_cp_ao_liberar_pagamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Purchasing released the order for payment → awaiting finance approval
  IF NEW.status_pagamento = 'liberado'
     AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento != 'liberado')
  THEN
    UPDATE fin_contas_pagar
    SET
      status     = 'aguardando_aprovacao',
      updated_at = now()
    WHERE pedido_id = NEW.id
      AND status   = 'previsto';
  END IF;

  -- Finance confirmed payment → mark AP record as paid
  IF NEW.status_pagamento = 'pago'
     AND (OLD.status_pagamento IS NULL OR OLD.status_pagamento != 'pago')
  THEN
    UPDATE fin_contas_pagar
    SET
      status         = 'pago',
      data_pagamento = CURRENT_DATE,
      updated_at     = now()
    WHERE pedido_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_atualizar_cp_ao_liberar ON cmp_pedidos;

CREATE TRIGGER trig_atualizar_cp_ao_liberar
  AFTER UPDATE ON cmp_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_cp_ao_liberar_pagamento();


-- =============================================================================
-- 8. Helper function: get_alerta_cotacao
--    Returns a JSONB object indicating whether a requisicao bypassed the
--    minimum quotation requirement, and the associated justification text.
--    Returns {"sem_cotacoes_minimas": false} when no alert exists.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_alerta_cotacao(p_requisicao_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'sem_cotacoes_minimas', COALESCE(c.sem_cotacoes_minimas, false),
    'justificativa',        c.justificativa_sem_cotacoes
  ) INTO v_result
  FROM cmp_cotacoes c
  WHERE c.requisicao_id      = p_requisicao_id
    AND c.sem_cotacoes_minimas = true
  LIMIT 1;

  RETURN COALESCE(v_result, '{"sem_cotacoes_minimas": false}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
