-- =============================================================================
-- 018_mural_recados.sql — Mural de Recados e Comunicação Empresarial
-- =============================================================================
-- Tabela: mural_banners
-- Tipos:  fixa | campanha
-- Uso:    Slideshow na tela inicial ModuloSelector + Gestão no módulo RH (admin)
-- =============================================================================

-- ── Enum ──────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE mural_tipo AS ENUM ('fixa', 'campanha');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tabela principal ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mural_banners (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text        NOT NULL CHECK (char_length(titulo) >= 3),
  subtitulo     text,
  imagem_url    text        NOT NULL,
  tipo          mural_tipo  NOT NULL DEFAULT 'fixa',
  ativo         boolean     NOT NULL DEFAULT true,
  ordem         int         NOT NULL DEFAULT 0,
  -- Campos exclusivos de campanha
  data_inicio   date,
  data_fim      date,
  -- Customização visual (opcionais)
  cor_titulo    text        DEFAULT '#FFFFFF',
  cor_subtitulo text        DEFAULT '#CBD5E1',
  -- Auditoria
  criado_por    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Constraint: campanha deve ter data_fim
  CONSTRAINT campanha_requer_data_fim
    CHECK (tipo = 'fixa' OR (tipo = 'campanha' AND data_fim IS NOT NULL)),
  -- Constraint: data_inicio <= data_fim
  CONSTRAINT datas_validas
    CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_inicio <= data_fim)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mural_ativo  ON mural_banners(ativo);
CREATE INDEX IF NOT EXISTS idx_mural_tipo   ON mural_banners(tipo);
CREATE INDEX IF NOT EXISTS idx_mural_ordem  ON mural_banners(ordem);
CREATE INDEX IF NOT EXISTS idx_mural_datas  ON mural_banners(data_inicio, data_fim);

-- ── Trigger updated_at ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at_mural()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_updated_at_mural ON mural_banners;
CREATE TRIGGER trg_updated_at_mural
  BEFORE UPDATE ON mural_banners
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at_mural();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE mural_banners ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados: leem apenas banners ativos e vigentes
DO $$ BEGIN
  CREATE POLICY "mural_banners_select_publico" ON mural_banners
    FOR SELECT TO authenticated
    USING (
      ativo = true
      AND (
        tipo = 'fixa'
        OR (
          tipo = 'campanha'
          AND (data_inicio IS NULL OR data_inicio <= CURRENT_DATE)
          AND (data_fim   IS NULL OR data_fim   >= CURRENT_DATE)
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin: acesso total (SELECT inclui inativos e fora do período)
DO $$ BEGIN
  CREATE POLICY "mural_banners_admin_all" ON mural_banners
    FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM perfis WHERE auth_id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM perfis WHERE auth_id = auth.uid() AND role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── View: banners_vigentes ────────────────────────────────────────────────────
-- Útil para RPC ou consultas sem considerar RLS
CREATE OR REPLACE VIEW mural_banners_vigentes AS
SELECT *
FROM mural_banners
WHERE ativo = true
  AND (
    tipo = 'fixa'
    OR (
      tipo = 'campanha'
      AND (data_inicio IS NULL OR data_inicio <= CURRENT_DATE)
      AND (data_fim   IS NULL OR data_fim   >= CURRENT_DATE)
    )
  )
ORDER BY ordem ASC;

-- ── Seed: banners padrão ──────────────────────────────────────────────────────
INSERT INTO mural_banners (titulo, subtitulo, imagem_url, tipo, ativo, ordem) VALUES
  (
    'Bem-vindo ao TEG+ ERP',
    'Sistema integrado para gestão de obras de engenharia elétrica e transmissão de energia',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1400&q=80',
    'fixa', true, 0
  ),
  (
    'Módulos Disponíveis',
    'Compras · Financeiro · Estoque · Logística · Frotas — todos operacionais',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=80',
    'fixa', true, 1
  ),
  (
    'Segurança em Primeiro Lugar',
    'Mantenha os checklists de frota em dia e os registros de SSMA atualizados',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1400&q=80',
    'fixa', true, 2
  )
ON CONFLICT DO NOTHING;
