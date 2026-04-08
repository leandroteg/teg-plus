-- ============================================================
-- 068_rbac_v2_papeis_setores.sql
-- RBAC v2 (aditivo): papel global + papel por setor/modulo
-- Seguro para rollout progressivo com fallback no modelo legado
-- ============================================================

-- 1) Papel global em sys_perfis (nao remove role legado)
ALTER TABLE sys_perfis
  ADD COLUMN IF NOT EXISTS papel_global TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sys_perfis_papel_global_check'
  ) THEN
    ALTER TABLE sys_perfis
      ADD CONSTRAINT sys_perfis_papel_global_check
      CHECK (
        papel_global IS NULL OR papel_global IN ('requisitante', 'equipe', 'supervisor', 'diretor', 'ceo')
      );
  END IF;
END $$;

-- Backfill inicial por role legado
UPDATE sys_perfis
SET papel_global = CASE role
  WHEN 'diretor' THEN 'diretor'
  WHEN 'administrador' THEN 'ceo'
  WHEN 'admin' THEN 'ceo'
  WHEN 'gerente' THEN 'diretor'
  WHEN 'gestor' THEN 'equipe'
  WHEN 'aprovador' THEN 'supervisor'
  WHEN 'comprador' THEN 'equipe'
  WHEN 'requisitante' THEN 'requisitante'
  ELSE 'requisitante'
END
WHERE papel_global IS NULL;

ALTER TABLE sys_perfis
  ALTER COLUMN papel_global SET DEFAULT 'requisitante';

CREATE INDEX IF NOT EXISTS idx_sys_perfis_papel_global ON sys_perfis(papel_global);

-- Convites passam a aceitar papel_global (fallback continua em role legado)
ALTER TABLE sys_convites
  ADD COLUMN IF NOT EXISTS papel_global TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sys_convites_papel_global_check'
  ) THEN
    ALTER TABLE sys_convites
      ADD CONSTRAINT sys_convites_papel_global_check
      CHECK (
        papel_global IS NULL OR papel_global IN ('requisitante', 'equipe', 'supervisor', 'diretor', 'ceo')
      );
  END IF;
END $$;

-- 2) Cadastro de setores operacionais
CREATE TABLE IF NOT EXISTS sys_setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  modulo_key TEXT NOT NULL UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO sys_setores (codigo, nome, modulo_key, descricao)
VALUES
  ('compras', 'Compras', 'compras', 'Cotacao, pedido, fornecedores e itens'),
  ('logistica', 'Logistica', 'logistica', 'Planejamento, expedicao, coleta e recebimento'),
  ('contratos', 'Contratos', 'contratos', 'Elaboracao, assinaturas e medicoes'),
  ('estoque', 'Estoque', 'estoque', 'Entrada, saida e controle de estoque'),
  ('frotas', 'Frotas', 'frotas', 'Entrada/saida de frota, OS e manutencoes'),
  ('patrimonio', 'Patrimonio', 'patrimonio', 'Entrada, saida e gestao de ativos'),
  ('fiscal', 'Fiscal', 'fiscal', 'Emissao e controle fiscal'),
  ('controladoria', 'Controladoria', 'controladoria', 'Controle orcamentario e custos'),
  ('financeiro', 'Financeiro', 'financeiro', 'Contas a pagar e rotinas financeiras')
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    modulo_key = EXCLUDED.modulo_key,
    descricao = EXCLUDED.descricao,
    ativo = true;

CREATE INDEX IF NOT EXISTS idx_sys_setores_modulo_key ON sys_setores(modulo_key);

-- 3) Vinculo perfil x setor com papel por setor
CREATE TABLE IF NOT EXISTS sys_perfil_setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES sys_perfis(id) ON DELETE CASCADE,
  setor_id UUID NOT NULL REFERENCES sys_setores(id) ON DELETE CASCADE,
  papel TEXT NOT NULL DEFAULT 'equipe'
    CHECK (papel IN ('requisitante', 'equipe', 'supervisor', 'diretor', 'ceo')),
  aprovador_tecnico BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, setor_id)
);

CREATE INDEX IF NOT EXISTS idx_sys_perfil_setores_perfil ON sys_perfil_setores(perfil_id);
CREATE INDEX IF NOT EXISTS idx_sys_perfil_setores_setor ON sys_perfil_setores(setor_id);
CREATE INDEX IF NOT EXISTS idx_sys_perfil_setores_papel ON sys_perfil_setores(papel);

-- Backfill de vinculos por modulos atuais do perfil
WITH perfis_modulos AS (
  SELECT
    p.id AS perfil_id,
    CASE
      WHEN e.key = 'patrimonial' THEN 'patrimonio'
      WHEN e.key = 'apontamentos' THEN 'financeiro'
      ELSE e.key
    END AS modulo_key
  FROM sys_perfis p
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.modulos, '{}'::jsonb)) e(key, value)
  WHERE e.value = 'true'
)
INSERT INTO sys_perfil_setores (perfil_id, setor_id, papel, aprovador_tecnico, ativo)
SELECT
  pm.perfil_id,
  s.id,
  CASE COALESCE(p.papel_global, 'requisitante')
    WHEN 'supervisor' THEN 'supervisor'
    WHEN 'diretor' THEN 'diretor'
    WHEN 'ceo' THEN 'ceo'
    WHEN 'equipe' THEN 'equipe'
    ELSE 'equipe'
  END AS papel,
  CASE
    WHEN COALESCE(p.papel_global, 'requisitante') IN ('supervisor', 'diretor', 'ceo') THEN true
    ELSE false
  END AS aprovador_tecnico,
  true
FROM perfis_modulos pm
JOIN sys_setores s
  ON s.modulo_key = pm.modulo_key
JOIN sys_perfis p
  ON p.id = pm.perfil_id
ON CONFLICT (perfil_id, setor_id) DO NOTHING;

-- 4) Feature flag para rollout seguro (default OFF)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sys_config'
  ) THEN
    INSERT INTO sys_config (chave, valor, descricao, updated_at)
    VALUES (
      'rbac_v2_enabled',
      'false',
      'Liga o modelo RBAC v2 (papel global + papel por setor). Default false para rollout seguro.',
      now()
    )
    ON CONFLICT (chave) DO NOTHING;
  END IF;
END $$;

-- 5) Trigger de updated_at
CREATE OR REPLACE FUNCTION trg_sys_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sys_setores_updated_at ON sys_setores;
CREATE TRIGGER trg_sys_setores_updated_at
BEFORE UPDATE ON sys_setores
FOR EACH ROW
EXECUTE FUNCTION trg_sys_touch_updated_at();

DROP TRIGGER IF EXISTS trg_sys_perfil_setores_updated_at ON sys_perfil_setores;
CREATE TRIGGER trg_sys_perfil_setores_updated_at
BEFORE UPDATE ON sys_perfil_setores
FOR EACH ROW
EXECUTE FUNCTION trg_sys_touch_updated_at();

-- 6) Funcoes de leitura/permissao (front + backend)
CREATE OR REPLACE FUNCTION get_feature_flag(p_chave TEXT, p_default BOOLEAN DEFAULT false)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sys_config'
  ) THEN
    RETURN p_default;
  END IF;

  SELECT valor INTO v_raw
  FROM sys_config
  WHERE chave = p_chave
  LIMIT 1;

  IF v_raw IS NULL THEN
    RETURN p_default;
  END IF;

  RETURN LOWER(v_raw) IN ('1', 'true', 't', 'on', 'yes', 'y');
EXCEPTION WHEN OTHERS THEN
  RETURN p_default;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_papel_global(p_auth_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.papel_global FROM sys_perfis p WHERE p.auth_id = p_auth_id AND p.ativo = true LIMIT 1),
    'requisitante'
  );
$$;

CREATE OR REPLACE FUNCTION can_access_modulo(p_modulo TEXT, p_auth_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil_id UUID;
  v_role TEXT;
  v_use_rbac_v2 BOOLEAN;
  v_modulo TEXT;
BEGIN
  v_modulo := CASE
    WHEN p_modulo = 'patrimonial' THEN 'patrimonio'
    WHEN p_modulo = 'apontamentos' THEN 'financeiro'
    ELSE p_modulo
  END;

  SELECT id, role INTO v_perfil_id, v_role
  FROM sys_perfis
  WHERE auth_id = p_auth_id AND ativo = true
  LIMIT 1;

  IF v_perfil_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('administrador', 'admin') THEN
    RETURN true;
  END IF;

  v_use_rbac_v2 := get_feature_flag('rbac_v2_enabled', false);

  IF v_use_rbac_v2 THEN
    RETURN EXISTS (
      SELECT 1
      FROM sys_perfil_setores ps
      JOIN sys_setores s ON s.id = ps.setor_id
      WHERE ps.perfil_id = v_perfil_id
        AND ps.ativo = true
        AND s.ativo = true
        AND s.modulo_key = v_modulo
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM sys_perfis p
    WHERE p.id = v_perfil_id
      AND (
        COALESCE((p.modulos ->> v_modulo)::boolean, false) = true
        OR (v_modulo = 'patrimonio' AND COALESCE((p.modulos ->> 'patrimonial')::boolean, false) = true)
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION can_approve_tecnico(p_modulo TEXT, p_auth_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil_id UUID;
  v_role TEXT;
  v_papel_global TEXT;
  v_use_rbac_v2 BOOLEAN;
  v_modulo TEXT;
BEGIN
  v_modulo := CASE
    WHEN p_modulo = 'patrimonial' THEN 'patrimonio'
    WHEN p_modulo = 'apontamentos' THEN 'financeiro'
    ELSE p_modulo
  END;

  SELECT id, role, COALESCE(papel_global, 'requisitante')
    INTO v_perfil_id, v_role, v_papel_global
  FROM sys_perfis
  WHERE auth_id = p_auth_id AND ativo = true
  LIMIT 1;

  IF v_perfil_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_role IN ('administrador', 'admin') OR v_papel_global IN ('diretor', 'ceo') THEN
    RETURN true;
  END IF;

  v_use_rbac_v2 := get_feature_flag('rbac_v2_enabled', false);

  IF NOT v_use_rbac_v2 THEN
    RETURN v_role IN ('diretor', 'gerente', 'gestor', 'aprovador');
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM sys_perfil_setores ps
    JOIN sys_setores s ON s.id = ps.setor_id
    WHERE ps.perfil_id = v_perfil_id
      AND ps.ativo = true
      AND s.ativo = true
      AND s.modulo_key = v_modulo
      AND (
        ps.aprovador_tecnico = true
        OR ps.papel IN ('supervisor', 'diretor', 'ceo')
      )
  );
END;
$$;

-- 7) RLS (somente leitura propria + admin)
ALTER TABLE sys_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_perfil_setores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_sys_setores_read ON sys_setores;
CREATE POLICY rls_sys_setores_read ON sys_setores
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS rls_sys_setores_write ON sys_setores;
CREATE POLICY rls_sys_setores_write ON sys_setores
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS rls_sys_setores_service ON sys_setores;
CREATE POLICY rls_sys_setores_service ON sys_setores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS rls_sys_perfil_setores_read ON sys_perfil_setores;
CREATE POLICY rls_sys_perfil_setores_read ON sys_perfil_setores
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR perfil_id IN (SELECT id FROM sys_perfis WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS rls_sys_perfil_setores_write ON sys_perfil_setores;
CREATE POLICY rls_sys_perfil_setores_write ON sys_perfil_setores
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS rls_sys_perfil_setores_service ON sys_perfil_setores;
CREATE POLICY rls_sys_perfil_setores_service ON sys_perfil_setores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 8) Grants de funcoes
GRANT EXECUTE ON FUNCTION get_feature_flag(TEXT, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_papel_global(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_access_modulo(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_approve_tecnico(TEXT, UUID) TO authenticated, service_role;
