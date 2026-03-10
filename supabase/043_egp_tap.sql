-- Migration 043: Create egp_tap table for EGP Term of Project Opening (TAP)
-- Date: 2026-03-09

CREATE TABLE IF NOT EXISTS egp_tap (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  titulo text NOT NULL,
  gerente_projeto text,
  sponsor text,
  objetivo text,
  escopo text,
  fora_escopo text,
  premissas text,
  restricoes text,
  riscos_iniciais text,
  marcos_principais jsonb DEFAULT '[]',
  stakeholders jsonb DEFAULT '[]',
  orcamento_estimado numeric(14,2),
  data_inicio_prevista date,
  data_fim_prevista date,
  status text DEFAULT 'rascunho',
  aprovado_por text,
  aprovado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE egp_tap ENABLE ROW LEVEL SECURITY;
CREATE POLICY "egp_tap_all" ON egp_tap FOR ALL TO authenticated USING (true) WITH CHECK (true);
