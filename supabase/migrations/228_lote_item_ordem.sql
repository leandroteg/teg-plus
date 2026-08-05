-- ─────────────────────────────────────────────────────────────────────────────
-- 228 — Numeração dos títulos dentro do lote de pagamento
--
-- O lote listava os títulos sem nenhum número: quem leva a relação para o banco
-- não tinha como dizer "o item 3" nem conferir item a item o que já pagou.
--
-- Cada item ganha `ordem`, de 1 a N dentro do lote, sempre do MENOR para o
-- MAIOR valor (pedido do user 05/ago).
--
-- A renumeração é feita por trigger e não pelo front porque mexe em
-- fin_lote_itens de vários lugares: criação do lote, adicionar/remover título
-- no LoteDetalhe e o split de aprovação parcial no AprovAí. Um só ponto no
-- banco garante que nenhum caminho deixe a numeração furada.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fin_lote_itens
  ADD COLUMN IF NOT EXISTS ordem INTEGER;

COMMENT ON COLUMN public.fin_lote_itens.ordem IS
  'Numero do titulo dentro do lote (1..N), do menor para o maior valor. Mantido por trigger.';

CREATE OR REPLACE FUNCTION public.fin_lote_renumerar(p_lote_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE fin_lote_itens li
  SET ordem = r.rn
  FROM (
    SELECT id,
           row_number() OVER (ORDER BY valor ASC, created_at ASC, id ASC) AS rn
    FROM fin_lote_itens
    WHERE lote_id = p_lote_id
  ) r
  WHERE li.id = r.id
    AND li.ordem IS DISTINCT FROM r.rn;
$function$;

CREATE OR REPLACE FUNCTION public.fin_lote_itens_renumerar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Item movido de lote renumera os dois lados.
  IF TG_OP = 'UPDATE' AND NEW.lote_id IS DISTINCT FROM OLD.lote_id THEN
    PERFORM fin_lote_renumerar(OLD.lote_id);
  END IF;
  PERFORM fin_lote_renumerar(COALESCE(NEW.lote_id, OLD.lote_id));
  RETURN NULL;
END;
$function$;

-- Só dispara em valor/lote_id: o UPDATE da própria coluna `ordem` feito acima
-- não reentra na trigger, então não há recursão.
DROP TRIGGER IF EXISTS trg_fin_lote_itens_renumerar ON public.fin_lote_itens;
CREATE TRIGGER trg_fin_lote_itens_renumerar
  AFTER INSERT OR DELETE OR UPDATE OF valor, lote_id ON public.fin_lote_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.fin_lote_itens_renumerar();

-- Backfill dos lotes que já existem.
DO $$
DECLARE v_lote uuid;
BEGIN
  FOR v_lote IN SELECT DISTINCT lote_id FROM fin_lote_itens LOOP
    PERFORM fin_lote_renumerar(v_lote);
  END LOOP;
END $$;
