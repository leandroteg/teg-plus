-- 083_auto_sync_hodometro.sql — Auto-sync hodometro from telemetry to fro_veiculos
-- 1. Trigger: update fro_veiculos.hodometro_atual on each new tel_posicoes row
-- 2. Bulk function: one-shot sync from tel_ultima_posicao view

-- 1. Trigger function: auto-update hodometro on new telemetry position
CREATE OR REPLACE FUNCTION fn_auto_update_hodometro()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.veiculo_id IS NOT NULL AND NEW.hodometro IS NOT NULL THEN
    UPDATE fro_veiculos
    SET hodometro_atual = NEW.hodometro,
        updated_at = now()
    WHERE id = NEW.veiculo_id
      AND hodometro_atual < NEW.hodometro;
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_auto_update_hodometro
    AFTER INSERT ON tel_posicoes
    FOR EACH ROW
    EXECUTE FUNCTION fn_auto_update_hodometro();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Bulk sync function for manual/scheduled use
CREATE OR REPLACE FUNCTION fn_sync_hodometro_bulk()
RETURNS void LANGUAGE sql AS $$
  UPDATE fro_veiculos v
  SET hodometro_atual = p.hodometro,
      updated_at = now()
  FROM tel_ultima_posicao p
  WHERE v.id = p.veiculo_id
    AND p.hodometro IS NOT NULL
    AND p.hodometro > v.hodometro_atual;
$$;
