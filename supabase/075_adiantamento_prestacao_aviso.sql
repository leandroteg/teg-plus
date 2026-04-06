-- ══════════════════════════════════════════════════════════════════════════════
--  075 · Adiantamentos – Prestação de Contas: rastreio e aviso por e-mail
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Adicionar email do solicitante para facilitar notificações ──────────────
ALTER TABLE desp_adiantamentos
  ADD COLUMN IF NOT EXISTS solicitante_email text;

COMMENT ON COLUMN desp_adiantamentos.solicitante_email IS
  'E-mail do solicitante, armazenado no momento da criação para notificações agendadas';

-- ── 2. Controle de envio de avisos (evitar spam de e-mails repetidos) ─────────
ALTER TABLE desp_adiantamentos
  ADD COLUMN IF NOT EXISTS aviso_prestacao_enviado_em timestamptz;

COMMENT ON COLUMN desp_adiantamentos.aviso_prestacao_enviado_em IS
  'Última vez em que o aviso de prestação vencida foi enviado ao solicitante';

-- ── 3. View: adiantamentos com prestação vencida ─────────────────────────────
--    Usada pelo n8n (cron diário) para identificar quem deve receber aviso.
--    Condição: status = prestacao_pendente E data_limite_prestacao < hoje
--    E (aviso não enviado hoje ainda OU nunca enviado)
CREATE OR REPLACE VIEW desp_adiantamentos_prestacao_vencida AS
SELECT
  id,
  numero,
  solicitante_id,
  solicitante_nome,
  solicitante_email,
  gestor_nome,
  gestor_email,
  favorecido_nome,
  valor_solicitado,
  data_pagamento,
  data_limite_prestacao,
  status,
  (current_date - data_limite_prestacao)::int AS dias_vencido,
  aviso_prestacao_enviado_em
FROM desp_adiantamentos
WHERE
  status = 'prestacao_pendente'
  AND data_limite_prestacao IS NOT NULL
  AND data_limite_prestacao < current_date
  AND (
    aviso_prestacao_enviado_em IS NULL
    OR aviso_prestacao_enviado_em::date < current_date
  );

GRANT SELECT ON desp_adiantamentos_prestacao_vencida TO service_role;
GRANT SELECT ON desp_adiantamentos_prestacao_vencida TO authenticated;

-- ── 4. Função RPC: marcar aviso enviado (chamada pelo n8n após disparar e-mail) ─
CREATE OR REPLACE FUNCTION desp_marcar_aviso_prestacao(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE desp_adiantamentos
  SET aviso_prestacao_enviado_em = now(),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION desp_marcar_aviso_prestacao IS
  'Registra o timestamp do envio do aviso de prestação vencida. Chamada pelo n8n após disparar o e-mail.';

GRANT EXECUTE ON FUNCTION desp_marcar_aviso_prestacao(uuid) TO service_role;

-- ── 5. Transição automática aprovado → prestacao_pendente após data_pagamento ──
--    Quando o status é 'aprovado' e a data_pagamento já passou, o sistema
--    considera que o pagamento foi realizado e muda para prestacao_pendente.
--    O n8n ou um pg_cron pode chamar esta função diariamente.
CREATE OR REPLACE FUNCTION desp_atualizar_status_apos_pagamento()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE desp_adiantamentos
  SET status = 'prestacao_pendente',
      updated_at = now()
  WHERE status = 'aprovado'
    AND data_pagamento IS NOT NULL
    AND data_pagamento <= current_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION desp_atualizar_status_apos_pagamento IS
  'Transiciona adiantamentos aprovados para prestacao_pendente quando a data de pagamento chegou. '
  'Deve ser chamada diariamente pelo n8n ou pg_cron.';

GRANT EXECUTE ON FUNCTION desp_atualizar_status_apos_pagamento() TO service_role;

-- ── 6. pg_cron: executar transição de status diariamente às 07h (BRT = UTC-3) ─
--    Requer extensão pg_cron ativa no projeto Supabase.
--    Descomente as linhas abaixo se pg_cron estiver habilitado:
--
-- SELECT cron.schedule(
--   'adiantamentos-transicao-status-diaria',
--   '0 10 * * *',   -- 10:00 UTC = 07:00 BRT
--   $$SELECT desp_atualizar_status_apos_pagamento()$$
-- );
