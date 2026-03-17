-- =============================================================================
-- 049 - Tesouraria foundation
-- Creates isolated Tesouraria tables, dashboard RPC, saldo recomputation
-- functions, and storage bucket for statement imports.
-- This migration is read/additive for CP/CR: it does not alter existing
-- payment/receivables flows, only aggregates them into Tesouraria.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fin_contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  banco_codigo TEXT,
  banco_nome TEXT,
  agencia TEXT,
  conta TEXT,
  tipo TEXT NOT NULL DEFAULT 'corrente'
    CHECK (tipo IN ('corrente', 'poupanca', 'investimento')),
  saldo_atual NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_atualizado_em TIMESTAMPTZ,
  cor TEXT NOT NULL DEFAULT '#14B8A6',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.fin_movimentacoes_tesouraria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.fin_contas_bancarias(id) ON DELETE CASCADE,
  conta_destino_id UUID REFERENCES public.fin_contas_bancarias(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'transferencia')),
  valor NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  data_movimentacao DATE NOT NULL,
  data_competencia DATE,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'outros',
  cp_id UUID REFERENCES public.fin_contas_pagar(id) ON DELETE SET NULL,
  cr_id UUID REFERENCES public.fin_contas_receber(id) ON DELETE SET NULL,
  conciliado BOOLEAN NOT NULL DEFAULT false,
  conciliado_em TIMESTAMPTZ,
  origem TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'import_ofx', 'import_csv', 'auto_cp', 'auto_cr')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE TABLE IF NOT EXISTS public.fin_extratos_import (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES public.fin_contas_bancarias(id) ON DELETE CASCADE,
  arquivo_url TEXT,
  nome_arquivo TEXT,
  formato TEXT NOT NULL CHECK (formato IN ('ofx', 'csv')),
  periodo_inicio DATE,
  periodo_fim DATE,
  total_registros INTEGER NOT NULL DEFAULT 0,
  importados INTEGER NOT NULL DEFAULT 0,
  duplicados INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processando'
    CHECK (status IN ('processando', 'concluido', 'erro')),
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_fin_contas_bancarias_ativo
  ON public.fin_contas_bancarias (ativo, saldo_atual DESC);

CREATE INDEX IF NOT EXISTS idx_fin_mov_tes_conta
  ON public.fin_movimentacoes_tesouraria (conta_id, data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_fin_mov_tes_destino
  ON public.fin_movimentacoes_tesouraria (conta_destino_id, data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_fin_mov_tes_tipo
  ON public.fin_movimentacoes_tesouraria (tipo, data_movimentacao DESC);

CREATE INDEX IF NOT EXISTS idx_fin_mov_tes_cp
  ON public.fin_movimentacoes_tesouraria (cp_id)
  WHERE cp_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_mov_tes_cr
  ON public.fin_movimentacoes_tesouraria (cr_id)
  WHERE cr_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fin_extratos_import_conta
  ON public.fin_extratos_import (conta_id, created_at DESC);

ALTER TABLE public.fin_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_movimentacoes_tesouraria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_extratos_import ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fin_contas_bancarias'
      AND policyname = 'fin_tes_contas_read_auth'
  ) THEN
    CREATE POLICY "fin_tes_contas_read_auth" ON public.fin_contas_bancarias
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fin_contas_bancarias'
      AND policyname = 'fin_tes_contas_write_auth'
  ) THEN
    CREATE POLICY "fin_tes_contas_write_auth" ON public.fin_contas_bancarias
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fin_movimentacoes_tesouraria'
      AND policyname = 'fin_tes_mov_read_auth'
  ) THEN
    CREATE POLICY "fin_tes_mov_read_auth" ON public.fin_movimentacoes_tesouraria
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fin_movimentacoes_tesouraria'
      AND policyname = 'fin_tes_mov_write_auth'
  ) THEN
    CREATE POLICY "fin_tes_mov_write_auth" ON public.fin_movimentacoes_tesouraria
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fin_extratos_import'
      AND policyname = 'fin_tes_import_read_auth'
  ) THEN
    CREATE POLICY "fin_tes_import_read_auth" ON public.fin_extratos_import
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fin_extratos_import'
      AND policyname = 'fin_tes_import_write_auth'
  ) THEN
    CREATE POLICY "fin_tes_import_write_auth" ON public.fin_extratos_import
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_tesouraria_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fin_contas_bancarias_touch ON public.fin_contas_bancarias;
CREATE TRIGGER trg_fin_contas_bancarias_touch
BEFORE UPDATE ON public.fin_contas_bancarias
FOR EACH ROW EXECUTE FUNCTION public.fn_tesouraria_touch_updated_at();

DROP TRIGGER IF EXISTS trg_fin_mov_tes_touch ON public.fin_movimentacoes_tesouraria;
CREATE TRIGGER trg_fin_mov_tes_touch
BEFORE UPDATE ON public.fin_movimentacoes_tesouraria
FOR EACH ROW EXECUTE FUNCTION public.fn_tesouraria_touch_updated_at();

DROP TRIGGER IF EXISTS trg_fin_extratos_touch ON public.fin_extratos_import;
CREATE TRIGGER trg_fin_extratos_touch
BEFORE UPDATE ON public.fin_extratos_import
FOR EACH ROW EXECUTE FUNCTION public.fn_tesouraria_touch_updated_at();

CREATE OR REPLACE FUNCTION public.fn_recalcular_saldo_tesouraria(p_conta_id UUID)
RETURNS VOID AS $$
DECLARE
  v_saldo NUMERIC(14,2);
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN tipo = 'entrada' THEN valor
      WHEN tipo = 'saida' THEN -valor
      WHEN tipo = 'transferencia' THEN -valor
      ELSE 0
    END
  ), 0)
  INTO v_saldo
  FROM public.fin_movimentacoes_tesouraria
  WHERE conta_id = p_conta_id;

  UPDATE public.fin_contas_bancarias
     SET saldo_atual = COALESCE(v_saldo, 0),
         saldo_atualizado_em = now()
   WHERE id = p_conta_id;

  UPDATE public.fin_contas_bancarias destino
     SET saldo_atual = COALESCE((
       SELECT SUM(
         CASE
           WHEN tipo = 'entrada' THEN valor
           WHEN tipo = 'saida' THEN -valor
           WHEN tipo = 'transferencia' AND conta_destino_id = destino.id THEN valor
           WHEN tipo = 'transferencia' THEN -valor
           ELSE 0
         END
       )
       FROM public.fin_movimentacoes_tesouraria
       WHERE conta_id = destino.id OR conta_destino_id = destino.id
     ), 0),
         saldo_atualizado_em = now()
   WHERE destino.id = p_conta_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_tesouraria_sync_saldo()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recalcular_saldo_tesouraria(OLD.conta_id);
    IF OLD.conta_destino_id IS NOT NULL THEN
      PERFORM public.fn_recalcular_saldo_tesouraria(OLD.conta_destino_id);
    END IF;
    RETURN OLD;
  END IF;

  PERFORM public.fn_recalcular_saldo_tesouraria(NEW.conta_id);
  IF NEW.conta_destino_id IS NOT NULL THEN
    PERFORM public.fn_recalcular_saldo_tesouraria(NEW.conta_destino_id);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.conta_id IS DISTINCT FROM NEW.conta_id THEN
      PERFORM public.fn_recalcular_saldo_tesouraria(OLD.conta_id);
    END IF;
    IF OLD.conta_destino_id IS DISTINCT FROM NEW.conta_destino_id AND OLD.conta_destino_id IS NOT NULL THEN
      PERFORM public.fn_recalcular_saldo_tesouraria(OLD.conta_destino_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fin_tesouraria_sync_saldo ON public.fin_movimentacoes_tesouraria;
CREATE TRIGGER trg_fin_tesouraria_sync_saldo
AFTER INSERT OR UPDATE OR DELETE ON public.fin_movimentacoes_tesouraria
FOR EACH ROW EXECUTE FUNCTION public.fn_tesouraria_sync_saldo();

CREATE OR REPLACE FUNCTION public.get_tesouraria_dashboard(p_periodo TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dias INTEGER;
  v_data_inicio DATE;
  v_data_inicio_anterior DATE;
  v_fluxo JSONB;
  v_period_days NUMERIC;
  v_saldo_inicial NUMERIC(14,2);
  v_entradas_periodo NUMERIC(14,2);
  v_saidas_periodo NUMERIC(14,2);
  v_entradas_periodo_anterior NUMERIC(14,2);
  v_saidas_periodo_anterior NUMERIC(14,2);
  v_lancamentos_pendentes INTEGER;
  v_contas_negativas INTEGER;
BEGIN
  v_dias := CASE p_periodo
    WHEN '7d' THEN 7
    WHEN '60d' THEN 60
    WHEN '90d' THEN 90
    ELSE 30
  END;

  v_data_inicio := CURRENT_DATE - (v_dias - 1);
  v_data_inicio_anterior := v_data_inicio - v_dias;
  v_period_days := GREATEST(v_dias, 1);

  SELECT COALESCE(SUM(
    CASE
      WHEN tipo = 'entrada' THEN valor
      WHEN tipo = 'saida' THEN -valor
      WHEN tipo = 'transferencia' AND conta_destino_id IS NOT NULL THEN 0
      WHEN tipo = 'transferencia' THEN -valor
      ELSE 0
    END
  ), 0)
    INTO v_saldo_inicial
  FROM public.fin_movimentacoes_tesouraria
  WHERE data_movimentacao < v_data_inicio;

  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO v_entradas_periodo, v_saidas_periodo
  FROM public.fin_movimentacoes_tesouraria
  WHERE data_movimentacao >= v_data_inicio;

  SELECT
    COALESCE(SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END), 0)
    INTO v_entradas_periodo_anterior, v_saidas_periodo_anterior
  FROM public.fin_movimentacoes_tesouraria
  WHERE data_movimentacao >= v_data_inicio_anterior
    AND data_movimentacao < v_data_inicio;

  SELECT COUNT(*)
    INTO v_lancamentos_pendentes
  FROM public.fin_movimentacoes_tesouraria
  WHERE conciliado = false
    AND data_movimentacao >= v_data_inicio;

  SELECT COUNT(*)
    INTO v_contas_negativas
  FROM public.fin_contas_bancarias
  WHERE ativo = true
    AND saldo_atual < 0;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'data', fluxo.data,
      'entradas', fluxo.entradas,
      'saidas', fluxo.saidas
    ) ORDER BY fluxo.data), '[]'::jsonb)
    INTO v_fluxo
  FROM (
    SELECT
      dias.dia::date AS data,
      COALESCE(SUM(CASE WHEN m.tipo = 'entrada' THEN m.valor ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN m.tipo = 'saida' THEN m.valor ELSE 0 END), 0) AS saidas
    FROM generate_series(v_data_inicio, CURRENT_DATE, interval '1 day') AS dias(dia)
    LEFT JOIN public.fin_movimentacoes_tesouraria m
      ON m.data_movimentacao = dias.dia::date
    GROUP BY dias.dia
  ) AS fluxo;

  RETURN jsonb_build_object(
    'saldo_total', COALESCE((SELECT SUM(saldo_atual) FROM public.fin_contas_bancarias WHERE ativo = true), 0),
    'saldo_inicial_periodo', COALESCE(v_saldo_inicial, 0),
    'saldo_final_periodo', COALESCE(v_saldo_inicial, 0) + COALESCE(v_entradas_periodo, 0) - COALESCE(v_saidas_periodo, 0),
    'entradas_periodo', COALESCE(v_entradas_periodo, 0),
    'saidas_periodo', COALESCE(v_saidas_periodo, 0),
    'entradas_periodo_anterior', COALESCE(v_entradas_periodo_anterior, 0),
    'saidas_periodo_anterior', COALESCE(v_saidas_periodo_anterior, 0),
    'contas', COALESCE((
      SELECT jsonb_agg(to_jsonb(c) ORDER BY c.saldo_atual DESC)
      FROM public.fin_contas_bancarias c
      WHERE c.ativo = true
    ), '[]'::jsonb),
    'movimentacoes_recentes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'conta_id', m.conta_id,
        'conta_destino_id', m.conta_destino_id,
        'tipo', m.tipo,
        'valor', m.valor,
        'data_movimentacao', m.data_movimentacao,
        'data_competencia', m.data_competencia,
        'descricao', m.descricao,
        'categoria', m.categoria,
        'cp_id', m.cp_id,
        'cr_id', m.cr_id,
        'conciliado', m.conciliado,
        'conciliado_em', m.conciliado_em,
        'origem', m.origem,
        'conta_nome', c.nome,
        'conta_cor', c.cor,
        'conta_destino_nome', destino.nome,
        'conta_destino_cor', destino.cor,
        'created_at', m.created_at
      ) ORDER BY m.data_movimentacao DESC, m.created_at DESC)
      FROM (
        SELECT *
        FROM public.fin_movimentacoes_tesouraria
        WHERE data_movimentacao >= v_data_inicio
        ORDER BY data_movimentacao DESC, created_at DESC
        LIMIT 50
      ) m
      JOIN public.fin_contas_bancarias c ON c.id = m.conta_id
      LEFT JOIN public.fin_contas_bancarias destino ON destino.id = m.conta_destino_id
    ), '[]'::jsonb),
    'fluxo_diario', COALESCE(v_fluxo, '[]'::jsonb),
    'previsao_cp', COALESCE((
      SELECT SUM(valor_original - COALESCE(valor_pago, 0))
      FROM public.fin_contas_pagar
      WHERE status NOT IN ('pago', 'conciliado', 'cancelado')
        AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    ), 0),
    'previsao_cr', COALESCE((
      SELECT SUM(valor_original - COALESCE(valor_recebido, 0))
      FROM public.fin_contas_receber
      WHERE status NOT IN ('recebido', 'conciliado', 'cancelado')
        AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    ), 0),
    'aging_cp', jsonb_build_object(
      'hoje', COALESCE((
        SELECT SUM(valor_original - COALESCE(valor_pago, 0))
        FROM public.fin_contas_pagar
        WHERE status NOT IN ('pago', 'conciliado', 'cancelado')
          AND data_vencimento <= CURRENT_DATE
      ), 0),
      'd7', COALESCE((
        SELECT SUM(valor_original - COALESCE(valor_pago, 0))
        FROM public.fin_contas_pagar
        WHERE status NOT IN ('pago', 'conciliado', 'cancelado')
          AND data_vencimento > CURRENT_DATE
          AND data_vencimento <= CURRENT_DATE + 7
      ), 0),
      'd30', COALESCE((
        SELECT SUM(valor_original - COALESCE(valor_pago, 0))
        FROM public.fin_contas_pagar
        WHERE status NOT IN ('pago', 'conciliado', 'cancelado')
          AND data_vencimento > CURRENT_DATE + 7
          AND data_vencimento <= CURRENT_DATE + 30
      ), 0),
      'd60', COALESCE((
        SELECT SUM(valor_original - COALESCE(valor_pago, 0))
        FROM public.fin_contas_pagar
        WHERE status NOT IN ('pago', 'conciliado', 'cancelado')
          AND data_vencimento > CURRENT_DATE + 30
      ), 0)
    ),
    'aging_cr', jsonb_build_object(
      'hoje', COALESCE((
        SELECT SUM(valor_original - COALESCE(valor_recebido, 0))
        FROM public.fin_contas_receber
        WHERE status NOT IN ('recebido', 'conciliado', 'cancelado')
          AND data_vencimento <= CURRENT_DATE
      ), 0),
      'd7', COALESCE((
        SELECT SUM(valor_original - COALESCE(valor_recebido, 0))
        FROM public.fin_contas_receber
        WHERE status NOT IN ('recebido', 'conciliado', 'cancelado')
          AND data_vencimento > CURRENT_DATE
          AND data_vencimento <= CURRENT_DATE + 7
      ), 0),
      'd30', COALESCE((
        SELECT SUM(valor_original - COALESCE(valor_recebido, 0))
        FROM public.fin_contas_receber
        WHERE status NOT IN ('recebido', 'conciliado', 'cancelado')
          AND data_vencimento > CURRENT_DATE + 7
          AND data_vencimento <= CURRENT_DATE + 30
      ), 0),
      'd60', COALESCE((
        SELECT SUM(valor_original - COALESCE(valor_recebido, 0))
        FROM public.fin_contas_receber
        WHERE status NOT IN ('recebido', 'conciliado', 'cancelado')
          AND data_vencimento > CURRENT_DATE + 30
      ), 0)
    ),
    'comparativos', jsonb_build_object(
      'entradas_percentual', CASE
        WHEN COALESCE(v_entradas_periodo_anterior, 0) = 0 AND COALESCE(v_entradas_periodo, 0) > 0 THEN 100
        WHEN COALESCE(v_entradas_periodo_anterior, 0) = 0 THEN 0
        ELSE ROUND(((COALESCE(v_entradas_periodo, 0) - COALESCE(v_entradas_periodo_anterior, 0)) / NULLIF(v_entradas_periodo_anterior, 0)) * 100, 1)
      END,
      'saidas_percentual', CASE
        WHEN COALESCE(v_saidas_periodo_anterior, 0) = 0 AND COALESCE(v_saidas_periodo, 0) > 0 THEN 100
        WHEN COALESCE(v_saidas_periodo_anterior, 0) = 0 THEN 0
        ELSE ROUND(((COALESCE(v_saidas_periodo, 0) - COALESCE(v_saidas_periodo_anterior, 0)) / NULLIF(v_saidas_periodo_anterior, 0)) * 100, 1)
      END
    ),
    'indicadores', jsonb_build_object(
      'saldo_disponivel', COALESCE((SELECT SUM(saldo_atual) FROM public.fin_contas_bancarias WHERE ativo = true), 0),
      'saldo_projetado_30d', COALESCE((SELECT SUM(saldo_atual) FROM public.fin_contas_bancarias WHERE ativo = true), 0)
        + COALESCE((
          SELECT SUM(valor_original - COALESCE(valor_recebido, 0))
          FROM public.fin_contas_receber
          WHERE status NOT IN ('recebido', 'conciliado', 'cancelado')
            AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        ), 0)
        - COALESCE((
          SELECT SUM(valor_original - COALESCE(valor_pago, 0))
          FROM public.fin_contas_pagar
          WHERE status NOT IN ('pago', 'conciliado', 'cancelado')
            AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        ), 0),
      'queima_media_diaria', ROUND(COALESCE(v_saidas_periodo, 0) / v_period_days, 2),
      'cobertura_dias', CASE
        WHEN COALESCE(v_saidas_periodo, 0) <= 0 THEN NULL
        ELSE ROUND(COALESCE((SELECT SUM(saldo_atual) FROM public.fin_contas_bancarias WHERE ativo = true), 0) / NULLIF(v_saidas_periodo / v_period_days, 0), 1)
      END
    ),
    'alertas', COALESCE((
      SELECT jsonb_agg(alerta)
      FROM (
        SELECT jsonb_build_object(
          'id', 'saldo_negativo',
          'tipo', 'critico',
          'titulo', 'Conta com saldo negativo',
          'descricao', format('%s conta(s) bancaria(s) estao negativas neste momento.', v_contas_negativas)
        ) AS alerta
        WHERE v_contas_negativas > 0

        UNION ALL

        SELECT jsonb_build_object(
          'id', 'caixa_projetado',
          'tipo', 'alto',
          'titulo', 'Caixa projetado negativo em 30 dias',
          'descricao', 'O saldo projetado para os proximos 30 dias esta negativo. Priorize recebimentos ou renegocie saidas.'
        ) AS alerta
        WHERE (
          COALESCE((SELECT SUM(saldo_atual) FROM public.fin_contas_bancarias WHERE ativo = true), 0)
          + COALESCE((
            SELECT SUM(valor_original - COALESCE(valor_recebido, 0))
            FROM public.fin_contas_receber
            WHERE status NOT IN ('recebido', 'conciliado', 'cancelado')
              AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
          ), 0)
          - COALESCE((
            SELECT SUM(valor_original - COALESCE(valor_pago, 0))
            FROM public.fin_contas_pagar
            WHERE status NOT IN ('pago', 'conciliado', 'cancelado')
              AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
          ), 0)
        ) < 0

        UNION ALL

        SELECT jsonb_build_object(
          'id', 'conciliacao_pendente',
          'tipo', 'medio',
          'titulo', 'Lancamentos pendentes de conciliacao',
          'descricao', format('%s movimentacao(oes) no periodo ainda nao foram conciliadas.', v_lancamentos_pendentes)
        ) AS alerta
        WHERE v_lancamentos_pendentes > 0
      ) alertas
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tesouraria_dashboard(TEXT) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'tesouraria-extratos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('tesouraria-extratos', 'tesouraria-extratos', true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tesouraria_extratos_read_auth'
  ) THEN
    CREATE POLICY "tesouraria_extratos_read_auth"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'tesouraria-extratos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tesouraria_extratos_write_auth'
  ) THEN
    CREATE POLICY "tesouraria_extratos_write_auth"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'tesouraria-extratos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tesouraria_extratos_update_auth'
  ) THEN
    CREATE POLICY "tesouraria_extratos_update_auth"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'tesouraria-extratos')
      WITH CHECK (bucket_id = 'tesouraria-extratos');
  END IF;
END $$;

COMMIT;
