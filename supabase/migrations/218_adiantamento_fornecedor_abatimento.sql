-- ─────────────────────────────────────────────────────────────────────────────
-- 218_adiantamento_fornecedor_abatimento.sql
--
-- O Adiantamento a Fornecedor (mig 214) paga antes da nota. Quando o fornecedor
-- finalmente emite a NF, o título cheio não pode ser pago de novo — o que já foi
-- adiantado tem que ser abatido, com rastro dos dois lados.
--
-- Modelo:
--   · a CP do adiantamento é a FONTE de saldo (natureza='adiantamento');
--   · fin_adiantamento_abatimentos amarra fonte → destino, com valor;
--   · fin_contas_pagar.valor_adiantamento_abatido é o espelho somado no destino,
--     mantido pelas RPCs (o front soma esse campo no valor a pagar).
--
-- Saldo do adiantamento = valor a pagar − já abatido. Nunca negativo.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.fin_contas_pagar
  ADD COLUMN IF NOT EXISTS valor_adiantamento_abatido numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.fin_contas_pagar.valor_adiantamento_abatido IS
  'Quanto deste título já foi coberto por adiantamento ao fornecedor (mig 218). Mantido pelas RPCs de abatimento.';

CREATE TABLE IF NOT EXISTS public.fin_adiantamento_abatimentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adiantamento_cp_id uuid NOT NULL REFERENCES public.fin_contas_pagar(id) ON DELETE CASCADE,
  destino_cp_id      uuid NOT NULL REFERENCES public.fin_contas_pagar(id) ON DELETE CASCADE,
  valor              numeric NOT NULL CHECK (valor > 0),
  criado_por         uuid,
  criado_por_nome    text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (adiantamento_cp_id, destino_cp_id)
);

COMMENT ON TABLE public.fin_adiantamento_abatimentos IS
  'Liga a CP de adiantamento ao fornecedor (fonte) ao título da nota que ela cobre (destino).';

CREATE INDEX IF NOT EXISTS idx_fin_abat_adiantamento ON public.fin_adiantamento_abatimentos(adiantamento_cp_id);
CREATE INDEX IF NOT EXISTS idx_fin_abat_destino      ON public.fin_adiantamento_abatimentos(destino_cp_id);

ALTER TABLE public.fin_adiantamento_abatimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_abat_read ON public.fin_adiantamento_abatimentos;
CREATE POLICY fin_abat_read ON public.fin_adiantamento_abatimentos FOR SELECT TO authenticated USING (true);

-- Escrita só pelas RPCs (SECURITY DEFINER) — elas é que mantêm o espelho.

-- ── Saldo de adiantamento por fornecedor ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_adiantamentos_disponiveis(
  p_fornecedor_nome text,
  p_empresa_id      uuid DEFAULT NULL,
  p_excluir_cp_id   uuid DEFAULT NULL
)
RETURNS TABLE (
  cp_id          uuid,
  numero_pedido  text,
  descricao      text,
  data_emissao   date,
  status         text,
  valor          numeric,
  ja_abatido     numeric,
  saldo          numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT cp.id,
         p.numero_pedido,
         cp.descricao,
         cp.data_emissao,
         cp.status::text,
         cp.valor_original,
         COALESCE(ab.total, 0),
         GREATEST(0, cp.valor_original - COALESCE(ab.total, 0))
    FROM fin_contas_pagar cp
    LEFT JOIN cmp_pedidos p ON p.id = cp.pedido_id
    LEFT JOIN LATERAL (
      SELECT sum(a.valor) AS total
        FROM fin_adiantamento_abatimentos a
       WHERE a.adiantamento_cp_id = cp.id
    ) ab ON true
   WHERE cp.natureza = 'adiantamento'
     AND cp.status::text <> 'cancelado'
     AND fn_upper_norm(cp.fornecedor_nome) = fn_upper_norm(p_fornecedor_nome)
     AND (p_empresa_id IS NULL OR cp.empresa_id IS NULL OR cp.empresa_id = p_empresa_id)
     AND (p_excluir_cp_id IS NULL OR cp.id <> p_excluir_cp_id)
     AND GREATEST(0, cp.valor_original - COALESCE(ab.total, 0)) > 0
   ORDER BY cp.data_emissao;
$$;

COMMENT ON FUNCTION public.fin_adiantamentos_disponiveis(text, uuid, uuid) IS
  'Adiantamentos com saldo do mesmo fornecedor, para abater no titulo da nota.';

GRANT EXECUTE ON FUNCTION public.fin_adiantamentos_disponiveis(text, uuid, uuid) TO authenticated;

-- ── Abater ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_adiantamento_abater(
  p_adiantamento_cp_id uuid,
  p_destino_cp_id      uuid,
  p_valor              numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_perfil  sys_perfis%ROWTYPE;
  v_adiant  fin_contas_pagar%ROWTYPE;
  v_destino fin_contas_pagar%ROWTYPE;
  v_saldo   numeric;
  v_falta   numeric;
  v_valor   numeric;
BEGIN
  SELECT * INTO v_perfil FROM sys_perfis WHERE auth_id = auth.uid() AND ativo IS TRUE LIMIT 1;
  IF v_perfil.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Perfil nao encontrado ou inativo.');
  END IF;
  IF NOT can_access_modulo('financeiro', auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Abater adiantamento e ato do Financeiro.');
  END IF;

  SELECT * INTO v_adiant  FROM fin_contas_pagar WHERE id = p_adiantamento_cp_id;
  SELECT * INTO v_destino FROM fin_contas_pagar WHERE id = p_destino_cp_id;
  IF v_adiant.id IS NULL OR v_destino.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Lancamento nao encontrado.');
  END IF;
  IF v_adiant.id = v_destino.id THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'O adiantamento nao pode abater a si mesmo.');
  END IF;
  IF v_adiant.natureza <> 'adiantamento' THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'A origem precisa ser um adiantamento a fornecedor.');
  END IF;
  IF fn_upper_norm(v_adiant.fornecedor_nome) <> fn_upper_norm(v_destino.fornecedor_nome) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Adiantamento e titulo sao de fornecedores diferentes.');
  END IF;
  IF v_destino.status::text IN ('pago', 'conciliado', 'cancelado') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Titulo ja liquidado ou cancelado: nao aceita abatimento.');
  END IF;

  SELECT GREATEST(0, v_adiant.valor_original - COALESCE(sum(a.valor), 0))
    INTO v_saldo
    FROM fin_adiantamento_abatimentos a
   WHERE a.adiantamento_cp_id = v_adiant.id;

  IF COALESCE(v_saldo, 0) <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Adiantamento sem saldo disponivel.');
  END IF;

  -- Nunca abate mais do que o título ainda deve.
  v_falta := GREATEST(0, v_destino.valor_original
                        - COALESCE(v_destino.valor_desconto, 0)
                        + COALESCE(v_destino.valor_juros_multa, 0)
                        - COALESCE(v_destino.valor_adiantamento_abatido, 0));
  IF v_falta <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Titulo ja esta totalmente coberto.');
  END IF;

  v_valor := LEAST(COALESCE(p_valor, v_saldo), v_saldo, v_falta);
  v_valor := round(v_valor, 2);
  IF v_valor <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Valor de abatimento invalido.');
  END IF;

  INSERT INTO fin_adiantamento_abatimentos (adiantamento_cp_id, destino_cp_id, valor, criado_por, criado_por_nome)
  VALUES (v_adiant.id, v_destino.id, v_valor, v_perfil.id, v_perfil.nome)
  ON CONFLICT (adiantamento_cp_id, destino_cp_id)
  DO UPDATE SET valor = fin_adiantamento_abatimentos.valor + EXCLUDED.valor,
                criado_por = EXCLUDED.criado_por,
                criado_por_nome = EXCLUDED.criado_por_nome;

  UPDATE fin_contas_pagar
     SET valor_adiantamento_abatido = (
           SELECT COALESCE(sum(a.valor), 0) FROM fin_adiantamento_abatimentos a WHERE a.destino_cp_id = v_destino.id
         ),
         updated_at = now()
   WHERE id = v_destino.id;

  INSERT INTO sys_log_atividades (modulo, entidade_tipo, entidade_id, tipo, descricao, usuario_id, usuario_nome, dados)
  VALUES ('financeiro', 'cp', v_destino.id, 'adiantamento_abatido',
          'Adiantamento abatido: ' || to_char(v_valor, 'FM999G999G990D00'),
          v_perfil.id, v_perfil.nome,
          jsonb_build_object('adiantamento_cp_id', v_adiant.id, 'destino_cp_id', v_destino.id, 'valor', v_valor));

  RETURN jsonb_build_object('ok', true, 'valor', v_valor,
                            'saldo_restante', GREATEST(0, v_saldo - v_valor));
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_adiantamento_abater(uuid, uuid, numeric) TO authenticated;

-- ── Desfazer ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_adiantamento_desfazer_abatimento(p_abatimento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_perfil sys_perfis%ROWTYPE;
  v_ab     fin_adiantamento_abatimentos%ROWTYPE;
  v_destino fin_contas_pagar%ROWTYPE;
BEGIN
  SELECT * INTO v_perfil FROM sys_perfis WHERE auth_id = auth.uid() AND ativo IS TRUE LIMIT 1;
  IF v_perfil.id IS NULL OR NOT can_access_modulo('financeiro', auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sem permissao.');
  END IF;

  SELECT * INTO v_ab FROM fin_adiantamento_abatimentos WHERE id = p_abatimento_id;
  IF v_ab.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Abatimento nao encontrado.');
  END IF;

  SELECT * INTO v_destino FROM fin_contas_pagar WHERE id = v_ab.destino_cp_id;
  IF v_destino.status::text IN ('pago', 'conciliado') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Titulo ja pago: o abatimento nao pode ser desfeito.');
  END IF;

  DELETE FROM fin_adiantamento_abatimentos WHERE id = p_abatimento_id;

  UPDATE fin_contas_pagar
     SET valor_adiantamento_abatido = (
           SELECT COALESCE(sum(a.valor), 0) FROM fin_adiantamento_abatimentos a WHERE a.destino_cp_id = v_ab.destino_cp_id
         ),
         updated_at = now()
   WHERE id = v_ab.destino_cp_id;

  INSERT INTO sys_log_atividades (modulo, entidade_tipo, entidade_id, tipo, descricao, usuario_id, usuario_nome, dados)
  VALUES ('financeiro', 'cp', v_ab.destino_cp_id, 'adiantamento_abatimento_desfeito',
          'Abatimento desfeito: ' || to_char(v_ab.valor, 'FM999G999G990D00'),
          v_perfil.id, v_perfil.nome,
          jsonb_build_object('adiantamento_cp_id', v_ab.adiantamento_cp_id, 'valor', v_ab.valor));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fin_adiantamento_desfazer_abatimento(uuid) TO authenticated;

-- ── Abatimentos de um título (os dois sentidos) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_abatimentos_da_cp(p_cp_id uuid)
RETURNS TABLE (
  id              uuid,
  papel           text,     -- 'destino' = abate neste titulo · 'origem' = este adiantamento cobriu outro
  outra_cp_id     uuid,
  outra_descricao text,
  outro_pedido    text,
  valor           numeric,
  criado_por_nome text,
  created_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, 'destino', cp.id, cp.descricao, p.numero_pedido, a.valor, a.criado_por_nome, a.created_at
    FROM fin_adiantamento_abatimentos a
    JOIN fin_contas_pagar cp ON cp.id = a.adiantamento_cp_id
    LEFT JOIN cmp_pedidos p  ON p.id = cp.pedido_id
   WHERE a.destino_cp_id = p_cp_id
  UNION ALL
  SELECT a.id, 'origem', cp.id, cp.descricao, p.numero_pedido, a.valor, a.criado_por_nome, a.created_at
    FROM fin_adiantamento_abatimentos a
    JOIN fin_contas_pagar cp ON cp.id = a.destino_cp_id
    LEFT JOIN cmp_pedidos p  ON p.id = cp.pedido_id
   WHERE a.adiantamento_cp_id = p_cp_id
   ORDER BY 8;
$$;

GRANT EXECUTE ON FUNCTION public.fin_abatimentos_da_cp(uuid) TO authenticated;
