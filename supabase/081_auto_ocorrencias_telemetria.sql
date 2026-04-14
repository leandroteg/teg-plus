-- 081_auto_ocorrencias_telemetria.sql — Auto-generate fro_ocorrencias_telemetria from tel_eventos
-- Trigger on tel_eventos AFTER INSERT maps Cobli event types to ocorrencia types

CREATE OR REPLACE FUNCTION fn_auto_ocorrencia_from_tel_evento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_tipo fro_tipo_ocorrencia;
  v_veiculo_id uuid;
  v_exists boolean;
BEGIN
  -- Map Cobli event types to ocorrencia types
  CASE NEW.tipo_evento
    WHEN 'speed_alert'        THEN v_tipo := 'excesso_velocidade';
    WHEN 'hard_brake'         THEN v_tipo := 'frenagem_brusca';
    WHEN 'hard_acceleration'  THEN v_tipo := 'aceleracao_brusca';
    WHEN 'hard_cornering'     THEN v_tipo := 'outro';
    ELSE RETURN NEW; -- ignore other event types
  END CASE;

  -- Resolve veiculo_id: use from event or lookup by placa
  v_veiculo_id := NEW.veiculo_id;
  IF v_veiculo_id IS NULL THEN
    SELECT id INTO v_veiculo_id
    FROM fro_veiculos
    WHERE placa = NEW.placa
    LIMIT 1;
  END IF;

  -- If no vehicle found, skip
  IF v_veiculo_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Dedup: skip if same veiculo_id + tipo within 5 minutes
  SELECT EXISTS(
    SELECT 1
    FROM fro_ocorrencias_telemetria
    WHERE veiculo_id = v_veiculo_id
      AND tipo_ocorrencia = v_tipo
      AND data_ocorrencia BETWEEN (NEW.cobli_ts - interval '5 minutes') AND (NEW.cobli_ts + interval '5 minutes')
  ) INTO v_exists;

  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Insert the ocorrencia
  INSERT INTO fro_ocorrencias_telemetria (
    veiculo_id,
    tipo_ocorrencia,
    latitude,
    longitude,
    velocidade,
    data_ocorrencia,
    status,
    observacoes
  ) VALUES (
    v_veiculo_id,
    v_tipo,
    NEW.latitude,
    NEW.longitude,
    NEW.velocidade,
    NEW.cobli_ts,
    'registrada',
    'Auto-gerado por telemetria Cobli: ' || NEW.tipo_evento
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
DO $$ BEGIN
  CREATE TRIGGER trg_auto_ocorrencia_from_tel_evento
    AFTER INSERT ON tel_eventos
    FOR EACH ROW
    EXECUTE FUNCTION fn_auto_ocorrencia_from_tel_evento();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
