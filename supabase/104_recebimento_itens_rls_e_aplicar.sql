-- 104: ajustes p/ o recebedor do estoque conseguir confirmar (sem ser comprador)
-- Descobertos no teste: itens do recebimento e update do pedido tinham RLS que exigia comprador.

-- 1) Itens do recebimento: pode inserir quem criou o recebimento (recebido_por) ou admin.
DROP POLICY IF EXISTS insert_recebimento_itens ON cmp_recebimento_itens;
CREATE POLICY insert_recebimento_itens ON cmp_recebimento_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM cmp_recebimentos r
      JOIN sys_perfis p ON p.auth_id = auth.uid()
      WHERE r.id = cmp_recebimento_itens.recebimento_id
        AND r.recebido_por = p.id
    )
  );

-- 2) cmp_pedidos UPDATE exige comprador; o recebedor do estoque nao tem.
-- RPC SECURITY DEFINER aplica o status do recebimento no pedido (a RLS de
-- cmp_recebimentos ja gateou quem pode receber). O trigger trg_oficializa_cp_recebimento
-- (migracao 103) entao oficializa a CP (previsto -> confirmado).
CREATE OR REPLACE FUNCTION public.cmp_aplicar_recebimento(
  p_pedido_id uuid, p_status text, p_nf text, p_qtd int, p_data date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cmp_recebimentos WHERE pedido_id = p_pedido_id) THEN
    RAISE EXCEPTION 'Nenhum recebimento registrado para este pedido';
  END IF;

  UPDATE cmp_pedidos
     SET status = p_status,
         data_entrega_real = p_data,
         qtd_itens_recebidos = p_qtd,
         nf_numero = COALESCE(NULLIF(p_nf, ''), nf_numero)
   WHERE id = p_pedido_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cmp_aplicar_recebimento(uuid, text, text, int, date) TO authenticated;
