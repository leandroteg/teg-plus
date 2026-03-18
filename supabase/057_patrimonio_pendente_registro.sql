-- Migration 057: Fix patrimonial items not appearing in "Aguardando Entrada"
--
-- Root cause:
--   1. Enum pat_status_imob was missing 'pendente_registro' value
--   2. Trigger fn_processar_recebimento_item only fired on 'confirmado' status,
--      so patrimonial items never got created in pat_imobilizados until estoque confirmation
--   3. On confirmation, trigger fell back to 'ativo' (instead of 'pendente_registro')
--      because the enum value didn't exist
--
-- Fix:
--   1. Add 'pendente_registro' to pat_status_imob enum
--   2. Rewrite trigger to:
--      - On INSERT of patrimonial item → create pat_imobilizados with 'pendente_registro'
--      - On UPDATE to 'confirmado' of patrimonial item → update existing to 'ativo'
--      - Consumo items → unchanged (only process on 'confirmado')
--   3. Backfill existing patrimonial items stuck in aguardando_entrada

BEGIN;

-- ── 1. Add 'pendente_registro' to pat_status_imob enum ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'pat_status_imob' AND e.enumlabel = 'pendente_registro'
  ) THEN
    ALTER TYPE public.pat_status_imob ADD VALUE 'pendente_registro';
  END IF;
END $$;

COMMIT;

-- enum ADD VALUE cannot run inside a multi-statement transaction in older PG,
-- so we commit above and start a new transaction for the rest.

BEGIN;

-- ── 2. Add recebimento_item_id to pat_imobilizados for linking ────────────────
ALTER TABLE public.pat_imobilizados
  ADD COLUMN IF NOT EXISTS recebimento_item_id UUID REFERENCES public.cmp_recebimento_itens(id);

CREATE INDEX IF NOT EXISTS idx_pat_imobilizados_receb_item
  ON public.pat_imobilizados (recebimento_item_id)
  WHERE recebimento_item_id IS NOT NULL;

-- ── 3. Rewrite trigger function ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_processar_recebimento_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_receb RECORD;
  v_item RECORD;
  v_responsavel_nome TEXT;
BEGIN
  -- ── CONSUMO: only process on confirmation (unchanged) ──────────────────────
  IF NEW.tipo_destino = 'consumo' THEN
    -- Guard: only on confirmed status
    IF TG_OP = 'INSERT' AND NEW.status <> 'confirmado' THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status <> 'confirmado' OR OLD.status = 'confirmado' THEN
        RETURN NEW;
      END IF;
    END IF;

    IF NEW.item_estoque_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Fetch recebimento context
    SELECT r.id, r.base_id, r.recebido_por, r.nf_numero,
           r.data_recebimento, r.observacao,
           p.fornecedor_nome,
           req.obra_nome, req.centro_custo
    INTO v_receb
    FROM public.cmp_recebimentos r
    JOIN public.cmp_pedidos p ON p.id = r.pedido_id
    LEFT JOIN public.cmp_requisicoes req ON req.id = p.requisicao_id
    WHERE r.id = NEW.recebimento_id;

    IF NOT FOUND THEN RETURN NEW; END IF;

    SELECT nome INTO v_responsavel_nome
    FROM public.sys_perfis WHERE id = v_receb.recebido_por;
    v_responsavel_nome := COALESCE(v_responsavel_nome, 'Sistema');

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

  -- ── PATRIMONIAL: process on INSERT (pendente) AND confirmation (ativo) ─────
  IF NEW.tipo_destino = 'patrimonial' THEN

    -- On INSERT: create pat_imobilizados with status 'pendente_registro'
    IF TG_OP = 'INSERT' THEN

      SELECT r.id, r.base_id, r.recebido_por, r.nf_numero,
             r.data_recebimento, r.observacao,
             p.fornecedor_nome
      INTO v_receb
      FROM public.cmp_recebimentos r
      JOIN public.cmp_pedidos p ON p.id = r.pedido_id
      WHERE r.id = NEW.recebimento_id;

      IF NOT FOUND THEN RETURN NEW; END IF;

      IF NEW.item_estoque_id IS NOT NULL THEN
        SELECT i.id, i.descricao,
          COALESCE(NULLIF(i.categoria, ''), 'GERAL') AS categoria
        INTO v_item
        FROM public.est_itens i WHERE i.id = NEW.item_estoque_id;
      END IF;

      SELECT nome INTO v_responsavel_nome
      FROM public.sys_perfis WHERE id = v_receb.recebido_por;
      v_responsavel_nome := COALESCE(v_responsavel_nome, 'Sistema');

      INSERT INTO public.pat_imobilizados (
        numero_patrimonio, descricao, categoria, numero_serie,
        base_id, responsavel_nome, responsavel_id,
        status, valor_aquisicao, data_aquisicao,
        fornecedor_nome, nf_compra_numero, observacoes,
        recebimento_item_id
      ) VALUES (
        'PAT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(NEW.id::text, 1, 4),
        COALESCE(NEW.descricao, v_item.descricao, 'Item patrimonial'),
        COALESCE(v_item.categoria, 'GERAL'),
        NEW.numero_serie,
        v_receb.base_id,
        v_responsavel_nome, v_receb.recebido_por,
        'pendente_registro'::public.pat_status_imob,
        COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade_recebida, 1),
        COALESCE(v_receb.data_recebimento::date, CURRENT_DATE),
        v_receb.fornecedor_nome, v_receb.nf_numero, v_receb.observacao,
        NEW.id
      );

      RETURN NEW;
    END IF;

    -- On UPDATE to 'confirmado': change pat_imobilizados status to 'ativo'
    IF TG_OP = 'UPDATE' AND NEW.status = 'confirmado' AND OLD.status <> 'confirmado' THEN
      UPDATE public.pat_imobilizados
      SET status = 'ativo'::public.pat_status_imob
      WHERE recebimento_item_id = NEW.id;

      -- If no linked record was found (edge case), create one
      IF NOT FOUND THEN
        SELECT r.id, r.base_id, r.recebido_por, r.nf_numero,
               r.data_recebimento, r.observacao,
               p.fornecedor_nome
        INTO v_receb
        FROM public.cmp_recebimentos r
        JOIN public.cmp_pedidos p ON p.id = r.pedido_id
        WHERE r.id = NEW.recebimento_id;

        IF NOT FOUND THEN RETURN NEW; END IF;

        IF NEW.item_estoque_id IS NOT NULL THEN
          SELECT i.id, i.descricao,
            COALESCE(NULLIF(i.categoria, ''), 'GERAL') AS categoria
          INTO v_item
          FROM public.est_itens i WHERE i.id = NEW.item_estoque_id;
        END IF;

        SELECT nome INTO v_responsavel_nome
        FROM public.sys_perfis WHERE id = v_receb.recebido_por;
        v_responsavel_nome := COALESCE(v_responsavel_nome, 'Sistema');

        INSERT INTO public.pat_imobilizados (
          numero_patrimonio, descricao, categoria, numero_serie,
          base_id, responsavel_nome, responsavel_id,
          status, valor_aquisicao, data_aquisicao,
          fornecedor_nome, nf_compra_numero, observacoes,
          recebimento_item_id
        ) VALUES (
          'PAT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(NEW.id::text, 1, 4),
          COALESCE(NEW.descricao, v_item.descricao, 'Item patrimonial'),
          COALESCE(v_item.categoria, 'GERAL'),
          NEW.numero_serie,
          v_receb.base_id,
          v_responsavel_nome, v_receb.recebido_por,
          'ativo'::public.pat_status_imob,
          COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade_recebida, 1),
          COALESCE(v_receb.data_recebimento::date, CURRENT_DATE),
          v_receb.fornecedor_nome, v_receb.nf_numero, v_receb.observacao,
          NEW.id
        );
      END IF;

      RETURN NEW;
    END IF;

    -- On UPDATE to 'rejeitado': remove the pending pat_imobilizados entry
    IF TG_OP = 'UPDATE' AND NEW.status = 'rejeitado' THEN
      DELETE FROM public.pat_imobilizados
      WHERE recebimento_item_id = NEW.id
        AND status = 'pendente_registro'::public.pat_status_imob;
      RETURN NEW;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_processar_recebimento_item() SET search_path = public;

-- ── 4. Backfill: create pat_imobilizados for existing patrimonial items ───────
-- Items with tipo_destino='patrimonial' and status='aguardando_entrada' that
-- don't yet have a pat_imobilizados entry
INSERT INTO public.pat_imobilizados (
  numero_patrimonio, descricao, categoria,
  base_id, responsavel_nome, responsavel_id,
  status, valor_aquisicao, data_aquisicao,
  fornecedor_nome, nf_compra_numero, observacoes,
  recebimento_item_id
)
SELECT
  'PAT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(ri.id::text, 1, 4),
  ri.descricao,
  COALESCE(NULLIF(ei.categoria, ''), 'GERAL'),
  r.base_id,
  COALESCE(sp.nome, 'Sistema'),
  r.recebido_por,
  'pendente_registro'::public.pat_status_imob,
  COALESCE(ri.valor_unitario, 0) * COALESCE(ri.quantidade_recebida, 1),
  COALESCE(r.data_recebimento::date, CURRENT_DATE),
  p.fornecedor_nome,
  r.nf_numero,
  r.observacao,
  ri.id
FROM public.cmp_recebimento_itens ri
JOIN public.cmp_recebimentos r ON r.id = ri.recebimento_id
JOIN public.cmp_pedidos p ON p.id = r.pedido_id
LEFT JOIN public.est_itens ei ON ei.id = ri.item_estoque_id
LEFT JOIN public.sys_perfis sp ON sp.id = r.recebido_por
WHERE ri.tipo_destino = 'patrimonial'
  AND ri.status = 'aguardando_entrada'
  AND NOT EXISTS (
    SELECT 1 FROM public.pat_imobilizados pi
    WHERE pi.recebimento_item_id = ri.id
  );

COMMIT;
