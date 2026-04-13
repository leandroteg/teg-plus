-- Migration: con_assinaturas — Certisign digital signature tracking
-- Issue: #76

CREATE TABLE con_assinaturas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id             UUID REFERENCES con_contratos(id),
  solicitacao_id          UUID REFERENCES con_solicitacoes(id),
  minuta_id               UUID REFERENCES con_minutas(id),
  provedor                TEXT NOT NULL DEFAULT 'certisign'
                          CHECK (provedor IN ('certisign','manual')),
  tipo_assinatura         TEXT NOT NULL DEFAULT 'eletronica'
                          CHECK (tipo_assinatura IN ('eletronica','digital_icp')),
  documento_externo_id    TEXT,
  envelope_id             TEXT,
  status                  TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','enviado','parcialmente_assinado',
                                            'assinado','recusado','expirado','cancelado','erro')),
  signatarios             JSONB NOT NULL DEFAULT '[]',
  enviado_em              TIMESTAMPTZ,
  concluido_em            TIMESTAMPTZ,
  expira_em               TIMESTAMPTZ,
  documento_assinado_url  TEXT,
  certificado_url         TEXT,
  webhook_log             JSONB DEFAULT '[]',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE con_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "con_assinaturas_all" ON con_assinaturas
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at (reuses existing moddatetime extension)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON con_assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_con_assinaturas_solicitacao ON con_assinaturas(solicitacao_id);
CREATE INDEX idx_con_assinaturas_envelope ON con_assinaturas(envelope_id);
CREATE INDEX idx_con_assinaturas_contrato ON con_assinaturas(contrato_id);
