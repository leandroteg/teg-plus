-- OKRs trimestrais: a meta trimestral pode representar um Resultado-Chave (KR)
-- textual com prazo. 100% aditivo (colunas nullable) — não altera o que já existe.
ALTER TABLE sgi_metas ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE sgi_metas ADD COLUMN IF NOT EXISTS prazo date;
