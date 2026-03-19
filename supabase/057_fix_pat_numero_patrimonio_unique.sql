-- Fix #147: Prevent duplicate numero_patrimonio in pat_imobilizados
-- Root cause: trigger fn_processar_recebimento_item used only 4 chars of UUID
-- + second-precision timestamp, causing collisions on rapid retries.
-- Fix: use clock_timestamp() with microseconds + 8 chars of UUID (no dashes).
-- Also adds rollback logic reference (frontend handles orphaned headers).

-- See fn_processar_recebimento_item in main body — v_pat_num now uses:
-- 'PAT-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS') || '-' || substr(replace(NEW.id::text, '-', ''), 1, 8)
-- This gives ~16 extra chars of entropy vs the old 4-char version.
