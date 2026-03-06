-- ============================================================
-- Migration 029: Sync NF attachments from Pedidos → Fiscal
-- Backfill existing + trigger for auto-sync future inserts/deletes
-- ============================================================

-- 1. Backfill: insert existing NF attachments into fis_notas_fiscais
INSERT INTO fis_notas_fiscais (
  numero, data_emissao, data_entrada,
  fornecedor_id, fornecedor_nome, fornecedor_cnpj,
  valor_total, valor_desconto,
  origem, pedido_id,
  pdf_url,
  criado_em
)
SELECT
  p.nf_numero,
  COALESCE(p.data_pedido, CURRENT_DATE),
  COALESCE(pa.uploaded_at::date, CURRENT_DATE),
  p.fornecedor_id,
  p.fornecedor_nome,
  NULL,
  COALESCE(p.valor_total, 0),
  0,
  'pedido',
  pa.pedido_id,
  pa.url,
  COALESCE(pa.uploaded_at, NOW())
FROM cmp_pedidos_anexos pa
JOIN cmp_pedidos p ON p.id = pa.pedido_id
WHERE pa.tipo = 'nota_fiscal'
  AND NOT EXISTS (
    SELECT 1 FROM fis_notas_fiscais f
    WHERE f.pedido_id = pa.pedido_id
      AND f.pdf_url = pa.url
  );

-- 2. Trigger function: auto-sync new NF attachments
CREATE OR REPLACE FUNCTION sync_nf_from_pedido_anexo()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.tipo = 'nota_fiscal' THEN
    INSERT INTO fis_notas_fiscais (
      numero, data_emissao, data_entrada,
      fornecedor_id, fornecedor_nome,
      valor_total, valor_desconto,
      origem, pedido_id,
      pdf_url,
      criado_em
    )
    SELECT
      p.nf_numero,
      COALESCE(p.data_pedido, CURRENT_DATE),
      CURRENT_DATE,
      p.fornecedor_id,
      p.fornecedor_nome,
      COALESCE(p.valor_total, 0),
      0,
      'pedido',
      NEW.pedido_id,
      NEW.url,
      COALESCE(NEW.uploaded_at, NOW())
    FROM cmp_pedidos p
    WHERE p.id = NEW.pedido_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.tipo = 'nota_fiscal' THEN
    DELETE FROM fis_notas_fiscais
    WHERE pedido_id = OLD.pedido_id
      AND pdf_url = OLD.url
      AND origem = 'pedido';
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger
DROP TRIGGER IF EXISTS trg_sync_nf_to_fiscal ON cmp_pedidos_anexos;

CREATE TRIGGER trg_sync_nf_to_fiscal
  AFTER INSERT OR DELETE ON cmp_pedidos_anexos
  FOR EACH ROW
  EXECUTE FUNCTION sync_nf_from_pedido_anexo();

-- 4. Index for dedup guard
CREATE INDEX IF NOT EXISTS idx_fis_nf_pedido_url
  ON fis_notas_fiscais (pedido_id, pdf_url)
  WHERE pedido_id IS NOT NULL;
