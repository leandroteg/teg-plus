-- 030: Solicitações de Nota Fiscal (workflow Logística → Fiscal)
-- Enum de status do fluxo
CREATE TYPE fis_status_solicitacao_nf AS ENUM (
  'pendente',
  'em_emissao',
  'aguardando_aprovacao',
  'aprovada',
  'emitida',
  'rejeitada'
);

-- Tabela principal
CREATE TABLE fis_solicitacoes_nf (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  status              fis_status_solicitacao_nf NOT NULL DEFAULT 'pendente',

  -- Fornecedor
  fornecedor_id       uuid REFERENCES cmp_fornecedores(id),
  fornecedor_cnpj     text,
  fornecedor_nome     text NOT NULL,

  -- Valores
  valor_total         numeric NOT NULL DEFAULT 0,
  cfop                text,
  natureza_operacao   text DEFAULT 'Remessa de Materiais',
  descricao           text,
  observacoes         text,

  -- Dados da NF (preenchidos na emissão)
  numero_nf           text,
  serie               text DEFAULT '1',
  chave_acesso        text,
  data_emissao        timestamptz,

  -- Aprovação
  aprovado_por        uuid REFERENCES auth.users(id),
  aprovado_em         timestamptz,
  motivo_rejeicao     text,

  -- Arquivos
  danfe_url           text,
  xml_url             text,

  -- Vínculos
  nota_fiscal_id      uuid REFERENCES fis_notas_fiscais(id),
  solicitacao_log_id  uuid REFERENCES log_solicitacoes(id),
  origem              text NOT NULL DEFAULT 'logistica',

  -- Auditoria
  solicitado_por      uuid REFERENCES auth.users(id),
  solicitado_em       timestamptz NOT NULL DEFAULT now(),
  emitido_por         uuid REFERENCES auth.users(id),
  emitido_em          timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_fis_sol_nf_status       ON fis_solicitacoes_nf(status);
CREATE INDEX idx_fis_sol_nf_origem       ON fis_solicitacoes_nf(origem);
CREATE INDEX idx_fis_sol_nf_fornecedor   ON fis_solicitacoes_nf(fornecedor_id);
CREATE INDEX idx_fis_sol_nf_solicitado_em ON fis_solicitacoes_nf(solicitado_em);
CREATE INDEX idx_fis_sol_nf_log          ON fis_solicitacoes_nf(solicitacao_log_id)
  WHERE solicitacao_log_id IS NOT NULL;

-- RLS
ALTER TABLE fis_solicitacoes_nf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read solicitacoes_nf"
  ON fis_solicitacoes_nf FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert solicitacoes_nf"
  ON fis_solicitacoes_nf FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update solicitacoes_nf"
  ON fis_solicitacoes_nf FOR UPDATE TO authenticated USING (true);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION fis_sol_nf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fis_sol_nf_updated
  BEFORE UPDATE ON fis_solicitacoes_nf
  FOR EACH ROW EXECUTE FUNCTION fis_sol_nf_updated_at();

-- Trigger: ao mudar status para 'emitida', cria registro em fis_notas_fiscais
CREATE OR REPLACE FUNCTION fis_sol_nf_on_emitida()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'emitida' AND OLD.status != 'emitida' THEN
    INSERT INTO fis_notas_fiscais (
      numero, serie, chave_acesso, data_emissao, data_entrada,
      fornecedor_id, fornecedor_cnpj, fornecedor_nome,
      valor_total, valor_desconto,
      origem, observacoes,
      criado_em
    )
    VALUES (
      NEW.numero_nf, NEW.serie, NEW.chave_acesso, NEW.data_emissao, CURRENT_DATE,
      NEW.fornecedor_id, NEW.fornecedor_cnpj, NEW.fornecedor_nome,
      NEW.valor_total, 0,
      'avulso', 'Emitida via Solicitação Fiscal #' || NEW.id::text,
      NOW()
    )
    RETURNING id INTO NEW.nota_fiscal_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_fis_sol_nf_emitida
  BEFORE UPDATE ON fis_solicitacoes_nf
  FOR EACH ROW EXECUTE FUNCTION fis_sol_nf_on_emitida();
