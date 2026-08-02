-- cmp_rc_triagem_liberar (mig 000005) grava responsavel_tipo='triagem_cd' e a
-- RPC da Sala Tecnica usa 'sala_tecnica' — a check antiga nao os aceitava e o
-- "Liberar para Compras" da triagem quebrava.
ALTER TABLE public.cmp_historico_status DROP CONSTRAINT IF EXISTS cmp_historico_status_responsavel_tipo_check;
ALTER TABLE public.cmp_historico_status ADD CONSTRAINT cmp_historico_status_responsavel_tipo_check
  CHECK (responsavel_tipo = ANY (ARRAY['sistema', 'aprovador', 'comprador', 'solicitante', 'admin', 'triagem_cd', 'sala_tecnica']));
