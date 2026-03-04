-- 019: Esclarecimento flow — new enum values + columns
-- Adds 'em_esclarecimento' to status_requisicao
-- Adds 'esclarecimento' to status_aprovacao
-- Adds esclarecimento fields to cmp_requisicoes

ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'em_esclarecimento';
ALTER TYPE status_aprovacao ADD VALUE IF NOT EXISTS 'esclarecimento';

ALTER TABLE cmp_requisicoes
  ADD COLUMN IF NOT EXISTS esclarecimento_msg text,
  ADD COLUMN IF NOT EXISTS esclarecimento_por varchar(200),
  ADD COLUMN IF NOT EXISTS esclarecimento_em  timestamptz;
