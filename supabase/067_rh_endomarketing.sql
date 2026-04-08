-- ─────────────────────────────────────────────────────────────────────────────
-- 067_rh_endomarketing.sql — Endomarketing: Identidade Visual + Comunicados
-- ─────────────────────────────────────────────────────────────────────────────

-- Identidade Visual (config única)
CREATE TABLE IF NOT EXISTS rh_identidade_visual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  cor_primaria TEXT DEFAULT '#0D9488',
  cor_secundaria TEXT DEFAULT '#7C3AED',
  cor_fundo TEXT DEFAULT '#FFFFFF',
  cor_texto TEXT DEFAULT '#1E293B',
  fonte_titulo TEXT DEFAULT 'Montserrat',
  fonte_corpo TEXT DEFAULT 'Inter',
  slogan TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rh_identidade_visual ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_identidade_visual_all" ON rh_identidade_visual FOR ALL USING (true) WITH CHECK (true);

-- Comunicados
CREATE TABLE IF NOT EXISTS rh_comunicados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('aviso_geral','aniversariante','boas_vindas','reconhecimento','evento','treinamento','seguranca','resultado','campanha_interna','personalizado')),
  titulo TEXT NOT NULL,
  subtitulo TEXT,
  conteudo_texto TEXT,
  conteudo_html TEXT,
  imagem_url TEXT,
  formato TEXT DEFAULT 'feed' CHECK (formato IN ('story','feed','paisagem','a4')),
  largura INT DEFAULT 1080,
  altura INT DEFAULT 1080,
  input_usuario TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rh_comunicados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_comunicados_all" ON rh_comunicados FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_rh_comunicados_tipo ON rh_comunicados(tipo);
CREATE INDEX idx_rh_comunicados_created ON rh_comunicados(created_at DESC);

-- Seed identidade visual default
INSERT INTO rh_identidade_visual (logo_url, cor_primaria, cor_secundaria, slogan)
VALUES (NULL, '#0D9488', '#7C3AED', 'TEG União Engenharia')
ON CONFLICT DO NOTHING;
