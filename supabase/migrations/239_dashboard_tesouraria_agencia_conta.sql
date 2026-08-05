-- 239_dashboard_tesouraria_agencia_conta.sql
-- get_tesouraria_dashboard nao devolvia agencia/conta das contas bancarias —
-- so id, nome, banco_nome, saldo, cor e tipo. Duas consequencias:
--
--   1. a lista de Contas Bancarias so conseguia mostrar o nome do banco, que
--      nao distingue duas contas na mesma instituicao;
--   2. o modal de edicao (admin) abria com Agencia e Conta em branco, porque a
--      lista e a fonte dos dados do formulario.
--
-- Patch cirurgico no jsonb_build_object das contas, preservando o resto da
-- funcao. Reexecutar e inofensivo: se o trecho ja foi trocado, o replace nao
-- encontra nada e a funcao e apenas recriada identica.

DO $mig$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_tesouraria_dashboard';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'get_tesouraria_dashboard nao encontrada';
  END IF;

  v_def := replace(v_def,
    E'    ''id'', id, ''nome'', nome, ''banco_nome'', banco_nome,\n    ''saldo_atual'', saldo_atual, ''cor'', cor, ''tipo'', tipo',
    E'    ''id'', id, ''nome'', nome, ''banco_nome'', banco_nome,\n    ''banco_codigo'', banco_codigo, ''agencia'', agencia, ''conta'', conta,\n    ''saldo_atual'', saldo_atual, ''cor'', cor, ''tipo'', tipo');

  EXECUTE v_def;
END
$mig$;
