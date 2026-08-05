-- ─────────────────────────────────────────────────────────────────────────────
-- 225 — Quem edita e quem exclui fornecedor
--
-- Regra (decisão 05/ago):
--   • EDITAR  — só admin ou usuário liberado na flag sys_perfis.edita_fornecedor.
--               Antes era só admin (trava no frontend), sem jeito de liberar
--               ninguém sem promover a pessoa a administrador.
--   • EXCLUIR — mesma permissão da edição, MAS só quando o fornecedor não tem
--               nenhum lançamento atrelado (pedido, CP, contrato, NF, OS,
--               locação). Com movimento, o caminho é inativar — excluir
--               arrancaria o histórico de quem já pagou/comprou.
--
-- O DELETE direto na tabela continua restrito a gerente+ pelo RLS; a exclusão
-- do dia a dia passa pela RPC abaixo, que é SECURITY DEFINER e devolve o
-- motivo em texto (o .delete() do cliente falhava em silêncio — a tela só
-- recarregava e o registro seguia lá).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sys_perfis
  ADD COLUMN IF NOT EXISTS edita_fornecedor BOOLEAN DEFAULT false;

COMMENT ON COLUMN sys_perfis.edita_fornecedor IS
  'Libera editar dados cadastrais/bancarios de fornecedor ja cadastrado e excluir fornecedor sem lancamentos. Admin tem por padrao.';

-- ── Quem pode ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pode_editar_fornecedor(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM sys_perfis p
    WHERE p.auth_id = p_user_id
      AND p.ativo = true
      AND (p.role = 'administrador' OR COALESCE(p.edita_fornecedor, false) = true)
  );
$function$;

COMMENT ON FUNCTION public.pode_editar_fornecedor(uuid) IS
  'True para administrador ou perfil com sys_perfis.edita_fornecedor. Espelhado no frontend (FornecedoresCad).';

-- ── Exclusão com checagem de vínculos ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cmp_fornecedor_excluir(p_fornecedor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome      text;
  v_qtd       bigint;
  v_bloqueios text[] := '{}';
  r           record;
BEGIN
  IF NOT public.pode_editar_fornecedor() THEN
    RAISE EXCEPTION 'Sem permissao para excluir fornecedor. Peca a liberacao "Edita cadastro de fornecedor" a um administrador.';
  END IF;

  SELECT razao_social INTO v_nome FROM cmp_fornecedores WHERE id = p_fornecedor_id;
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Fornecedor nao encontrado — recarregue a pagina.';
  END IF;

  -- Tudo que amarra o fornecedor a um lancamento. Anexos e auditoria da Receita
  -- ficam de fora de proposito: sao filhos do proprio cadastro, nao movimento.
  FOR r IN
    SELECT * FROM (VALUES
      ('cmp_pedidos',               'pedido(s) de compra'),
      ('fin_contas_pagar',          'titulo(s) no Contas a Pagar'),
      ('con_contratos',             'contrato(s)'),
      ('fis_notas_fiscais',         'nota(s) fiscal(is)'),
      ('fis_solicitacoes_nf',       'solicitacao(oes) de NF'),
      ('fro_ordens_servico',        'ordem(ns) de servico de frotas'),
      ('fro_cotacoes_os',           'cotacao(oes) de OS de frotas'),
      ('fro_avaliacoes_fornecedor', 'avaliacao(oes) de fornecedor'),
      ('loc_solicitacoes',          'solicitacao(oes) de locacao')
    ) AS t(tabela, rotulo)
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE fornecedor_id = $1', r.tabela)
      INTO v_qtd USING p_fornecedor_id;
    IF v_qtd > 0 THEN
      v_bloqueios := v_bloqueios || format('%s %s', v_qtd, r.rotulo);
    END IF;
  END LOOP;

  IF array_length(v_bloqueios, 1) > 0 THEN
    RAISE EXCEPTION 'Fornecedor % tem lancamento atrelado (%) e nao pode ser excluido. Marque como inativo.',
      v_nome, array_to_string(v_bloqueios, ', ');
  END IF;

  DELETE FROM cmp_fornecedor_anexos            WHERE fornecedor_id = p_fornecedor_id;
  DELETE FROM cmp_fornecedores_receita_auditoria WHERE fornecedor_id = p_fornecedor_id;
  DELETE FROM cmp_fornecedores                 WHERE id = p_fornecedor_id;
END;
$function$;

COMMENT ON FUNCTION public.cmp_fornecedor_excluir(uuid) IS
  'Exclui fornecedor sem lancamentos atrelados. Levanta excecao com o motivo quando falta permissao ou existe vinculo.';

GRANT EXECUTE ON FUNCTION public.pode_editar_fornecedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cmp_fornecedor_excluir(uuid) TO authenticated;
