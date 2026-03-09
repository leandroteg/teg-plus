-- Migration 037: Fix sys_log_atividades FK constraint
--
-- Problem: log_audit_changes() trigger uses auth.uid() as usuario_id,
-- but the FK referenced sys_usuarios(id) which only has 7 test users.
-- Real production users (leandro.mallet@, elton.costa@, etc.) are NOT
-- in sys_usuarios, causing FK violation on any INSERT/UPDATE/DELETE
-- to tables with audit triggers (fin_contas_pagar, fin_contas_receber,
-- con_contratos, con_parcelas).
--
-- Impact: "Emitir Pedido" in Compras failed because the trigger chain:
--   INSERT cmp_pedidos → criar_cp_ao_emitir_pedido → INSERT fin_contas_pagar
--   → audit_fin_cp → log_audit_changes() → INSERT sys_log_atividades → FK VIOLATION
--
-- Fix: Drop the FK constraint. Audit logs don't need strict FK enforcement.
-- usuario_id is already nullable and stores auth.uid() for reference only.

ALTER TABLE sys_log_atividades
  DROP CONSTRAINT IF EXISTS sys_log_atividades_usuario_id_fkey;
