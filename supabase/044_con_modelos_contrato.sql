-- Template models for contracts
CREATE TABLE IF NOT EXISTS con_modelos_contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_contrato TEXT NOT NULL DEFAULT 'despesa' CHECK (tipo_contrato IN ('receita', 'despesa')),
  objeto TEXT,
  descricao TEXT,
  clausulas TEXT,
  recorrencia TEXT DEFAULT 'mensal' CHECK (recorrencia IN ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual', 'personalizado')),
  indice_reajuste TEXT,
  itens_padrao JSONB DEFAULT '[]'::jsonb,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE con_modelos_contrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modelos_select" ON con_modelos_contrato
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "modelos_insert" ON con_modelos_contrato
  FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));

CREATE POLICY "modelos_update" ON con_modelos_contrato
  FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador'));

CREATE POLICY "modelos_delete" ON con_modelos_contrato
  FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON con_modelos_contrato
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
