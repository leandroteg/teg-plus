-- =============================================================================
-- Migration 048: Logística gera Contas a Pagar automaticamente
-- TEG+ ERP – Supabase PostgreSQL
-- Created: 2026-03-12
--
-- Integração: log_solicitacoes → fin_contas_pagar
--   1. Campo solicitacao_logistica_id na fin_contas_pagar
--   2. Campo origem (compras/logistica/manual) na fin_contas_pagar
--   3. Trigger: ao aprovar custo (status='aprovado') → CP 'previsto'
--      Somente para terceiros: modal IN (transportadora, motoboy, correios)
--   4. Trigger: ao concluir entrega (status='concluido') → CP 'confirmado'
--      Atualiza valor com frete real do log_nfe se existir
-- =============================================================================


-- ─── 1. Novos campos em fin_contas_pagar ────────────────────────────────────

ALTER TABLE fin_contas_pagar
  ADD COLUMN IF NOT EXISTS solicitacao_logistica_id UUID REFERENCES log_solicitacoes(id),
  ADD COLUMN IF NOT EXISTS origem VARCHAR(20) DEFAULT 'compras'
    CHECK (origem IN ('compras', 'logistica', 'manual'));

-- Índice para busca por solicitação logística
CREATE INDEX IF NOT EXISTS idx_fin_cp_sol_logistica
  ON fin_contas_pagar(solicitacao_logistica_id)
  WHERE solicitacao_logistica_id IS NOT NULL;

-- Backfill: registros existentes são todos de compras
UPDATE fin_contas_pagar SET origem = 'compras' WHERE origem IS NULL;


-- ─── 2. Trigger: Aprovar custo → CP previsto ────────────────────────────────
-- Dispara quando log_solicitacoes.status muda para 'aprovado'
-- Somente para modal de terceiros (transportadora, motoboy, correios)

CREATE OR REPLACE FUNCTION criar_cp_ao_aprovar_transporte()
RETURNS TRIGGER AS $$
DECLARE
  v_transportadora_nome TEXT;
  v_data_venc DATE;
BEGIN
  -- Só dispara na transição para 'aprovado'
  IF NEW.status != 'aprovado' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;

  -- Só gera CP para transporte com terceiros
  IF NEW.modal IS NULL OR NEW.modal::TEXT NOT IN ('transportadora', 'motoboy', 'correios') THEN
    RETURN NEW;
  END IF;

  -- Idempotência: não duplicar se já existe CP para esta solicitação
  IF EXISTS (
    SELECT 1 FROM fin_contas_pagar
    WHERE solicitacao_logistica_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Buscar nome da transportadora
  SELECT COALESCE(nome_fantasia, razao_social) INTO v_transportadora_nome
  FROM log_transportadoras
  WHERE id = NEW.transportadora_id;

  -- Vencimento: data prevista de saída + 30 dias, ou hoje + 30
  v_data_venc := COALESCE(NEW.data_prevista_saida::DATE + 30, CURRENT_DATE + 30);

  INSERT INTO fin_contas_pagar (
    solicitacao_logistica_id,
    origem,
    fornecedor_nome,
    valor_original,
    data_emissao,
    data_vencimento,
    data_vencimento_orig,
    status,
    centro_custo,
    natureza,
    descricao
  ) VALUES (
    NEW.id,
    'logistica',
    COALESCE(v_transportadora_nome, 'Transportadora'),
    COALESCE(NEW.custo_estimado, 0),
    CURRENT_DATE,
    v_data_venc,
    v_data_venc,
    'previsto',
    NEW.centro_custo,
    'frete',
    'Frete ' || NEW.numero || ' — ' || NEW.origem || ' → ' || NEW.destino
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_criar_cp_ao_aprovar_transporte ON log_solicitacoes;

CREATE TRIGGER trig_criar_cp_ao_aprovar_transporte
  AFTER UPDATE ON log_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION criar_cp_ao_aprovar_transporte();


-- ─── 3. Trigger: Concluir entrega → CP confirmado ──────────────────────────
-- Dispara quando log_solicitacoes.status muda para 'concluido'
-- Atualiza valor com frete real do log_nfe (se disponível)

CREATE OR REPLACE FUNCTION confirmar_cp_ao_concluir_transporte()
RETURNS TRIGGER AS $$
DECLARE
  v_valor_frete NUMERIC(12,2);
BEGIN
  -- Só dispara na transição para 'concluido'
  IF NEW.status != 'concluido' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'concluido' THEN
    RETURN NEW;
  END IF;

  -- Só se existe CP de logística para esta solicitação
  IF NOT EXISTS (
    SELECT 1 FROM fin_contas_pagar
    WHERE solicitacao_logistica_id = NEW.id
      AND origem = 'logistica'
  ) THEN
    RETURN NEW;
  END IF;

  -- Buscar valor real do frete no log_nfe (pega o maior/mais recente)
  SELECT COALESCE(n.valor_frete, n.valor_total)
  INTO v_valor_frete
  FROM log_nfe n
  WHERE n.solicitacao_id = NEW.id
    AND n.status != 'cancelada'
  ORDER BY n.criado_em DESC
  LIMIT 1;

  -- Atualiza CP: status → confirmado, valor real se disponível
  UPDATE fin_contas_pagar
  SET
    status     = 'confirmado',
    valor_original = CASE
      WHEN v_valor_frete IS NOT NULL AND v_valor_frete > 0
      THEN v_valor_frete
      ELSE valor_original  -- mantém custo estimado se não tem NF
    END,
    observacoes = CASE
      WHEN v_valor_frete IS NOT NULL
           AND v_valor_frete > 0
           AND ABS(v_valor_frete - valor_original) > (valor_original * 0.10)
      THEN '⚠️ Divergência: previsto R$ ' || valor_original::TEXT
           || ' / real R$ ' || v_valor_frete::TEXT
      ELSE observacoes
    END,
    updated_at = now()
  WHERE solicitacao_logistica_id = NEW.id
    AND origem = 'logistica'
    AND status = 'previsto';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_confirmar_cp_ao_concluir_transporte ON log_solicitacoes;

CREATE TRIGGER trig_confirmar_cp_ao_concluir_transporte
  AFTER UPDATE ON log_solicitacoes
  FOR EACH ROW
  EXECUTE FUNCTION confirmar_cp_ao_concluir_transporte();


-- ─── 4. RLS: permitir insert/update pelo trigger (SECURITY DEFINER) ─────────
-- Já coberto pelas policies existentes (fin_cp_write para service_role)
-- O SECURITY DEFINER nos functions garante acesso

-- ─── 5. Atualizar natureza check se necessário ──────────────────────────────
-- A coluna natureza é VARCHAR(50) sem check constraint, então 'frete' já funciona
