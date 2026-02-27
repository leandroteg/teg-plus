-- ============================================================
-- TEG+ | Seed: Usuários e Aprovadores Iniciais
-- Executar após 001_schema_compras.sql
-- ============================================================

-- Usuários aprovadores (configurar emails reais)
INSERT INTO usuarios (nome, email, cargo, departamento, nivel_alcada, telefone) VALUES
  ('Coordenador de Obras', 'coordenador@teguniao.com.br', 'Coordenador', 'Obras', 1, '(34) 99999-0001'),
  ('Gerente de Suprimentos', 'gerente@teguniao.com.br', 'Gerente', 'Suprimentos', 2, '(34) 99999-0002'),
  ('Diretor de Operações', 'diretor@teguniao.com.br', 'Diretor', 'Diretoria', 3, '(34) 99999-0003'),
  ('CEO', 'ceo@teguniao.com.br', 'CEO', 'Diretoria', 4, '(34) 99999-0004');

-- Vincular aprovadores padrão às alçadas
UPDATE alcadas SET aprovador_padrao_id = (SELECT id FROM usuarios WHERE nivel_alcada = 1 LIMIT 1) WHERE nivel = 1;
UPDATE alcadas SET aprovador_padrao_id = (SELECT id FROM usuarios WHERE nivel_alcada = 2 LIMIT 1) WHERE nivel = 2;
UPDATE alcadas SET aprovador_padrao_id = (SELECT id FROM usuarios WHERE nivel_alcada = 3 LIMIT 1) WHERE nivel = 3;
UPDATE alcadas SET aprovador_padrao_id = (SELECT id FROM usuarios WHERE nivel_alcada = 4 LIMIT 1) WHERE nivel = 4;

-- Usuários solicitantes de exemplo
INSERT INTO usuarios (nome, email, cargo, departamento, obra_id, nivel_alcada, telefone) VALUES
  ('João Silva', 'joao.silva@teguniao.com.br', 'Engenheiro de Campo', 'Obras',
   (SELECT id FROM obras WHERE codigo = 'FRUTAL'), 0, '(34) 99999-1001'),
  ('Maria Santos', 'maria.santos@teguniao.com.br', 'Técnica de Segurança', 'SSMA',
   (SELECT id FROM obras WHERE codigo = 'PARACATU'), 0, '(34) 99999-1002'),
  ('Carlos Oliveira', 'carlos.oliveira@teguniao.com.br', 'Almoxarife', 'Suprimentos',
   (SELECT id FROM obras WHERE codigo = 'PERDIZES'), 0, '(34) 99999-1003');
