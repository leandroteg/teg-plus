-- Adicionar campos para destino de carga e fotos no recebimento logístico
ALTER TABLE log_recebimentos ADD COLUMN IF NOT EXISTS fotos_recebimento JSONB DEFAULT '[]';
ALTER TABLE log_recebimentos ADD COLUMN IF NOT EXISTS destino TEXT DEFAULT 'nenhum' CHECK (destino IN ('consumo','patrimonial','nenhum'));
ALTER TABLE log_recebimentos ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES est_bases(id);
