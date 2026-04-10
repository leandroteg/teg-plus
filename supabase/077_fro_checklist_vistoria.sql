-- 077_fro_checklist_vistoria.sql
-- Upgrade frotas checklist for graded vehicle inspection (like car rental)
-- Adds estado grading, multiple photos, fuel level, and pendencias tracking

-- 1. Add estado column to execution items (5-grade like locacao vistoria)
ALTER TABLE fro_checklist_execucao_itens
  ADD COLUMN IF NOT EXISTS estado text CHECK (estado IN ('otimo','bom','regular','ruim','nao_se_aplica'));

-- 2. Add extra fields to executions
ALTER TABLE fro_checklist_execucoes
  ADD COLUMN IF NOT EXISTS observacoes_gerais text,
  ADD COLUMN IF NOT EXISTS tem_pendencias boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nivel_combustivel text CHECK (nivel_combustivel IN ('vazio','1/4','1/2','3/4','cheio')),
  ADD COLUMN IF NOT EXISTS hodometro_registro numeric(10,0);

-- 3. Multiple photos per checklist (like loc_vistoria_fotos)
CREATE TABLE IF NOT EXISTS fro_checklist_fotos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES fro_checklist_execucoes(id) ON DELETE CASCADE,
  item_id     uuid REFERENCES fro_checklist_execucao_itens(id) ON DELETE SET NULL,
  url         text NOT NULL,
  descricao   text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE fro_checklist_fotos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select_fro_fotos" ON fro_checklist_fotos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_fro_fotos" ON fro_checklist_fotos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_delete_fro_fotos" ON fro_checklist_fotos FOR DELETE TO authenticated USING (true);

-- 4. Storage bucket for checklist photos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('fro-checklist-fotos', 'fro-checklist-fotos', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "fro_checklist_fotos_select" ON storage.objects FOR SELECT USING (bucket_id = 'fro-checklist-fotos');
CREATE POLICY "fro_checklist_fotos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fro-checklist-fotos');

-- 5. Seed default vehicle inspection template
INSERT INTO fro_checklist_templates (id, nome, tipo, tipo_ativo) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Vistoria Padrao - Veiculo', 'pre_viagem', 'veiculo'),
  ('a0000001-0000-0000-0000-000000000002', 'Vistoria Padrao - Maquina', 'pre_viagem', 'maquina')
ON CONFLICT DO NOTHING;

-- Vehicle template items
INSERT INTO fro_checklist_template_itens (template_id, ordem, descricao, obrigatorio, permite_foto) VALUES
  -- Documentacao
  ('a0000001-0000-0000-0000-000000000001', 1, 'CRLV em dia', true, true),
  ('a0000001-0000-0000-0000-000000000001', 2, 'Seguro vigente', true, false),
  ('a0000001-0000-0000-0000-000000000001', 3, 'CNH do motorista', true, true),
  -- Exterior
  ('a0000001-0000-0000-0000-000000000001', 10, 'Lataria - Frente', true, true),
  ('a0000001-0000-0000-0000-000000000001', 11, 'Lataria - Traseira', true, true),
  ('a0000001-0000-0000-0000-000000000001', 12, 'Lataria - Lateral Esquerda', true, true),
  ('a0000001-0000-0000-0000-000000000001', 13, 'Lataria - Lateral Direita', true, true),
  ('a0000001-0000-0000-0000-000000000001', 14, 'Para-brisa', true, true),
  ('a0000001-0000-0000-0000-000000000001', 15, 'Vidros laterais', true, true),
  ('a0000001-0000-0000-0000-000000000001', 16, 'Retrovisores', true, true),
  ('a0000001-0000-0000-0000-000000000001', 17, 'Para-choques', true, true),
  ('a0000001-0000-0000-0000-000000000001', 18, 'Pneu Dianteiro Esquerdo', true, true),
  ('a0000001-0000-0000-0000-000000000001', 19, 'Pneu Dianteiro Direito', true, true),
  ('a0000001-0000-0000-0000-000000000001', 20, 'Pneu Traseiro Esquerdo', true, true),
  ('a0000001-0000-0000-0000-000000000001', 21, 'Pneu Traseiro Direito', true, true),
  ('a0000001-0000-0000-0000-000000000001', 22, 'Estepe', true, true),
  -- Iluminacao
  ('a0000001-0000-0000-0000-000000000001', 30, 'Farois dianteiros', true, true),
  ('a0000001-0000-0000-0000-000000000001', 31, 'Lanternas traseiras', true, true),
  ('a0000001-0000-0000-0000-000000000001', 32, 'Setas / Indicadores', true, false),
  ('a0000001-0000-0000-0000-000000000001', 33, 'Luz de freio', true, false),
  ('a0000001-0000-0000-0000-000000000001', 34, 'Luz de re', true, false),
  -- Mecanica
  ('a0000001-0000-0000-0000-000000000001', 40, 'Nivel de oleo', true, true),
  ('a0000001-0000-0000-0000-000000000001', 41, 'Nivel de agua / Arrefecimento', true, true),
  ('a0000001-0000-0000-0000-000000000001', 42, 'Fluido de freio', true, false),
  ('a0000001-0000-0000-0000-000000000001', 43, 'Freios (resposta)', true, false),
  ('a0000001-0000-0000-0000-000000000001', 44, 'Embreagem', true, false),
  ('a0000001-0000-0000-0000-000000000001', 45, 'Direcao hidraulica', true, false),
  -- Interior
  ('a0000001-0000-0000-0000-000000000001', 50, 'Painel / Instrumentos', true, true),
  ('a0000001-0000-0000-0000-000000000001', 51, 'Bancos', true, true),
  ('a0000001-0000-0000-0000-000000000001', 52, 'Cintos de seguranca', true, false),
  ('a0000001-0000-0000-0000-000000000001', 53, 'Ar-condicionado', true, false),
  ('a0000001-0000-0000-0000-000000000001', 54, 'Limpeza interna', true, true),
  -- Acessorios obrigatorios
  ('a0000001-0000-0000-0000-000000000001', 60, 'Macaco', true, false),
  ('a0000001-0000-0000-0000-000000000001', 61, 'Chave de roda', true, false),
  ('a0000001-0000-0000-0000-000000000001', 62, 'Triangulo de sinalizacao', true, false),
  ('a0000001-0000-0000-0000-000000000001', 63, 'Extintor de incendio', true, true),
  ('a0000001-0000-0000-0000-000000000001', 64, 'Cones de sinalizacao', false, false);

-- Machine template items (subset without road-specific items)
INSERT INTO fro_checklist_template_itens (template_id, ordem, descricao, obrigatorio, permite_foto) VALUES
  ('a0000001-0000-0000-0000-000000000002', 1, 'Documentacao do equipamento', true, true),
  ('a0000001-0000-0000-0000-000000000002', 10, 'Estrutura externa', true, true),
  ('a0000001-0000-0000-0000-000000000002', 11, 'Pintura / Identificacao', true, true),
  ('a0000001-0000-0000-0000-000000000002', 12, 'Esteiras / Rodagem', true, true),
  ('a0000001-0000-0000-0000-000000000002', 13, 'Implementos / Cacamba', true, true),
  ('a0000001-0000-0000-0000-000000000002', 20, 'Iluminacao de trabalho', true, true),
  ('a0000001-0000-0000-0000-000000000002', 21, 'Alarme de re', true, false),
  ('a0000001-0000-0000-0000-000000000002', 30, 'Nivel de oleo motor', true, true),
  ('a0000001-0000-0000-0000-000000000002', 31, 'Nivel de oleo hidraulico', true, true),
  ('a0000001-0000-0000-0000-000000000002', 32, 'Nivel de agua / Arrefecimento', true, true),
  ('a0000001-0000-0000-0000-000000000002', 33, 'Filtros (visual)', true, false),
  ('a0000001-0000-0000-0000-000000000002', 34, 'Correias', true, false),
  ('a0000001-0000-0000-0000-000000000002', 40, 'Cabine / Assento operador', true, true),
  ('a0000001-0000-0000-0000-000000000002', 41, 'Cinto de seguranca', true, false),
  ('a0000001-0000-0000-0000-000000000002', 42, 'Controles / Alavancas', true, false),
  ('a0000001-0000-0000-0000-000000000002', 43, 'Instrumentos / Painel', true, true),
  ('a0000001-0000-0000-0000-000000000002', 50, 'Extintor', true, true),
  ('a0000001-0000-0000-0000-000000000002', 51, 'Kit primeiros socorros', false, false),
  ('a0000001-0000-0000-0000-000000000002', 52, 'Cones de sinalizacao', false, false);
