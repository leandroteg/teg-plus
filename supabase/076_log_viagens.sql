-- ============================================
-- Migration 076: log_viagens — Agrupamento de solicitações em viagens
-- Cria tabela log_viagens e FK viagem_id em log_solicitacoes e log_transportes
-- ============================================

-- 1. Tabela de Viagens (consolida N solicitações)
CREATE TABLE IF NOT EXISTS log_viagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planejada'
    CHECK (status IN ('planejada','aguardando_aprovacao','aprovada','em_expedicao','em_transito','concluida','cancelada')),

  -- Transporte
  modal TEXT CHECK (modal IN ('frota_propria','transportadora','motoboy','correios','cliente_retira')),
  transportadora_id UUID REFERENCES log_transportadoras(id),
  veiculo_placa TEXT,
  motorista_nome TEXT,
  motorista_telefone TEXT,

  -- Rota consolidada
  origem_principal TEXT,
  destino_final TEXT,
  distancia_total_km NUMERIC(10,2),
  tempo_estimado_h NUMERIC(6,2),
  qtd_paradas INTEGER NOT NULL DEFAULT 0,
  rota_polyline TEXT,

  -- Custo
  custo_total NUMERIC(15,2),

  -- Datas
  data_prevista_saida TIMESTAMPTZ,
  data_real_saida TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,

  -- Aprovação
  aprovacao_id UUID,
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,

  -- Audit
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. FK viagem_id em log_solicitacoes
ALTER TABLE log_solicitacoes
  ADD COLUMN IF NOT EXISTS viagem_id UUID REFERENCES log_viagens(id),
  ADD COLUMN IF NOT EXISTS ordem_na_viagem INTEGER,
  ADD COLUMN IF NOT EXISTS custo_rateado NUMERIC(15,2);

-- 3. FK viagem_id em log_transportes
ALTER TABLE log_transportes
  ADD COLUMN IF NOT EXISTS viagem_id UUID REFERENCES log_viagens(id);

-- 4. Auto-numeração (LOG-V-YYYY-NNNN)
CREATE OR REPLACE FUNCTION fn_log_viagem_numero()
RETURNS TRIGGER AS $$
DECLARE
  _year TEXT;
  _seq  INTEGER;
BEGIN
  _year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero FROM 'LOG-V-' || _year || '-(\d+)') AS INTEGER)
  ), 0) + 1
  INTO _seq
  FROM log_viagens
  WHERE numero LIKE 'LOG-V-' || _year || '-%';

  NEW.numero := 'LOG-V-' || _year || '-' || LPAD(_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_viagem_numero ON log_viagens;
CREATE TRIGGER trg_log_viagem_numero
  BEFORE INSERT ON log_viagens
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION fn_log_viagem_numero();

-- 5. Auto-update updated_at
CREATE TRIGGER trg_log_viagens_updated
  BEFORE UPDATE ON log_viagens
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_updated_at();

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_log_viagens_status ON log_viagens(status);
CREATE INDEX IF NOT EXISTS idx_log_viagens_data_saida ON log_viagens(data_prevista_saida);
CREATE INDEX IF NOT EXISTS idx_log_solicitacoes_viagem ON log_solicitacoes(viagem_id);
CREATE INDEX IF NOT EXISTS idx_log_transportes_viagem ON log_transportes(viagem_id);

-- 7. RLS
ALTER TABLE log_viagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "log_viagens_select_auth"
  ON log_viagens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "log_viagens_insert_auth"
  ON log_viagens FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "log_viagens_update_auth"
  ON log_viagens FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "log_viagens_delete_admin"
  ON log_viagens FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis
      WHERE user_id = auth.uid()
      AND (tipo = 'admin' OR tipo = 'administrador')
    )
  );

-- 8. RPC: Atualizar qtd_paradas e custo_rateado ao vincular solicitações
CREATE OR REPLACE FUNCTION fn_log_viagem_recalcular(p_viagem_id UUID)
RETURNS void AS $$
DECLARE
  _count INTEGER;
  _custo NUMERIC;
BEGIN
  -- Conta paradas
  SELECT COUNT(*) INTO _count
  FROM log_solicitacoes
  WHERE viagem_id = p_viagem_id;

  -- Custo total da viagem
  SELECT custo_total INTO _custo
  FROM log_viagens
  WHERE id = p_viagem_id;

  -- Atualiza qtd_paradas
  UPDATE log_viagens
  SET qtd_paradas = _count
  WHERE id = p_viagem_id;

  -- Rateia custo igualmente entre solicitações (se custo definido)
  IF _custo IS NOT NULL AND _count > 0 THEN
    UPDATE log_solicitacoes
    SET custo_rateado = ROUND(_custo / _count, 2)
    WHERE viagem_id = p_viagem_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
