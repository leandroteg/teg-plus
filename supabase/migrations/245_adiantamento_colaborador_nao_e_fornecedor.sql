-- ─────────────────────────────────────────────────────────────────────────────
-- 245 — Adiantamento a colaborador não é adiantamento a fornecedor
--
-- `natureza = 'adiantamento'` é compartilhada por dois fluxos bem diferentes:
--
--   • Compras — adiantamento/sinal ao FORNECEDOR. A NF chega depois e abate o
--     saldo (mig 218).
--   • Despesas/RH — repasse ao COLABORADOR (número AD-…, origem 'despesas'),
--     que se acerta por prestação de contas. Nunca vai existir NF dele.
--
-- Como a fin_adiantamentos_disponiveis olhava só a natureza, um repasse de
-- viagem aparecia como "adiantamento com saldo" para abater título de alguém
-- de mesmo nome, e o Financeiro via o lançamento rotulado como se fosse
-- adiantamento a fornecedor. Aqui a RPC passa a ignorar as origens de
-- colaborador; o mesmo corte foi feito no frontend (ehAdiantamentoFornecedor).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_adiantamentos_disponiveis(
  p_fornecedor_nome text,
  p_empresa_id      uuid DEFAULT NULL::uuid,
  p_excluir_cp_id   uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  cp_id uuid, numero_pedido text, descricao text, data_emissao date,
  status text, valor numeric, ja_abatido numeric, saldo numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT cp.id, p.numero_pedido, cp.descricao, cp.data_emissao, cp.status::text,
         cp.valor_original, COALESCE(ab.total, 0),
         GREATEST(0, cp.valor_original - COALESCE(ab.total, 0))
    FROM fin_contas_pagar cp
    LEFT JOIN cmp_pedidos p ON p.id = cp.pedido_id
    LEFT JOIN LATERAL (
      SELECT sum(a.valor) AS total FROM fin_adiantamento_abatimentos a
       WHERE a.adiantamento_cp_id = cp.id
    ) ab ON true
   WHERE cp.natureza = 'adiantamento'
     -- repasse a colaborador presta contas por recibo, não por NF
     AND COALESCE(cp.origem, '') NOT IN ('despesas', 'rh', 'rh_beneficios')
     AND cp.status::text <> 'cancelado'
     AND fn_upper_norm(cp.fornecedor_nome) = fn_upper_norm(p_fornecedor_nome)
     AND (p_empresa_id IS NULL OR cp.empresa_id IS NULL OR cp.empresa_id = p_empresa_id)
     AND (p_excluir_cp_id IS NULL OR cp.id <> p_excluir_cp_id)
     AND GREATEST(0, cp.valor_original - COALESCE(ab.total, 0)) > 0
   ORDER BY cp.data_emissao;
$function$;

GRANT EXECUTE ON FUNCTION public.fin_adiantamentos_disponiveis(text, uuid, uuid) TO authenticated;
