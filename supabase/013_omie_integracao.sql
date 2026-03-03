-- ══════════════════════════════════════════════════════════════════════════════
-- 013_omie_integracao.sql — Integração Omie ERP · TEG+ ERP
-- ══════════════════════════════════════════════════════════════════════════════
-- Tabelas : sys_config, fin_sync_log
-- Funções : get_omie_config()
-- RLS     : sys_config (admin only), fin_sync_log (leitura autenticados)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela de Configurações do Sistema ────────────────────────────────────
-- Armazena chaves/valores de configuração de integrações externas.
-- Sensível: acesso restrito a administradores via RLS.

CREATE TABLE IF NOT EXISTS sys_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       VARCHAR(100) UNIQUE NOT NULL,  -- ex.: 'omie_app_key', 'omie_app_secret'
  valor       TEXT,                           -- valor da configuração (pode ser nulo enquanto não cadastrado)
  descricao   TEXT,                           -- descrição legível da chave
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  UUID                            -- auth.uid() do admin que atualizou por último
);

CREATE INDEX IF NOT EXISTS idx_sys_config_chave ON sys_config(chave);

-- ── 2. Tabela de Log de Sincronizações Omie ──────────────────────────────────
-- Registra cada execução de sincronização disparada pelo n8n ou manualmente.
-- Permite ao frontend exibir o status da última sincronização por domínio.

CREATE TABLE IF NOT EXISTS fin_sync_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dominio       VARCHAR(50) NOT NULL,          -- 'fornecedores', 'contas_pagar', 'contas_receber'
  status        VARCHAR(20) NOT NULL DEFAULT 'success'
                  CHECK (status IN ('running', 'success', 'error')),
  registros     INTEGER DEFAULT 0,             -- quantidade de registros processados
  mensagem      TEXT,                          -- detalhe do resultado ou mensagem de erro
  executado_em  TIMESTAMPTZ DEFAULT now(),
  executado_por VARCHAR(100) DEFAULT 'n8n'    -- 'n8n', 'manual', ou email do usuário
);

CREATE INDEX IF NOT EXISTS idx_sync_log_dominio     ON fin_sync_log(dominio);
CREATE INDEX IF NOT EXISTS idx_sync_log_executado_em ON fin_sync_log(executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_status       ON fin_sync_log(status);

-- ── 3. RLS — sys_config ───────────────────────────────────────────────────────
-- Apenas administradores podem ler ou modificar configurações do sistema.

ALTER TABLE sys_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sys_config_admin_read"  ON sys_config;
DROP POLICY IF EXISTS "sys_config_admin_write" ON sys_config;

-- Leitura: somente admin
-- Usa is_admin() (SECURITY DEFINER) para evitar recursão infinita em RLS
CREATE POLICY "sys_config_admin_read" ON sys_config
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- Escrita (INSERT / UPDATE / DELETE): somente admin
CREATE POLICY "sys_config_admin_write" ON sys_config
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Acesso irrestrito pelo service_role (usado pelo n8n para salvar resultados)
DROP POLICY IF EXISTS "sys_config_service_role" ON sys_config;
CREATE POLICY "sys_config_service_role" ON sys_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 4. RLS — fin_sync_log ────────────────────────────────────────────────────
-- Qualquer usuário autenticado pode ler o log de sincronizações.
-- Somente o service_role (n8n) pode inserir/atualizar registros de log.

ALTER TABLE fin_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_log_read"         ON fin_sync_log;
DROP POLICY IF EXISTS "sync_log_user_insert"  ON fin_sync_log;
DROP POLICY IF EXISTS "sync_log_service_role" ON fin_sync_log;

-- Leitura: todos os usuários autenticados
CREATE POLICY "sync_log_read" ON fin_sync_log
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT manual pelo próprio usuário autenticado (acionamento pelo frontend)
CREATE POLICY "sync_log_user_insert" ON fin_sync_log
  FOR INSERT
  TO authenticated
  WITH CHECK (executado_por = 'manual');

-- Acesso total pelo service_role (n8n grava resultados da sync)
CREATE POLICY "sync_log_service_role" ON fin_sync_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 5. Função get_omie_config() ───────────────────────────────────────────────
-- Retorna as credenciais Omie como JSON para uso seguro pelo n8n.
-- SECURITY DEFINER: executa com privilégios do proprietário (postgres / supabase),
-- contornando o RLS — o n8n chama via service_role key, não precisa ser admin.
-- Expõe apenas as chaves estritamente necessárias para a integração.

CREATE OR REPLACE FUNCTION get_omie_config()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_key    TEXT;
  v_app_secret TEXT;
BEGIN
  SELECT valor INTO v_app_key
  FROM sys_config
  WHERE chave = 'omie_app_key';

  SELECT valor INTO v_app_secret
  FROM sys_config
  WHERE chave = 'omie_app_secret';

  RETURN json_build_object(
    'omie_app_key',    v_app_key,
    'omie_app_secret', v_app_secret
  );
END;
$$;

-- Revogar execução pública e conceder explicitamente apenas a roles necessárias
REVOKE EXECUTE ON FUNCTION get_omie_config() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_omie_config() TO authenticated;
GRANT  EXECUTE ON FUNCTION get_omie_config() TO service_role;

-- ── 6. Seed de chaves de configuração ────────────────────────────────────────
-- Insere as chaves conhecidas sem valor (ON CONFLICT DO NOTHING para ser idempotente).

INSERT INTO sys_config (chave, descricao) VALUES
  ('omie_app_key',    'Chave de integração Omie ERP'),
  ('omie_app_secret', 'Secret de integração Omie ERP'),
  ('n8n_webhook_url', 'URL base do n8n para webhooks'),
  ('omie_enabled',    'Integração Omie ativa (true/false)')
ON CONFLICT (chave) DO NOTHING;
