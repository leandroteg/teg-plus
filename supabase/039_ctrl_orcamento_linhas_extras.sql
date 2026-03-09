-- 039: Add extra columns to ctrl_orcamento_linhas for Controle Orcamentario view
-- premissa: budget assumption text
-- desvio_explicacao: explanation of why deviation occurred
-- plano_acao: action plan text (rows with this filled get a star)

ALTER TABLE ctrl_orcamento_linhas ADD COLUMN IF NOT EXISTS premissa text;
ALTER TABLE ctrl_orcamento_linhas ADD COLUMN IF NOT EXISTS desvio_explicacao text;
ALTER TABLE ctrl_orcamento_linhas ADD COLUMN IF NOT EXISTS plano_acao text;
