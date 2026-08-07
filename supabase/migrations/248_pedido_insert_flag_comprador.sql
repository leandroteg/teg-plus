-- 248: comprador de fato (flag sys_perfis.comprador) pode emitir/atualizar pedido
--
-- cmp_ped_insert/update exigiam role_at_least('comprador'), que mapeia para
-- nível 3 = gestor+. Não existe role 'comprador' em sys_perfis — compradores
-- são marcados pela flag booleana sys_perfis.comprador. Comprador com role
-- 'requisitante' (Claudionor, Priscila) era barrado pelo RLS ao emitir
-- Pedido Direto ("new row violates row-level security policy"), embora o
-- front mostre o botão para todos.

CREATE OR REPLACE FUNCTION public.is_comprador()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT comprador FROM sys_perfis
      WHERE auth_id = auth.uid() AND ativo = true
      LIMIT 1),
    false);
$$;

DROP POLICY IF EXISTS cmp_ped_insert ON public.cmp_pedidos;
CREATE POLICY cmp_ped_insert ON public.cmp_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (role_at_least('comprador') OR public.is_comprador());

DROP POLICY IF EXISTS cmp_ped_update ON public.cmp_pedidos;
CREATE POLICY cmp_ped_update ON public.cmp_pedidos
  FOR UPDATE TO authenticated
  USING (role_at_least('comprador') OR public.is_comprador())
  WITH CHECK (role_at_least('comprador') OR public.is_comprador());
