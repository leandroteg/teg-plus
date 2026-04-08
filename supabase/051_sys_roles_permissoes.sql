-- ============================================
-- Migration 051: sys_roles + sys_role_permissoes + sys_perfil_permissoes
-- Fase 1 do RBAC granular — ADITIVA, sem breaking changes
-- ============================================

-- 1. Tabela de Roles (cargos de acesso ao sistema)
CREATE TABLE IF NOT EXISTS sys_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  alcada_nivel INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  cor TEXT DEFAULT '#6366f1',
  icone TEXT DEFAULT 'Shield',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Permissões por Role (modulo + ação)
CREATE TABLE IF NOT EXISTS sys_role_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES sys_roles(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL DEFAULT 'ver',
  condicao JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, modulo, acao)
);

-- 3. Override de permissões por perfil individual
CREATE TABLE IF NOT EXISTS sys_perfil_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES sys_perfis(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL DEFAULT 'ver',
  concedido BOOLEAN NOT NULL DEFAULT true,
  condicao JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(perfil_id, modulo, acao)
);

-- 4. Colunas de vínculo em sys_perfis (opcionais)
ALTER TABLE sys_perfis ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES sys_roles(id);
ALTER TABLE sys_perfis ADD COLUMN IF NOT EXISTS colaborador_id UUID REFERENCES rh_colaboradores(id);

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_sys_role_permissoes_role ON sys_role_permissoes(role_id);
CREATE INDEX IF NOT EXISTS idx_sys_role_permissoes_modulo ON sys_role_permissoes(modulo);
CREATE INDEX IF NOT EXISTS idx_sys_perfil_permissoes_perfil ON sys_perfil_permissoes(perfil_id);
CREATE INDEX IF NOT EXISTS idx_sys_perfis_role_id ON sys_perfis(role_id);
CREATE INDEX IF NOT EXISTS idx_sys_perfis_colaborador_id ON sys_perfis(colaborador_id);

-- 6. Roles do sistema
INSERT INTO sys_roles (nome, descricao, alcada_nivel, is_system, cor, icone) VALUES
  ('Administrador', 'Acesso total ao sistema', 4, true, '#dc2626', 'ShieldCheck'),
  ('Diretor', 'Aprovações de alto valor, visão estratégica', 3, true, '#7c3aed', 'Crown'),
  ('Gestor', 'Gestão operacional, aprovações até alçada', 2, true, '#2563eb', 'UserCog'),
  ('Requisitante', 'Criação de solicitações e acompanhamento', 1, true, '#16a34a', 'UserPlus'),
  ('Visitante', 'Visualização limitada, sem ações', 0, true, '#6b7280', 'Eye')
ON CONFLICT (nome) DO NOTHING;

-- 7. Vincular perfis existentes
UPDATE sys_perfis SET role_id = r.id
FROM sys_roles r
WHERE LOWER(sys_perfis.role) = LOWER(r.nome)
AND sys_perfis.role_id IS NULL;

-- 8. Permissões padrão (Administrador = tudo)
INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, m.modulo, a.acao
FROM sys_roles r
CROSS JOIN (VALUES ('compras'),('financeiro'),('logistica'),('estoque'),('rh'),('frotas'),('patrimonial'),('apontamentos'),('admin')) AS m(modulo)
CROSS JOIN (VALUES ('ver'),('criar'),('editar'),('aprovar'),('excluir')) AS a(acao)
WHERE r.nome = 'Administrador'
ON CONFLICT DO NOTHING;

-- Diretor
INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, m.modulo, a.acao FROM sys_roles r
CROSS JOIN (VALUES ('compras'),('financeiro'),('logistica'),('estoque'),('rh'),('frotas'),('patrimonial'),('apontamentos')) AS m(modulo)
CROSS JOIN (VALUES ('ver'),('aprovar')) AS a(acao)
WHERE r.nome = 'Diretor' ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, m.modulo, a.acao FROM sys_roles r
CROSS JOIN (VALUES ('compras'),('logistica'),('rh')) AS m(modulo)
CROSS JOIN (VALUES ('criar'),('editar')) AS a(acao)
WHERE r.nome = 'Diretor' ON CONFLICT DO NOTHING;

-- Gestor
INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, m.modulo, a.acao FROM sys_roles r
CROSS JOIN (VALUES ('compras'),('logistica'),('estoque'),('frotas')) AS m(modulo)
CROSS JOIN (VALUES ('ver'),('criar'),('editar')) AS a(acao)
WHERE r.nome = 'Gestor' ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, m.modulo, 'aprovar' FROM sys_roles r
CROSS JOIN (VALUES ('compras'),('logistica')) AS m(modulo)
WHERE r.nome = 'Gestor' ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, m.modulo, 'ver' FROM sys_roles r
CROSS JOIN (VALUES ('financeiro'),('rh'),('patrimonial'),('apontamentos')) AS m(modulo)
WHERE r.nome = 'Gestor' ON CONFLICT DO NOTHING;

-- Requisitante
INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, m.modulo, a.acao FROM sys_roles r
CROSS JOIN (VALUES ('compras'),('logistica')) AS m(modulo)
CROSS JOIN (VALUES ('ver'),('criar')) AS a(acao)
WHERE r.nome = 'Requisitante' ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, 'estoque', 'ver' FROM sys_roles r
WHERE r.nome = 'Requisitante' ON CONFLICT DO NOTHING;

-- Visitante
INSERT INTO sys_role_permissoes (role_id, modulo, acao)
SELECT r.id, m.modulo, 'ver' FROM sys_roles r
CROSS JOIN (VALUES ('compras'),('logistica'),('estoque')) AS m(modulo)
WHERE r.nome = 'Visitante' ON CONFLICT DO NOTHING;

-- 9. RLS
ALTER TABLE sys_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_role_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_perfil_permissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sys_roles_select" ON sys_roles FOR SELECT USING (true);
CREATE POLICY "sys_roles_admin_insert" ON sys_roles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "sys_roles_admin_update" ON sys_roles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "sys_roles_admin_delete" ON sys_roles FOR DELETE USING (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));

CREATE POLICY "sys_role_permissoes_select" ON sys_role_permissoes FOR SELECT USING (true);
CREATE POLICY "sys_role_permissoes_admin_insert" ON sys_role_permissoes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "sys_role_permissoes_admin_update" ON sys_role_permissoes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "sys_role_permissoes_admin_delete" ON sys_role_permissoes FOR DELETE USING (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));

CREATE POLICY "sys_perfil_permissoes_select_own" ON sys_perfil_permissoes FOR SELECT USING (
  perfil_id IN (SELECT id FROM sys_perfis WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "sys_perfil_permissoes_admin_insert" ON sys_perfil_permissoes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "sys_perfil_permissoes_admin_update" ON sys_perfil_permissoes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));
CREATE POLICY "sys_perfil_permissoes_admin_delete" ON sys_perfil_permissoes FOR DELETE USING (
  EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role = 'administrador'));

-- 10. Trigger updated_at
CREATE OR REPLACE FUNCTION trg_sys_roles_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sys_roles_updated_at ON sys_roles;
CREATE TRIGGER sys_roles_updated_at
  BEFORE UPDATE ON sys_roles FOR EACH ROW EXECUTE FUNCTION trg_sys_roles_updated_at();
