-- 103: segregacao de funcoes no recebimento + oficializacao da CP
-- Regra: confirmar recebimento (insert em cmp_recebimentos) so por quem esta lotado
-- na base de destino do pedido, OU no CD Araxa (faz_triagem), OU admin. Nunca o comprador.
-- E: ao marcar o pedido como entregue/parcial, oficializa a CP (previsto -> confirmado).

-- B) RLS de insert por lotacao
DROP POLICY IF EXISTS insert_recebimentos ON cmp_recebimentos;
CREATE POLICY insert_recebimentos ON cmp_recebimentos
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM cmp_pedidos pe
      JOIN cmp_requisicoes r ON r.id = pe.requisicao_id
      JOIN sys_perfis p ON p.auth_id = auth.uid()
      WHERE pe.id = cmp_recebimentos.pedido_id
        AND p.base_id IS NOT NULL
        AND p.base_id = r.base_destino_id
    )
    OR EXISTS (
      SELECT 1 FROM sys_perfis p
      JOIN est_bases b ON b.id = p.base_id
      WHERE p.auth_id = auth.uid() AND b.faz_triagem = true
    )
  );

-- C) Oficializa a CP ao entregar
CREATE OR REPLACE FUNCTION public.fn_oficializa_cp_no_recebimento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text IN ('entregue','parcialmente_recebido')
     AND COALESCE(OLD.status::text,'') <> NEW.status::text THEN
    UPDATE fin_contas_pagar
       SET status = 'confirmado', updated_at = now()
     WHERE pedido_id = NEW.id AND status = 'previsto';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_oficializa_cp_recebimento ON cmp_pedidos;
CREATE TRIGGER trg_oficializa_cp_recebimento
  AFTER UPDATE ON cmp_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_oficializa_cp_no_recebimento();
