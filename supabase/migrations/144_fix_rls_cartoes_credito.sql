-- ══════════════════════════════════════════════════════════════════════════════
--  144 · Fix RLS — fin_cartoes_credito + fin_portadores_cartao
-- ══════════════════════════════════════════════════════════════════════════════
-- A policy original (045) checava `role IN ('admin','gerente')`, mas em prod o
-- role real é 'administrador' (português). Resultado: nenhum usuário conseguia
-- inserir/atualizar cartão pelo cliente — caía no fallback genérico "Falha ao
-- salvar". Outras policies de cartão (faturas, itens) já tinham sido corrigidas
-- antes; essas duas ficaram pra trás.
--
-- Substitui pelo helper SECURITY DEFINER is_admin(), que já checa
-- role = 'administrador' AND ativo = true.

DROP POLICY IF EXISTS "cartoes_admin" ON fin_cartoes_credito;
CREATE POLICY "cartoes_admin" ON fin_cartoes_credito
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "portadores_admin" ON fin_portadores_cartao;
CREATE POLICY "portadores_admin" ON fin_portadores_cartao
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
