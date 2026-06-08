-- ─────────────────────────────────────────────────────────────────────────────
-- 131_rh_holerites.sql
--
-- Tabela rh_holerites + RLS pro Portal TEG (colaborador baixa o proprio
-- holerite). RH/admin pode subir e ver tudo; colaborador so ve os seus.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rh_holerites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  competencia     date NOT NULL,                              -- YYYY-MM-01
  tipo            text NOT NULL DEFAULT 'mensal'              -- mensal|13o|ferias|rescisao|adiantamento
                    CHECK (tipo IN ('mensal','13o','ferias','rescisao','adiantamento')),
  arquivo_url     text NOT NULL,                              -- storage path (bucket: rh-holerites)
  arquivo_nome    text,
  valor_liquido   numeric,                                    -- opcional, exibe no resumo
  observacao      text,
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  uploaded_by     uuid REFERENCES auth.users(id),
  uploaded_por_nome text,
  CONSTRAINT uq_holerite_competencia UNIQUE (colaborador_id, competencia, tipo)
);

CREATE INDEX IF NOT EXISTS idx_rh_holerites_colab_comp
  ON rh_holerites(colaborador_id, competencia DESC);

ALTER TABLE public.rh_holerites ENABLE ROW LEVEL SECURITY;

-- Colaborador ve so os proprios (via sys_perfis.colaborador_id linkado ao auth.uid)
DROP POLICY IF EXISTS "rh_holerites_select_proprios" ON public.rh_holerites;
CREATE POLICY "rh_holerites_select_proprios" ON public.rh_holerites
  FOR SELECT TO authenticated
  USING (
    colaborador_id IN (
      SELECT colaborador_id FROM sys_perfis
      WHERE auth_id = auth.uid() AND colaborador_id IS NOT NULL
    )
  );

-- RH/admin ve tudo (verifica papel via sys_perfis.modulos JSONB)
DROP POLICY IF EXISTS "rh_holerites_select_rh" ON public.rh_holerites;
CREATE POLICY "rh_holerites_select_rh" ON public.rh_holerites
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis sp
      WHERE sp.auth_id = auth.uid()
        AND (
          (sp.modulos ? 'rh' AND (sp.modulos->>'rh')::boolean = true)
          OR coalesce(sp.papel_global, '') IN ('admin','diretor')
        )
    )
  );

-- Apenas RH/admin pode inserir/atualizar/deletar
DROP POLICY IF EXISTS "rh_holerites_admin_write" ON public.rh_holerites;
CREATE POLICY "rh_holerites_admin_write" ON public.rh_holerites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sys_perfis sp
      WHERE sp.auth_id = auth.uid()
        AND (
          (sp.modulos ? 'rh' AND (sp.modulos->>'rh')::boolean = true)
          OR coalesce(sp.papel_global, '') IN ('admin','diretor')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sys_perfis sp
      WHERE sp.auth_id = auth.uid()
        AND (
          (sp.modulos ? 'rh' AND (sp.modulos->>'rh')::boolean = true)
          OR coalesce(sp.papel_global, '') IN ('admin','diretor')
        )
    )
  );

COMMENT ON TABLE public.rh_holerites IS
  'Holerites por colaborador. RLS: colaborador ve so os proprios via sys_perfis.colaborador_id; RH/admin ve todos.';
