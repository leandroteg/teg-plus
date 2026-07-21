-- 185_recebimento_rls_pedido_direto.sql
-- A policy de INSERT de cmp_recebimentos so tinha caminho para pedidos com RC
-- (JOIN cmp_requisicoes ON r.id = pe.requisicao_id). Pedido Direto tem
-- requisicao_id NULL, entao esse join nunca casava e o recebimento era
-- bloqueado pela RLS mesmo para quem podia receber.
--
-- Alinha a RLS ao frontend (Pedidos.tsx): quando o pedido nao tem
-- base_destino (compra direta / servico do escritorio), libera para qualquer
-- perfil com pode_receber != false. Mantem os caminhos existentes: admin,
-- base do destino da RC e bases que fazem triagem.

DROP POLICY IF EXISTS insert_recebimentos ON public.cmp_recebimentos;

CREATE POLICY insert_recebimentos ON public.cmp_recebimentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    -- Recebedor lotado na base de destino da RC
    OR EXISTS (
      SELECT 1
      FROM cmp_pedidos pe
      JOIN cmp_requisicoes r ON r.id = pe.requisicao_id
      JOIN sys_perfis p ON p.auth_id = auth.uid()
      WHERE pe.id = cmp_recebimentos.pedido_id
        AND p.base_id IS NOT NULL
        AND p.base_id = r.base_destino_id
    )
    -- Bases que fazem triagem (ex.: CD Araxa)
    OR EXISTS (
      SELECT 1
      FROM sys_perfis p
      JOIN est_bases b ON b.id = p.base_id
      WHERE p.auth_id = auth.uid()
        AND b.faz_triagem = true
    )
    -- Pedido Direto / compra sem base_destino: qualquer perfil com pode_receber
    OR EXISTS (
      SELECT 1
      FROM cmp_pedidos pe
      LEFT JOIN cmp_requisicoes r ON r.id = pe.requisicao_id
      JOIN sys_perfis p ON p.auth_id = auth.uid()
      WHERE pe.id = cmp_recebimentos.pedido_id
        AND r.base_destino_id IS NULL
        AND COALESCE(p.pode_receber, true) = true
    )
  );
