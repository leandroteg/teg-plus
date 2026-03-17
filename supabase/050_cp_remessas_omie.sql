-- Migration 050: Remessas CP via IME/Omie
-- Adds remittance metadata to fin_contas_pagar and helper RPCs for
-- sending, tracking, and manually overriding payment confirmations.

ALTER TABLE fin_contas_pagar
  ADD COLUMN IF NOT EXISTS remessa_status VARCHAR(30)
    CHECK (remessa_status IN (
      'nao_enviada',
      'enviada',
      'processando',
      'confirmada',
      'confirmada_manual',
      'erro'
    )),
  ADD COLUMN IF NOT EXISTS remessa_id TEXT,
  ADD COLUMN IF NOT EXISTS remessa_enviada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remessa_retorno_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remessa_sync_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remessa_payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS remessa_retorno JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS remessa_erro TEXT;

UPDATE fin_contas_pagar
SET remessa_status = CASE
  WHEN status = 'em_pagamento' THEN 'processando'
  WHEN status IN ('pago', 'conciliado') THEN 'confirmada'
  ELSE 'nao_enviada'
END
WHERE remessa_status IS NULL;

ALTER TABLE fin_contas_pagar
  ALTER COLUMN remessa_status SET DEFAULT 'nao_enviada';

CREATE INDEX IF NOT EXISTS idx_fin_cp_remessa_status
  ON fin_contas_pagar(remessa_status);

CREATE INDEX IF NOT EXISTS idx_fin_cp_remessa_id
  ON fin_contas_pagar(remessa_id)
  WHERE remessa_id IS NOT NULL;

CREATE OR REPLACE FUNCTION rpc_marcar_cp_remessa_batch(
  p_cp_ids UUID[],
  p_remessa_id TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE fin_contas_pagar
  SET status = 'em_pagamento',
      remessa_status = 'processando',
      remessa_id = COALESCE(NULLIF(p_remessa_id, ''), remessa_id, 'REM-' || replace(gen_random_uuid()::text, '-', '')),
      remessa_enviada_em = COALESCE(remessa_enviada_em, now()),
      remessa_sync_em = now(),
      remessa_payload = COALESCE(p_payload, '{}'::jsonb),
      remessa_retorno = '{}'::jsonb,
      remessa_erro = NULL,
      updated_at = now()
  WHERE id = ANY(p_cp_ids)
    AND status = 'aprovado_pgto';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_processar_retorno_cp_remessa(
  p_remessa_id TEXT,
  p_status TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_data_pagamento DATE DEFAULT CURRENT_DATE,
  p_obs TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status TEXT := lower(COALESCE(p_status, ''));
  v_count INT := 0;
BEGIN
  IF COALESCE(p_remessa_id, '') = '' THEN
    RAISE EXCEPTION 'p_remessa_id is required';
  END IF;

  IF v_status IN ('confirmada', 'confirmado', 'pago', 'sucesso', 'success') THEN
    UPDATE fin_contas_pagar
    SET status = 'pago',
        valor_pago = COALESCE(NULLIF(valor_pago, 0), valor_original),
        data_pagamento = COALESCE(data_pagamento, p_data_pagamento),
        remessa_status = 'confirmada',
        remessa_retorno_em = now(),
        remessa_sync_em = now(),
        remessa_retorno = COALESCE(p_payload, '{}'::jsonb),
        remessa_erro = NULL,
        updated_at = now()
    WHERE remessa_id = p_remessa_id
      AND status = 'em_pagamento';
  ELSIF v_status IN ('erro', 'error', 'falha', 'failed', 'rejeitada', 'rejeitado') THEN
    UPDATE fin_contas_pagar
    SET remessa_status = 'erro',
        remessa_retorno_em = now(),
        remessa_sync_em = now(),
        remessa_retorno = COALESCE(p_payload, '{}'::jsonb),
        remessa_erro = COALESCE(p_obs, p_payload ->> 'message', p_payload ->> 'erro', p_payload ->> 'error'),
        updated_at = now()
    WHERE remessa_id = p_remessa_id
      AND status = 'em_pagamento';
  ELSE
    UPDATE fin_contas_pagar
    SET remessa_status = 'processando',
        remessa_sync_em = now(),
        remessa_retorno = COALESCE(p_payload, remessa_retorno, '{}'::jsonb),
        updated_at = now()
    WHERE remessa_id = p_remessa_id
      AND status = 'em_pagamento';
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_registrar_pagamento_batch(
  p_cp_ids UUID[],
  p_data_pagamento DATE DEFAULT CURRENT_DATE
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE fin_contas_pagar
  SET status = 'pago',
      valor_pago = COALESCE(NULLIF(valor_pago, 0), valor_original),
      data_pagamento = p_data_pagamento,
      remessa_status = CASE
        WHEN status = 'em_pagamento' THEN 'confirmada_manual'
        WHEN remessa_id IS NOT NULL THEN COALESCE(remessa_status, 'confirmada_manual')
        ELSE COALESCE(remessa_status, 'nao_enviada')
      END,
      remessa_retorno_em = CASE
        WHEN status = 'em_pagamento' THEN now()
        ELSE remessa_retorno_em
      END,
      remessa_sync_em = CASE
        WHEN status = 'em_pagamento' THEN now()
        ELSE remessa_sync_em
      END,
      remessa_erro = NULL,
      updated_at = now()
  WHERE id = ANY(p_cp_ids)
    AND status IN ('aprovado_pgto', 'em_pagamento');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

INSERT INTO sys_config (chave, valor, descricao, updated_at)
SELECT cfg.chave, cfg.valor, cfg.descricao, now()
FROM (
  VALUES
    ('cp_remessa_webhook_url', '', 'Webhook para envio de remessas CP ao IME/Omie'),
    ('cp_remessa_status_webhook_url', '', 'Webhook para consulta de retorno de remessas CP no IME/Omie')
) AS cfg(chave, valor, descricao)
WHERE NOT EXISTS (
  SELECT 1
  FROM sys_config existing
  WHERE existing.chave = cfg.chave
);
