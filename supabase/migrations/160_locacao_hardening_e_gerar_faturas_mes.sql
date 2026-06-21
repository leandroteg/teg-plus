-- 160_locacao_hardening_e_gerar_faturas_mes.sql
-- Pacote de "concluir e validar envio de faturas" + auditoria para Locacao.
--
-- (1) Aplica trigger de auditoria (criado_por_nome / atualizado_por_nome)
--     em todas as tabelas loc_*  (replicando o padrao da mig 121).
-- (2) RLS hardening: troca policies abertas (qual=true) por padrao modular
--     (SELECT aberto p/ autenticados, ALL via can_access_modulo('locacao')).
-- (3) Hardening do RPC loc_enviar_faturas_financeiro: bloqueia envio
--     quando o imovel esta em status 'inativo' ou 'em_saida'.
-- (4) Novo RPC loc_gerar_faturas_mes: gera faturas mensais (aluguel + 5 tipos
--     adicionais) para todos os imoveis ativos. Idempotente por
--     (imovel_id, tipo, competencia) — nao duplica.
-- (5) Novo RPC loc_cancelar_envio_fatura: desfaz envio (deleta CP se ainda
--     em status 'previsto' e reverte a fatura para 'lancado').

-- ============================================================================
-- (1) AUDITORIA
-- ============================================================================
DO $$
DECLARE
  r record;
  v_trigger text;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name LIKE 'loc_%'
    ORDER BY table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS criado_por_nome text', r.table_name);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS atualizado_por_nome text', r.table_name);

    v_trigger := 'tg_audit_user_' || r.table_name;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', v_trigger, r.table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public._tg_stamp_audit_user()',
      v_trigger, r.table_name
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- (2) RLS hardening em loc_* (substitui policies abertas)
-- ============================================================================
DO $$
DECLARE
  r record;
  p record;
BEGIN
  FOR r IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
      AND table_name LIKE 'loc_%'
    ORDER BY table_name
  LOOP
    -- Drop policies antigas (Autenticados ...)
    FOR p IN
      SELECT polname FROM pg_policy
      WHERE polrelid = format('public.%I', r.table_name)::regclass
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.polname, r.table_name);
    END LOOP;

    -- Garante RLS ligado
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);

    -- SELECT aberto (modulo todo no front consome listas comuns)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (true)',
      r.table_name || '_select', r.table_name
    );
    -- WRITE so com acesso ao modulo Locacao
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL '
      'USING (can_access_modulo(''locacao'', auth.uid())) '
      'WITH CHECK (can_access_modulo(''locacao'', auth.uid()))',
      r.table_name || '_modulo_write', r.table_name
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- (3) Hardening do RPC envio: bloqueia imovel inativo / em_saida
-- ============================================================================
CREATE OR REPLACE FUNCTION public.loc_enviar_faturas_financeiro(p_fatura_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enviadas INT := 0;
  v_puladas  INT := 0;
  v_motivos  jsonb := '[]'::jsonb;
  v_f RECORD;
  v_ja_existe uuid;
BEGIN
  IF p_fatura_ids IS NULL OR cardinality(p_fatura_ids) = 0 THEN
    RETURN jsonb_build_object('enviadas', 0, 'puladas', 0, 'msg', 'nenhuma fatura informada');
  END IF;

  FOR v_f IN
    SELECT
      f.id, f.tipo, f.descricao, f.competencia, f.vencimento,
      coalesce(f.valor_confirmado, f.valor_previsto, 0) as valor,
      f.status,
      i.locador_nome, i.codigo as imovel_codigo, i.descricao as imovel_descricao,
      i.status as imovel_status
    FROM loc_faturas f
    LEFT JOIN loc_imoveis i ON i.id = f.imovel_id
    WHERE f.id = ANY(p_fatura_ids)
  LOOP
    SELECT id INTO v_ja_existe
    FROM fin_contas_pagar
    WHERE loc_fatura_id = v_f.id
    LIMIT 1;

    IF v_ja_existe IS NOT NULL THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'ja_enviada');
      CONTINUE;
    END IF;

    IF v_f.status NOT IN ('previsto', 'lancado') THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'status_invalido');
      CONTINUE;
    END IF;

    IF v_f.valor IS NULL OR v_f.valor <= 0 THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'sem_valor');
      CONTINUE;
    END IF;

    -- NOVA TRAVA: imovel inativo / em saida nao gera CP
    IF v_f.imovel_status IN ('inativo', 'em_saida') THEN
      v_puladas := v_puladas + 1;
      v_motivos := v_motivos || jsonb_build_object('fatura_id', v_f.id, 'motivo', 'imovel_inativo');
      CONTINUE;
    END IF;

    INSERT INTO fin_contas_pagar (
      fornecedor_nome, valor_original, valor_pago,
      data_emissao, data_vencimento, data_vencimento_orig,
      descricao, natureza, origem, status,
      loc_fatura_id,
      observacoes
    ) VALUES (
      coalesce(nullif(trim(v_f.locador_nome), ''), 'Locador nao informado'),
      v_f.valor, 0,
      current_date,
      coalesce(v_f.vencimento, current_date),
      coalesce(v_f.vencimento, current_date),
      format('Locacao imovel %s - %s%s',
        coalesce(v_f.imovel_codigo, v_f.imovel_descricao, '?'),
        v_f.tipo,
        coalesce(' - ' || v_f.descricao, '')),
      'locacao_imovel', 'locacao', 'previsto',
      v_f.id,
      format('Origem: loc_faturas/%s (competencia %s)',
        v_f.id,
        coalesce(to_char(v_f.competencia, 'MM/YYYY'), '?'))
    );

    UPDATE loc_faturas
    SET status = 'enviado_pagamento', updated_at = now()
    WHERE id = v_f.id;

    v_enviadas := v_enviadas + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'enviadas', v_enviadas,
    'puladas',  v_puladas,
    'motivos',  v_motivos
  );
END;
$$;

-- ============================================================================
-- (4) NOVO RPC: gera faturas do mes para todos imoveis ativos
-- ============================================================================
-- Tipos gerados por imovel ativo:
--   - aluguel       (valor = imovel.valor_aluguel_mensal)
--   - iptu          (valor = 0, voce preenche depois)
--   - condominio    (valor = 0)
--   - energia       (valor = 0)
--   - agua          (valor = 0)
--   - internet      (valor = 0)
-- Idempotente: nao re-cria se ja existe fatura para o trio
-- (imovel_id, tipo, competencia).
CREATE OR REPLACE FUNCTION public.loc_gerar_faturas_mes(p_competencia date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_imovel       RECORD;
  v_tipo         text;
  v_tipos        text[] := ARRAY['aluguel','iptu','condominio','energia','agua','internet'];
  v_competencia  date;
  v_vencimento   date;
  v_dia_venc     int;
  v_valor        numeric;
  v_criadas      int := 0;
  v_puladas      int := 0;
  v_imoveis_ok   int := 0;
BEGIN
  IF NOT can_access_modulo('locacao', auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao no modulo Locacao';
  END IF;

  -- Normaliza para primeiro dia do mes (competencia = mes/ano)
  v_competencia := date_trunc('month', p_competencia)::date;

  FOR v_imovel IN
    SELECT id, codigo, descricao, status,
           coalesce(valor_aluguel_mensal, 0) AS valor_aluguel,
           coalesce(dia_vencimento, 5) AS dia_vencimento
    FROM loc_imoveis
    WHERE status = 'ativo'
  LOOP
    v_imoveis_ok := v_imoveis_ok + 1;
    v_dia_venc := least(greatest(v_imovel.dia_vencimento, 1), 28);
    v_vencimento := (v_competencia + interval '1 month')::date
                    + (v_dia_venc - 1) * interval '1 day';

    FOREACH v_tipo IN ARRAY v_tipos
    LOOP
      v_valor := CASE WHEN v_tipo = 'aluguel' THEN v_imovel.valor_aluguel ELSE 0 END;

      -- Idempotencia: pula se ja existe (imovel, tipo, competencia)
      IF EXISTS (
        SELECT 1 FROM loc_faturas
        WHERE imovel_id = v_imovel.id
          AND tipo = v_tipo
          AND competencia = v_competencia
      ) THEN
        v_puladas := v_puladas + 1;
        CONTINUE;
      END IF;

      INSERT INTO loc_faturas (
        imovel_id, tipo, descricao,
        competencia, vencimento,
        valor_previsto, status, recorrente,
        dia_recorrencia
      ) VALUES (
        v_imovel.id, v_tipo,
        format('%s %s/%s',
          initcap(v_tipo),
          to_char(v_competencia, 'MM'),
          to_char(v_competencia, 'YYYY')),
        v_competencia,
        v_vencimento::date,
        v_valor,
        'previsto', true,
        v_dia_venc
      );
      v_criadas := v_criadas + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'competencia', to_char(v_competencia, 'YYYY-MM'),
    'imoveis_ativos', v_imoveis_ok,
    'criadas', v_criadas,
    'puladas_existentes', v_puladas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.loc_gerar_faturas_mes(date) TO authenticated;

-- ============================================================================
-- (5) NOVO RPC: desfaz envio de fatura
-- ============================================================================
-- Permite reverter fatura enviada -> volta para 'lancado'.
-- Deleta o CP vinculado SE estiver em status 'previsto' (nao toca em pago/parcial).
-- Se o CP nao puder ser deletado (ex.: ja pago), bloqueia e retorna erro.
CREATE OR REPLACE FUNCTION public.loc_cancelar_envio_fatura(p_fatura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fatura  RECORD;
  v_cp      RECORD;
BEGIN
  IF NOT can_access_modulo('locacao', auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao no modulo Locacao';
  END IF;

  SELECT id, status INTO v_fatura
  FROM loc_faturas WHERE id = p_fatura_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'fatura_nao_encontrada');
  END IF;

  IF v_fatura.status <> 'enviado_pagamento' THEN
    RETURN jsonb_build_object('ok', false, 'erro',
      format('fatura nao esta enviada (status=%s)', v_fatura.status));
  END IF;

  SELECT id, status, valor_pago INTO v_cp
  FROM fin_contas_pagar
  WHERE loc_fatura_id = p_fatura_id
  LIMIT 1;

  IF v_cp.id IS NOT NULL THEN
    IF v_cp.status = 'pago' OR coalesce(v_cp.valor_pago, 0) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'erro',
        'CP ja possui pagamento — nao e possivel cancelar o envio');
    END IF;
    DELETE FROM fin_contas_pagar WHERE id = v_cp.id;
  END IF;

  UPDATE loc_faturas
  SET status = 'lancado', updated_at = now()
  WHERE id = p_fatura_id;

  RETURN jsonb_build_object('ok', true, 'fatura_id', p_fatura_id, 'cp_deletado', v_cp.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.loc_cancelar_envio_fatura(uuid) TO authenticated;
