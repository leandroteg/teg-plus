-- ══════════════════════════════════════════════════════════════════════════════
--  045 · Cartões de Crédito — Portadores, Apontamentos e Faturas
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Bandeiras de cartão ────────────────────────────────────────────────────
CREATE TYPE fin_bandeira_cartao AS ENUM (
  'visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro'
);

-- ── 2. Status do apontamento ──────────────────────────────────────────────────
CREATE TYPE fin_status_apontamento_cartao AS ENUM (
  'rascunho', 'enviado', 'conciliado', 'rejeitado'
);

-- ── 3. Status da fatura ───────────────────────────────────────────────────────
CREATE TYPE fin_status_fatura_cartao AS ENUM (
  'processando', 'disponivel', 'paga', 'erro'
);

-- ── 4. Cartões de crédito corporativos ────────────────────────────────────────
CREATE TABLE fin_cartoes_credito (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,                        -- "Visa Corporativo 1234"
  bandeira      fin_bandeira_cartao NOT NULL DEFAULT 'outro',
  ultimos4      char(4),                              -- últimos 4 dígitos
  limite        numeric(14,2),
  ativo         boolean NOT NULL DEFAULT true,
  observacoes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 5. Portadores (usuários vinculados a cartões) ─────────────────────────────
CREATE TABLE fin_portadores_cartao (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao_id   uuid NOT NULL REFERENCES fin_cartoes_credito(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        text NOT NULL,   -- redundante para facilitar queries
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cartao_id, user_id)
);

-- ── 6. Apontamentos dos portadores ────────────────────────────────────────────
CREATE TABLE fin_apontamentos_cartao (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao_id           uuid NOT NULL REFERENCES fin_cartoes_credito(id),
  portador_id         uuid REFERENCES fin_portadores_cartao(id),
  user_id             uuid NOT NULL REFERENCES auth.users(id),
  data_lancamento     date NOT NULL,
  descricao           text NOT NULL,
  estabelecimento     text,
  valor               numeric(14,2) NOT NULL CHECK (valor > 0),
  centro_custo        text,
  classe_financeira   text,
  projeto_id          uuid REFERENCES sys_obras(id),
  comprovante_url     text,                          -- URL do arquivo no storage
  comprovante_nome    text,
  status              fin_status_apontamento_cartao NOT NULL DEFAULT 'rascunho',
  item_fatura_id      uuid,                          -- preenchido após conciliação
  observacoes         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 7. Faturas dos cartões (upload via n8n) ───────────────────────────────────
CREATE TABLE fin_faturas_cartao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao_id       uuid NOT NULL REFERENCES fin_cartoes_credito(id),
  mes_referencia  char(7) NOT NULL,   -- "2026-03" (YYYY-MM)
  data_vencimento date,
  valor_total     numeric(14,2),
  arquivo_url     text,               -- PDF original no storage
  arquivo_nome    text,
  status          fin_status_fatura_cartao NOT NULL DEFAULT 'processando',
  processado_em   timestamptz,
  erro_msg        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cartao_id, mes_referencia)
);

-- ── 8. Itens extraídos da fatura (via n8n) ────────────────────────────────────
CREATE TABLE fin_itens_fatura_cartao (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id       uuid NOT NULL REFERENCES fin_faturas_cartao(id) ON DELETE CASCADE,
  cartao_id       uuid NOT NULL REFERENCES fin_cartoes_credito(id),
  data_lancamento date NOT NULL,
  descricao       text NOT NULL,
  valor           numeric(14,2) NOT NULL,
  categoria_banco text,               -- categoria extraída pelo banco/n8n
  conciliado      boolean NOT NULL DEFAULT false,
  apontamento_id  uuid REFERENCES fin_apontamentos_cartao(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- FK reversa: apontamento → item fatura
ALTER TABLE fin_apontamentos_cartao
  ADD CONSTRAINT fk_apontamento_item_fatura
  FOREIGN KEY (item_fatura_id) REFERENCES fin_itens_fatura_cartao(id);

-- ── 9. Índices ────────────────────────────────────────────────────────────────
CREATE INDEX idx_apontamentos_cartao_user    ON fin_apontamentos_cartao(user_id);
CREATE INDEX idx_apontamentos_cartao_cartao  ON fin_apontamentos_cartao(cartao_id);
CREATE INDEX idx_apontamentos_cartao_data    ON fin_apontamentos_cartao(data_lancamento DESC);
CREATE INDEX idx_apontamentos_cartao_status  ON fin_apontamentos_cartao(status);
CREATE INDEX idx_faturas_cartao_cartao       ON fin_faturas_cartao(cartao_id);
CREATE INDEX idx_itens_fatura_fatura         ON fin_itens_fatura_cartao(fatura_id);
CREATE INDEX idx_itens_fatura_conciliado     ON fin_itens_fatura_cartao(conciliado);
CREATE INDEX idx_portadores_user             ON fin_portadores_cartao(user_id);

-- ── 10. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE fin_cartoes_credito         ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_portadores_cartao       ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_apontamentos_cartao     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_faturas_cartao          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_itens_fatura_cartao     ENABLE ROW LEVEL SECURITY;

-- Cartões: todos autenticados podem ver; apenas admins alteram
CREATE POLICY "cartoes_select" ON fin_cartoes_credito
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cartoes_admin"  ON fin_cartoes_credito
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role IN ('admin','gerente') AND ativo = true)
  );

-- Portadores: visível para todos autenticados
CREATE POLICY "portadores_select" ON fin_portadores_cartao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "portadores_admin"  ON fin_portadores_cartao
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role IN ('admin','gerente') AND ativo = true)
  );

-- Apontamentos: portador vê/edita os seus; finance vê todos
CREATE POLICY "apontamentos_select_own" ON fin_apontamentos_cartao
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role IN ('admin','gerente','aprovador') AND ativo = true)
  );
CREATE POLICY "apontamentos_insert" ON fin_apontamentos_cartao
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "apontamentos_update_own" ON fin_apontamentos_cartao
  FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'rascunho')
    OR EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role IN ('admin','gerente') AND ativo = true)
  );
CREATE POLICY "apontamentos_delete_own" ON fin_apontamentos_cartao
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'rascunho');

-- Faturas e itens: todos autenticados com acesso financeiro
CREATE POLICY "faturas_select" ON fin_faturas_cartao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "faturas_admin"  ON fin_faturas_cartao
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role IN ('admin','gerente') AND ativo = true)
  );

CREATE POLICY "itens_fatura_select" ON fin_itens_fatura_cartao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "itens_fatura_admin"  ON fin_itens_fatura_cartao
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM sys_perfis WHERE auth_id = auth.uid() AND role IN ('admin','gerente') AND ativo = true)
  );

-- ── 11. updated_at triggers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fin_set_updated_at_cartao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_cartoes_updated_at
  BEFORE UPDATE ON fin_cartoes_credito
  FOR EACH ROW EXECUTE FUNCTION fin_set_updated_at_cartao();

CREATE TRIGGER trg_apontamentos_updated_at
  BEFORE UPDATE ON fin_apontamentos_cartao
  FOR EACH ROW EXECUTE FUNCTION fin_set_updated_at_cartao();

-- ── 12. Seed: cartões de exemplo ──────────────────────────────────────────────
-- (Comentado — executar manualmente conforme necessário)
-- INSERT INTO fin_cartoes_credito (nome, bandeira, ultimos4) VALUES
--   ('Visa Corporativo', 'visa', '1234'),
--   ('Mastercard Obras', 'mastercard', '5678');
