-- Adiciona campo diretorio_url na tabela de contratos
-- Permite armazenar link do SharePoint ou outro repositório web de arquivos

ALTER TABLE con_contratos ADD COLUMN IF NOT EXISTS diretorio_url text;

COMMENT ON COLUMN con_contratos.diretorio_url IS 'URL do diretório do contrato (SharePoint, Drive, etc.)';
