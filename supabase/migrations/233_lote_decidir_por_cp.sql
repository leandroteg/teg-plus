-- ─────────────────────────────────────────────────────────────────────────────
-- 233 — Atalho da decisão por título usando (lote_id, cp_id)
--
-- O card de aprovação (AprovAi) monta os itens com o cp_id, não com o id da
-- linha de fin_lote_itens. Em vez de o frontend carregar o lote só para
-- descobrir o id do item, esta função resolve e delega para a
-- fin_lote_item_decidir (mig 232).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_lote_decidir_cp(
  p_lote_id uuid,
  p_cp_id   uuid,
  p_decisao text,
  p_motivo  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item_id uuid;
BEGIN
  SELECT id INTO v_item_id
    FROM fin_lote_itens
   WHERE lote_id = p_lote_id AND cp_id = p_cp_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Titulo nao encontrado neste lote — recarregue a pagina';
  END IF;

  RETURN public.fin_lote_item_decidir(v_item_id, p_decisao, p_motivo);
END;
$function$;

COMMENT ON FUNCTION public.fin_lote_decidir_cp(uuid, uuid, text, text) IS
  'Decide um titulo do lote a partir do par (lote_id, cp_id) — usado pelo card de aprovacao.';

GRANT EXECUTE ON FUNCTION public.fin_lote_decidir_cp(uuid, uuid, text, text) TO authenticated;
