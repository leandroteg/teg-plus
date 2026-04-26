-- 086_trigger_ocorrencias_multi_provedor.sql
-- Estende fn_auto_ocorrencia_from_tel_evento (originalmente em 081) para
-- suportar Mobi7. Mantém 100% do comportamento Cobli e adiciona switch
-- por NEW.provider para mapear eventos Mobi7.
-- Aplicada em 2026-04-26 via Supabase MCP.

CREATE OR REPLACE FUNCTION fn_auto_ocorrencia_from_tel_evento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_tipo fro_tipo_ocorrencia;
  v_veiculo_id uuid;
  v_exists boolean;
BEGIN
  CASE COALESCE(NEW.provider, 'cobli')
    -- ─── Cobli (preservado de 081) ────────────────────────────────────────
    WHEN 'cobli' THEN
      CASE NEW.tipo_evento
        WHEN 'speed_alert'        THEN v_tipo := 'excesso_velocidade';
        WHEN 'hard_brake'         THEN v_tipo := 'frenagem_brusca';
        WHEN 'hard_acceleration'  THEN v_tipo := 'aceleracao_brusca';
        WHEN 'hard_cornering'     THEN v_tipo := 'outro';
        ELSE RETURN NEW;
      END CASE;

    -- ─── Mobi7 ────────────────────────────────────────────────────────────
    WHEN 'mobi7' THEN
      CASE NEW.tipo_evento
        WHEN 'speeding'              THEN v_tipo := 'excesso_velocidade';
        WHEN 'speed_alert'           THEN v_tipo := 'excesso_velocidade';
        WHEN 'acceleration_light'    THEN v_tipo := 'aceleracao_brusca';
        WHEN 'acceleration_medium'   THEN v_tipo := 'aceleracao_brusca';
        WHEN 'acceleration_high'     THEN v_tipo := 'aceleracao_brusca';
        WHEN 'hard_acceleration'     THEN v_tipo := 'aceleracao_brusca';
        WHEN 'braking_light'         THEN v_tipo := 'frenagem_brusca';
        WHEN 'braking_medium'        THEN v_tipo := 'frenagem_brusca';
        WHEN 'braking_high'          THEN v_tipo := 'frenagem_brusca';
        WHEN 'hard_brake'            THEN v_tipo := 'frenagem_brusca';
        WHEN 'cornering'             THEN v_tipo := 'outro';
        WHEN 'hard_cornering'        THEN v_tipo := 'outro';
        ELSE RETURN NEW;
      END CASE;

    ELSE RETURN NEW;
  END CASE;

  v_veiculo_id := NEW.veiculo_id;
  IF v_veiculo_id IS NULL THEN
    SELECT id INTO v_veiculo_id FROM fro_veiculos WHERE placa = NEW.placa LIMIT 1;
  END IF;
  IF v_veiculo_id IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS(
    SELECT 1
    FROM fro_ocorrencias_telemetria
    WHERE veiculo_id = v_veiculo_id
      AND tipo_ocorrencia = v_tipo
      AND data_ocorrencia BETWEEN (NEW.cobli_ts - interval '5 minutes')
                              AND (NEW.cobli_ts + interval '5 minutes')
  ) INTO v_exists;
  IF v_exists THEN RETURN NEW; END IF;

  INSERT INTO fro_ocorrencias_telemetria (
    veiculo_id, tipo_ocorrencia, latitude, longitude, velocidade,
    data_ocorrencia, status, observacoes
  ) VALUES (
    v_veiculo_id, v_tipo, NEW.latitude, NEW.longitude, NEW.velocidade,
    NEW.cobli_ts, 'registrada',
    format('Auto-gerado por telemetria %s: %s', COALESCE(NEW.provider,'cobli'), NEW.tipo_evento)
  );

  RETURN NEW;
END;
$$;
