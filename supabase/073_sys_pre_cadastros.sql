-- Tabela de pré-cadastros: fluxo de solicitação → aprovação admin
-- Usada por ItemAutocomplete, NotificationBell e usePreCadastros hook

CREATE TABLE IF NOT EXISTS sys_pre_cadastros (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade         text        NOT NULL,                          -- ex: 'itens', 'fornecedores'
  tabela_destino   text        NOT NULL,                          -- ex: 'est_itens'
  dados            jsonb       NOT NULL DEFAULT '{}',
  status           text        NOT NULL DEFAULT 'pendente'
                               CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  solicitado_por   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  solicitante_nome text,
  revisado_por     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  revisor_nome     text,
  motivo_rejeicao  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sys_pre_cadastros_status   ON sys_pre_cadastros (status);
CREATE INDEX IF NOT EXISTS idx_sys_pre_cadastros_entidade ON sys_pre_cadastros (entidade);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION set_sys_pre_cadastros_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sys_pre_cadastros_updated_at ON sys_pre_cadastros;
CREATE TRIGGER trg_sys_pre_cadastros_updated_at
  BEFORE UPDATE ON sys_pre_cadastros
  FOR EACH ROW EXECUTE FUNCTION set_sys_pre_cadastros_updated_at();

-- RLS
ALTER TABLE sys_pre_cadastros ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode inserir (solicitar)
CREATE POLICY "pre_cadastros_insert" ON sys_pre_cadastros
  FOR INSERT TO authenticated WITH CHECK (true);

-- Admin/gestor pode ver todos os pendentes; solicitante vê os seus
CREATE POLICY "pre_cadastros_select" ON sys_pre_cadastros
  FOR SELECT TO authenticated USING (
    solicitado_por = auth.uid()
    OR EXISTS (
      SELECT 1 FROM sys_perfis_usuario
      WHERE auth_id = auth.uid()
        AND papel_global IN ('admin', 'diretor', 'ceo', 'gestor')
    )
  );

-- Somente admin/gestor pode aprovar/rejeitar (UPDATE)
CREATE POLICY "pre_cadastros_update" ON sys_pre_cadastros
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sys_perfis_usuario
      WHERE auth_id = auth.uid()
        AND papel_global IN ('admin', 'diretor', 'ceo', 'gestor')
    )
  );
