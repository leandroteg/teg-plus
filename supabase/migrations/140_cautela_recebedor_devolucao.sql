-- ─────────────────────────────────────────────────────────────────────────────
-- 140_cautela_recebedor_devolucao.sql
--
-- Devolucao de cautela agora exige confirmacao de quem está recebendo o
-- material (almoxarife/admin), nao so a assinatura de quem devolve.
-- Recebedor digita senha pra autenticar identidade (alem da assinatura).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.est_cautelas
  ADD COLUMN IF NOT EXISTS recebedor_id                       uuid,
  ADD COLUMN IF NOT EXISTS recebedor_nome                     text,
  ADD COLUMN IF NOT EXISTS assinatura_recebedor_devolucao_url text;

COMMENT ON COLUMN public.est_cautelas.recebedor_id IS
  'sys_perfis.id do almoxarife/admin que confirmou a devolucao (autenticado por senha no momento)';
COMMENT ON COLUMN public.est_cautelas.assinatura_recebedor_devolucao_url IS
  'Path no bucket cautelas-termos da assinatura do recebedor';
