-- ============================================================
-- Migration 048: Sistema de Permissões Granulares
-- 5 perfis: administrador, diretor, gestor, requisitante, visitante
-- ============================================================

-- ── 1. Drop constraint, migrate roles, add new constraint ───────────────────
ALTER TABLE sys_perfis DROP CONSTRAINT IF EXISTS sys_perfis_role_check;

UPDATE sys_perfis SET role = CASE role
  WHEN 'admin' THEN 'administrador'
  WHEN 'gerente' THEN 'diretor'
  WHEN 'aprovador' THEN 'gestor'
  WHEN 'comprador' THEN 'gestor'
  ELSE role
END;

ALTER TABLE sys_perfis ADD CONSTRAINT sys_perfis_role_check
  CHECK (role IN ('administrador','diretor','gestor','requisitante','visitante'));

-- ── 2. Adicionar coluna permissoes_especiais ────────────────────────────────
ALTER TABLE sys_perfis ADD COLUMN IF NOT EXISTS permissoes_especiais JSONB DEFAULT '{}'::jsonb;

-- ── 3. Atualizar is_admin() ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador' AND ativo = true); $$;

-- ── 4. Atualizar get_user_role() (usado por role_at_least) ──────────────────
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true), 'visitante'); $$;

-- ── 5. Atualizar auth_role() ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true), 'visitante'); $$;

-- ── 6. Atualizar role_at_least() — backward compat nomes antigos ────────────
CREATE OR REPLACE FUNCTION role_at_least(required_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE public.get_user_role()
    WHEN 'administrador' THEN 5 WHEN 'diretor' THEN 4 WHEN 'gestor' THEN 3 WHEN 'requisitante' THEN 2 WHEN 'visitante' THEN 1 ELSE 0
  END >= CASE required_role
    WHEN 'administrador' THEN 5 WHEN 'diretor' THEN 4 WHEN 'gestor' THEN 3 WHEN 'requisitante' THEN 2 WHEN 'visitante' THEN 1
    WHEN 'admin' THEN 5 WHEN 'gerente' THEN 4 WHEN 'aprovador' THEN 3 WHEN 'comprador' THEN 3
    ELSE 0
  END;
$$;

-- ── 7. Atualizar auth_at_least() — backward compat nomes antigos ────────────
CREATE OR REPLACE FUNCTION auth_at_least(p_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE auth_role()
    WHEN 'administrador' THEN 5 WHEN 'diretor' THEN 4 WHEN 'gestor' THEN 3 WHEN 'requisitante' THEN 2 WHEN 'visitante' THEN 1 ELSE 0
  END >= CASE p_role
    WHEN 'administrador' THEN 5 WHEN 'diretor' THEN 4 WHEN 'gestor' THEN 3 WHEN 'requisitante' THEN 2 WHEN 'visitante' THEN 1
    WHEN 'admin' THEN 5 WHEN 'gerente' THEN 4 WHEN 'aprovador' THEN 3 WHEN 'comprador' THEN 3
    ELSE 0
  END;
$$;

-- ── 8. Default ──────────────────────────────────────────────────────────────
ALTER TABLE sys_perfis ALTER COLUMN role SET DEFAULT 'requisitante';
