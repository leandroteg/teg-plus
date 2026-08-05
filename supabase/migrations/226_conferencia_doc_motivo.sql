-- ─────────────────────────────────────────────────────────────────────────────
-- 226 — Justificativa da recusa na conferência de documentos do pedido
--
-- A conferência por documento (mig 206) gravava só quem reprovou e quando. Sem
-- o motivo, o comprador recebia o pedido de volta em Emitido sem saber o que
-- corrigir — tinha que perguntar por fora do sistema.
--
-- O motivo do "voltar etapa" (desfazer recebimento) já era obrigatório na RPC
-- cmp_pedido_desfazer_recebimento; aqui entra o par que faltava: o porquê da
-- recusa de cada documento.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cmp_pedidos_anexos
  ADD COLUMN IF NOT EXISTS conferido_motivo TEXT;

COMMENT ON COLUMN cmp_pedidos_anexos.conferido_motivo IS
  'Justificativa da recusa do documento na conferencia. Obrigatoria ao reprovar; limpa ao desfazer a conferencia.';
