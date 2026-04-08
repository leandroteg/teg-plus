-- Migration: Add address and contact fields to est_bases
-- Already applied to production DB; file kept for version control.

ALTER TABLE est_bases ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE est_bases ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE est_bases ADD COLUMN IF NOT EXISTS uf TEXT;
ALTER TABLE est_bases ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE est_bases ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE est_bases ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE est_bases ADD COLUMN IF NOT EXISTS email TEXT;
