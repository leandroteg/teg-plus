-- 088_fro_alocacoes_proxima_e_log.sql
-- Demanda Obras→Frotas (próxima alocação) + log de movimentações
-- Aplicada em 2026-04-26 via Supabase MCP. Não-destrutiva.

-- ─── 1. Colunas para "Próxima alocação" (= demanda Obras) ───────────────
ALTER TABLE fro_alocacoes
  ADD COLUMN IF NOT EXISTS proxima_obra_id uuid REFERENCES sys_obras(id),
  ADD COLUMN IF NOT EXISTS proxima_data_inicio date,
  ADD COLUMN IF NOT EXISTS proxima_data_fim date,
  ADD COLUMN IF NOT EXISTS proxima_observacoes text,
  ADD COLUMN IF NOT EXISTS proxima_solicitada_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS proxima_solicitada_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_fro_alocacoes_proxima
  ON fro_alocacoes (proxima_obra_id) WHERE proxima_obra_id IS NOT NULL;

COMMENT ON COLUMN fro_alocacoes.proxima_obra_id IS
  'Demanda de movimentação criada por Obras. Frotas confirma encerrando esta alocação - trigger cria nova automaticamente.';

-- ─── 2. Tabela de histórico ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fro_alocacoes_hist (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alocacao_id   uuid REFERENCES fro_alocacoes(id) ON DELETE CASCADE,
  veiculo_id    uuid REFERENCES fro_veiculos(id),
  acao          text NOT NULL,
  obra_origem   uuid REFERENCES sys_obras(id),
  obra_destino  uuid REFERENCES sys_obras(id),
  payload_antes jsonb,
  payload_depois jsonb,
  feito_por     uuid REFERENCES auth.users(id),
  feito_em      timestamptz NOT NULL DEFAULT now(),
  descricao     text
);

CREATE INDEX IF NOT EXISTS idx_fro_aloc_hist_alocacao ON fro_alocacoes_hist (alocacao_id, feito_em DESC);
CREATE INDEX IF NOT EXISTS idx_fro_aloc_hist_veiculo  ON fro_alocacoes_hist (veiculo_id, feito_em DESC);

ALTER TABLE fro_alocacoes_hist ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "fro_aloc_hist_all" ON fro_alocacoes_hist FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Função de log (FAIL-SAFE: nunca quebra UPDATE/INSERT) ───────────
CREATE OR REPLACE FUNCTION fn_log_fro_alocacao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_acao text;
  v_obra_origem uuid;
  v_obra_destino uuid;
  v_descricao text;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO fro_alocacoes_hist (alocacao_id, veiculo_id, acao, obra_destino, payload_depois, feito_por, descricao)
      VALUES (NEW.id, NEW.veiculo_id, 'criada', NEW.obra_id, to_jsonb(NEW), auth.uid(), 'Alocação criada');
    ELSIF TG_OP = 'UPDATE' THEN
      IF (OLD.proxima_obra_id IS NULL OR OLD.proxima_obra_id != NEW.proxima_obra_id)
         AND NEW.proxima_obra_id IS NOT NULL THEN
        INSERT INTO fro_alocacoes_hist (alocacao_id, veiculo_id, acao, obra_origem, obra_destino,
                                         payload_antes, payload_depois, feito_por, descricao)
        VALUES (NEW.id, NEW.veiculo_id, 'demanda_obras', OLD.obra_id, NEW.proxima_obra_id,
                to_jsonb(OLD), to_jsonb(NEW), auth.uid(), 'Solicitação de movimentação por Obras');
      ELSIF OLD.status = 'ativa' AND NEW.status = 'encerrada' THEN
        INSERT INTO fro_alocacoes_hist (alocacao_id, veiculo_id, acao, obra_origem,
                                         payload_antes, payload_depois, feito_por, descricao)
        VALUES (NEW.id, NEW.veiculo_id, 'encerrada', OLD.obra_id,
                to_jsonb(OLD), to_jsonb(NEW), auth.uid(), 'Alocação encerrada');
      ELSIF OLD.proxima_obra_id IS NOT NULL AND NEW.proxima_obra_id IS NULL THEN
        INSERT INTO fro_alocacoes_hist (alocacao_id, veiculo_id, acao, obra_origem,
                                         payload_antes, payload_depois, feito_por, descricao)
        VALUES (NEW.id, NEW.veiculo_id, 'demanda_cancelada', OLD.proxima_obra_id,
                to_jsonb(OLD), to_jsonb(NEW), auth.uid(),
                COALESCE(NEW.observacoes, 'Demanda de movimentação cancelada'));
      ELSIF OLD IS DISTINCT FROM NEW THEN
        INSERT INTO fro_alocacoes_hist (alocacao_id, veiculo_id, acao,
                                         payload_antes, payload_depois, feito_por, descricao)
        VALUES (NEW.id, NEW.veiculo_id, 'editada',
                to_jsonb(OLD), to_jsonb(NEW), auth.uid(), 'Alocação editada');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_fro_alocacao ON fro_alocacoes;
CREATE TRIGGER trg_log_fro_alocacao
  AFTER INSERT OR UPDATE ON fro_alocacoes
  FOR EACH ROW EXECUTE FUNCTION fn_log_fro_alocacao();

-- ─── 4. Função: cria próxima alocação automaticamente quando atual encerra ─
CREATE OR REPLACE FUNCTION fn_criar_proxima_alocacao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_nova_id uuid;
BEGIN
  BEGIN
    IF OLD.status = 'ativa' AND NEW.status = 'encerrada'
       AND OLD.proxima_obra_id IS NOT NULL THEN

      INSERT INTO fro_alocacoes (
        veiculo_id, obra_id,
        data_saida, data_retorno_prev,
        responsavel_id, status, observacoes
      ) VALUES (
        NEW.veiculo_id,
        OLD.proxima_obra_id,
        COALESCE(OLD.proxima_data_inicio::timestamptz, now()),
        OLD.proxima_data_fim::timestamptz,
        OLD.proxima_solicitada_por,
        'ativa',
        COALESCE(OLD.proxima_observacoes, 'Criada automaticamente por demanda Obras')
      ) RETURNING id INTO v_nova_id;

      UPDATE fro_veiculos
         SET status = 'aguardando_saida'
       WHERE id = NEW.veiculo_id
         AND status IN ('em_entrada','disponivel','em_uso');

      INSERT INTO fro_alocacoes_hist (alocacao_id, veiculo_id, acao, obra_origem, obra_destino, descricao, feito_por)
      VALUES (NEW.id, NEW.veiculo_id, 'automatica', OLD.obra_id, OLD.proxima_obra_id,
              format('Próxima alocação criada automaticamente (id=%s)', v_nova_id), auth.uid());
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_proxima_alocacao ON fro_alocacoes;
CREATE TRIGGER trg_criar_proxima_alocacao
  AFTER UPDATE ON fro_alocacoes
  FOR EACH ROW EXECUTE FUNCTION fn_criar_proxima_alocacao();
