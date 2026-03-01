-- ══════════════════════════════════════════════════════════════════
-- TEG+ ERP · 006_auth_sistema.sql
-- Sistema de Autenticação, Perfis e Controle de Acesso
-- Multi-módulo, multi-nível, integrado ao Supabase Auth
-- ══════════════════════════════════════════════════════════════════

-- ── ENUM: Roles disponíveis ────────────────────────────────────────
-- admin        → acesso total, gerencia usuários
-- gerente      → visibilidade cross-módulo, aprovação nível 3+
-- aprovador    → somente aprovações (acesso externo/gestor campo)
-- comprador    → módulo compras completo
-- requisitante → cria e acompanha suas próprias requisições
-- visitante    → somente leitura
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sys_role') THEN
    CREATE TYPE sys_role AS ENUM (
      'admin', 'gerente', 'aprovador', 'comprador', 'requisitante', 'visitante'
    );
  END IF;
END $$;

-- ── TABELA: sys_perfis ─────────────────────────────────────────────
-- Perfil de usuário vinculado ao Supabase Auth
CREATE TABLE IF NOT EXISTS sys_perfis (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       UUID        UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  cargo         TEXT,
  departamento  TEXT,
  avatar_url    TEXT,

  -- Nível de acesso global
  role          TEXT        NOT NULL DEFAULT 'requisitante'
                            CHECK (role IN ('admin','gerente','aprovador','comprador','requisitante','visitante')),

  -- Alçada de aprovação: 0=sem, 1=Coord(5K), 2=Ger(25K), 3=Dir(100K), 4=CEO(∞)
  alcada_nivel  INTEGER     NOT NULL DEFAULT 0 CHECK (alcada_nivel BETWEEN 0 AND 4),

  -- Módulos habilitados por usuário (sobrescreve defaults do role)
  -- Ex: {"compras": true, "financeiro": false, "rh": false}
  modulos       JSONB       NOT NULL DEFAULT '{"compras": true}'::jsonb,

  -- Preferências de UI (tema, idioma, etc.)
  preferencias  JSONB       NOT NULL DEFAULT '{}'::jsonb,

  ativo         BOOLEAN     NOT NULL DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sys_perfis IS
  'Perfis de usuário TEG+ ERP. Roles: admin > gerente > aprovador > comprador > requisitante > visitante';
COMMENT ON COLUMN sys_perfis.alcada_nivel IS
  '0=Sem alçada, 1=Coordenador(5K), 2=Gerente(25K), 3=Diretor(100K), 4=CEO(∞)';
COMMENT ON COLUMN sys_perfis.modulos IS
  'Módulos habilitados: {"compras":true,"financeiro":false,"rh":false,...}';

-- ── TABELA: sys_convites ───────────────────────────────────────────
-- Convites pré-configurados: admin define role/alçada antes do 1º login
CREATE TABLE IF NOT EXISTS sys_convites (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT 'requisitante',
  alcada_nivel   INTEGER     NOT NULL DEFAULT 0,
  modulos        JSONB       NOT NULL DEFAULT '{"compras": true}'::jsonb,
  nome_sugerido  TEXT,
  convidado_por  UUID        REFERENCES sys_perfis(id) ON DELETE SET NULL,
  aceito         BOOLEAN     NOT NULL DEFAULT false,
  aceito_em      TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────────────
ALTER TABLE sys_perfis   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_convites ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado vê o próprio perfil
CREATE POLICY "perfil_ver_proprio" ON sys_perfis
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_id);

-- Usuário edita apenas campos permitidos do próprio perfil
CREATE POLICY "perfil_editar_proprio" ON sys_perfis
  FOR UPDATE TO authenticated
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);

-- Admin vê e gerencia todos os perfis
CREATE POLICY "admin_full_perfis" ON sys_perfis
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid() AND p.role = 'admin' AND p.ativo = true
    )
  );

-- Admin gerencia convites
CREATE POLICY "admin_full_convites" ON sys_convites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis p
      WHERE p.auth_id = auth.uid() AND p.role = 'admin' AND p.ativo = true
    )
  );

-- ── TRIGGER: Auto-criar perfil no primeiro login ───────────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome       TEXT;
  v_role       TEXT    := 'requisitante';
  v_alcada     INTEGER := 0;
  v_modulos    JSONB   := '{"compras": true}'::jsonb;
  v_convite    RECORD;
BEGIN
  -- Nome: metadata → parte do e-mail
  v_nome := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'nome'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  -- Checar se existe convite pré-configurado para este e-mail
  SELECT * INTO v_convite
  FROM public.sys_convites
  WHERE email = NEW.email
    AND aceito = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_role    := v_convite.role;
    v_alcada  := v_convite.alcada_nivel;
    v_modulos := v_convite.modulos;
    IF v_convite.nome_sugerido IS NOT NULL THEN
      v_nome := v_convite.nome_sugerido;
    END IF;
    -- Marcar convite como aceito
    UPDATE public.sys_convites
    SET aceito = true, aceito_em = NOW()
    WHERE id = v_convite.id;
  END IF;

  INSERT INTO public.sys_perfis (auth_id, nome, email, role, alcada_nivel, modulos)
  VALUES (NEW.id, v_nome, NEW.email, v_role, v_alcada, v_modulos)
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca falha o signup por erro do trigger
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── FUNÇÃO: Registrar último acesso ───────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_acesso(p_auth_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sys_perfis
  SET ultimo_acesso = NOW(), updated_at = NOW()
  WHERE auth_id = p_auth_id AND ativo = true;
END;
$$;

-- ── FUNÇÃO: updated_at automático ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sys_perfis_updated_at
  BEFORE UPDATE ON sys_perfis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── ÍNDICES ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sys_perfis_auth_id  ON sys_perfis(auth_id);
CREATE INDEX IF NOT EXISTS idx_sys_perfis_role     ON sys_perfis(role);
CREATE INDEX IF NOT EXISTS idx_sys_perfis_ativo    ON sys_perfis(ativo);
CREATE INDEX IF NOT EXISTS idx_sys_convites_email  ON sys_convites(email);

-- ══════════════════════════════════════════════════════════════════
-- SETUP INICIAL
--
-- 1. No Supabase Dashboard → Authentication → Providers → Email:
--    ✓ Enable Email provider
--    ✓ Enable "Confirm email" (opcional, recomendado)
--    ✓ Enable "Magic Link"
--
-- 2. Para criar o primeiro admin:
--    a) Authentication → Users → Add user (email + senha)
--    b) Execute no SQL Editor:
--       UPDATE sys_perfis
--       SET role = 'admin', alcada_nivel = 4,
--           modulos = '{"compras":true,"financeiro":true,"rh":true}'
--       WHERE email = 'seuemail@teguniao.com.br';
-- ══════════════════════════════════════════════════════════════════
