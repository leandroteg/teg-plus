-- Issue #162: Campo de justificativa para requisição urgente
-- Adiciona coluna justificativa_urgencia na tabela cmp_requisicoes
ALTER TABLE cmp_requisicoes ADD COLUMN IF NOT EXISTS justificativa_urgencia text;

COMMENT ON COLUMN cmp_requisicoes.justificativa_urgencia IS 'Justificativa obrigatória quando urgência é urgente ou crítica';
