-- 079: Devolver requisição ao solicitante (disparado pelo cotador durante a cotação)
-- Adiciona status 'devolvida_solicitante' e colunas de auditoria em cmp_requisicoes.
-- Modelo análogo ao fluxo de esclarecimento (019_esclarecimento_flow.sql), porém
-- disparado pelo comprador durante a cotação quando percebe que o escopo da RC
-- está incompleto/incorreto: a cotação é cancelada, aprovações pendentes anteriores
-- são invalidadas e o solicitante reedita a RC, reiniciando o ciclo de aprovação.

ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'devolvida_solicitante';

ALTER TABLE cmp_requisicoes
  ADD COLUMN IF NOT EXISTS devolucao_msg text,
  ADD COLUMN IF NOT EXISTS devolucao_por varchar(200),
  ADD COLUMN IF NOT EXISTS devolucao_em  timestamptz;
