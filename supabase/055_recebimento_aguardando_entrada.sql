-- Migration: Add status column to cmp_recebimento_itens
-- Items now go to 'aguardando_entrada' first, then 'confirmado' after physical validation.
-- The trigger only processes (creates est_movimentacoes / pat_imobilizados) when status = 'confirmado'.

BEGIN;

-- 1. Add status column with default 'aguardando_entrada'
ALTER TABLE public.cmp_recebimento_itens
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aguardando_entrada';

-- 2. Mark all existing items as already confirmed (backwards compat)
UPDATE public.cmp_recebimento_itens SET status = 'confirmado' WHERE status = 'aguardando_entrada';

-- 3. Add check constraint
ALTER TABLE public.cmp_recebimento_itens
  DROP CONSTRAINT IF EXISTS chk_recebimento_item_status;
ALTER TABLE public.cmp_recebimento_itens
  ADD CONSTRAINT chk_recebimento_item_status
  CHECK (status IN ('aguardando_entrada', 'confirmado', 'rejeitado'));

-- 3b. Fix tipo_destino constraint to include 'nenhum'
ALTER TABLE public.cmp_recebimento_itens
  DROP CONSTRAINT IF EXISTS cmp_recebimento_itens_tipo_destino_check;
ALTER TABLE public.cmp_recebimento_itens
  ADD CONSTRAINT cmp_recebimento_itens_tipo_destino_check
  CHECK (tipo_destino IN ('consumo', 'patrimonial', 'nenhum'));

-- 4. Index for pipeline query
CREATE INDEX IF NOT EXISTS idx_receb_itens_status
  ON public.cmp_recebimento_itens (status)
  WHERE status = 'aguardando_entrada';

-- 5. Recreate trigger function — only processes when status = 'confirmado'
CREATE OR REPLACE FUNCTION public.fn_processar_recebimento_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receb RECORD;
  v_item RECORD;
  v_responsavel_nome TEXT;
  v_patrimonio_status TEXT;
BEGIN
  -- Only process on confirmed status
  -- On INSERT: skip if not confirmed (aguardando_entrada)
  -- On UPDATE: only process when status changes TO 'confirmado'
  IF TG_OP = 'INSERT' AND NEW.status <> 'confirmado' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status <> 'confirmado' OR OLD.status = 'confirmado' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT
    r.id,
    r.base_id,
    r.recebido_por,
    r.nf_numero,
    r.data_recebimento,
    r.observacao,
    p.id AS pedido_id,
    p.fornecedor_nome,
    req.id AS requisicao_id,
    req.obra_nome,
    req.centro_custo
  INTO v_receb
  FROM public.cmp_recebimentos r
  JOIN public.cmp_pedidos p
    ON p.id = r.pedido_id
  LEFT JOIN public.cmp_requisicoes req
    ON req.id = p.requisicao_id
  WHERE r.id = NEW.recebimento_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recebimento % nao encontrado', NEW.recebimento_id;
  END IF;

  -- Lookup catalog item (optional)
  IF NEW.item_estoque_id IS NOT NULL THEN
    SELECT
      i.id,
      i.codigo,
      i.descricao,
      COALESCE(NULLIF(i.categoria, ''), 'GERAL') AS categoria
    INTO v_item
    FROM public.est_itens i
    WHERE i.id = NEW.item_estoque_id;
  END IF;

  SELECT nome
  INTO v_responsavel_nome
  FROM public.sys_perfis
  WHERE id = v_receb.recebido_por;

  v_responsavel_nome := COALESCE(v_responsavel_nome, 'Sistema');

  -- CONSUMO: create est_movimentacoes entry
  IF NEW.tipo_destino = 'consumo' THEN
    IF NEW.item_estoque_id IS NULL THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.est_movimentacoes (
      item_id, base_id, tipo, quantidade, valor_unitario,
      obra_nome, centro_custo, nf_numero, fornecedor_nome,
      lote, numero_serie, data_validade,
      responsavel_nome, responsavel_id, observacao
    ) VALUES (
      NEW.item_estoque_id, v_receb.base_id, 'entrada',
      NEW.quantidade_recebida, COALESCE(NEW.valor_unitario, 0),
      v_receb.obra_nome, v_receb.centro_custo,
      v_receb.nf_numero, v_receb.fornecedor_nome,
      NEW.lote, NEW.numero_serie, NEW.data_validade,
      v_responsavel_nome, v_receb.recebido_por, v_receb.observacao
    );

    RETURN NEW;
  END IF;

  -- PATRIMONIAL: create pat_imobilizados entry
  IF NEW.tipo_destino = 'patrimonial' THEN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'pat_status_imob'
          AND e.enumlabel = 'pendente_registro'
      )
      THEN 'pendente_registro'
      ELSE 'ativo'
    END
    INTO v_patrimonio_status;

    INSERT INTO public.pat_imobilizados (
      numero_patrimonio, descricao, categoria, numero_serie,
      base_id, base_nome, responsavel_nome, responsavel_id,
      status, valor_aquisicao, data_aquisicao,
      fornecedor_nome, nf_compra_numero, observacoes
    ) VALUES (
      'PAT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(NEW.id::text, 1, 4),
      COALESCE(NEW.descricao, v_item.descricao, 'Item patrimonial'),
      COALESCE(v_item.categoria, 'GERAL'),
      NEW.numero_serie,
      v_receb.base_id, NULL,
      v_responsavel_nome, v_receb.recebido_por,
      v_patrimonio_status::public.pat_status_imob,
      COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade_recebida, 1),
      COALESCE(v_receb.data_recebimento::date, CURRENT_DATE),
      v_receb.fornecedor_nome, v_receb.nf_numero, v_receb.observacao
    );

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_processar_recebimento_item() SET search_path = public;

-- 6. Ensure trigger fires on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_processar_recebimento_item ON public.cmp_recebimento_itens;
CREATE TRIGGER trg_processar_recebimento_item
  AFTER INSERT OR UPDATE ON public.cmp_recebimento_itens
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_processar_recebimento_item();

-- 7. RLS: allow update on cmp_recebimento_itens for status changes
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar recebimento_itens" ON public.cmp_recebimento_itens;
CREATE POLICY "Usuarios autenticados podem atualizar recebimento_itens"
  ON public.cmp_recebimento_itens
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
