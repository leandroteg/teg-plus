-- Tabela de transferências de ativos patrimoniais
CREATE TABLE IF NOT EXISTS pat_transferencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imobilizado_id UUID NOT NULL REFERENCES pat_imobilizados(id),
  base_origem_id UUID REFERENCES est_bases(id),
  base_origem_nome TEXT,
  base_destino_id UUID NOT NULL REFERENCES est_bases(id),
  base_destino_nome TEXT NOT NULL,
  responsavel_id UUID,
  responsavel_nome TEXT,
  motivo TEXT,
  data_transferencia TIMESTAMPTZ DEFAULT now(),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pat_transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pat_transferencias_all" ON pat_transferencias FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_pat_transferencias_imob ON pat_transferencias(imobilizado_id);
