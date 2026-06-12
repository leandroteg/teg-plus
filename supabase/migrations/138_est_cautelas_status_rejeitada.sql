-- ─────────────────────────────────────────────────────────────────────────────
-- 138_est_cautelas_status_rejeitada.sql
--
-- est_cautelas.motivo_rejeicao já existe (mig 072) mas o CHECK do status
-- não aceitava 'rejeitada'. Fluxo de aprovacao precisa distinguir cautela
-- rejeitada (negada pelo aprovador) de encerrada (devolvida totalmente).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.est_cautelas DROP CONSTRAINT IF EXISTS est_cautelas_status_check;

ALTER TABLE public.est_cautelas
  ADD CONSTRAINT est_cautelas_status_check
  CHECK (status = ANY (ARRAY[
    'pendente'::text,
    'aprovada'::text,
    'rejeitada'::text,
    'em_aberto'::text,
    'em_devolucao'::text,
    'encerrada'::text
  ]));
