-- ══════════════════════════════════════════════════════════════════════════════
-- 025_rls_granular.sql — RLS Granular por Role + Remoção de Anon Writes
-- TEG+ ERP — Fundação de Segurança
-- ══════════════════════════════════════════════════════════════════════════════
-- OBJETIVO:
--   1. Dropar TODAS as policies de escrita para `anon` (CVE-crítico)
--   2. Substituir blanket `FOR ALL TO authenticated USING(true)` por policies
--      granulares baseadas em role (via helper functions)
--   3. Manter SELECT aberto para authenticated (todos podem ler)
--   4. INSERT: requisitante+ (quem cria dados)
--   5. UPDATE: comprador+ ou owner
--   6. DELETE: admin/gerente apenas
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 0. Helper functions ─────────────────────────────────────────────────────

-- Retorna o role do usuário autenticado
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true),
    'visitante'
  );
$$;

-- Retorna true se o role do usuário é >= ao nível informado
-- admin=5, gerente=4, aprovador=3, comprador=2, requisitante=1, visitante=0
CREATE OR REPLACE FUNCTION auth_at_least(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE auth_role()
    WHEN 'admin'        THEN 5
    WHEN 'gerente'      THEN 4
    WHEN 'aprovador'    THEN 3
    WHEN 'comprador'    THEN 2
    WHEN 'requisitante' THEN 1
    ELSE 0
  END >= CASE p_role
    WHEN 'admin'        THEN 5
    WHEN 'gerente'      THEN 4
    WHEN 'aprovador'    THEN 3
    WHEN 'comprador'    THEN 2
    WHEN 'requisitante' THEN 1
    ELSE 0
  END;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. DROPAR POLICIES ANON DE ESCRITA (005_public_read_policy.sql)
-- ══════════════════════════════════════════════════════════════════════════════

-- Tabelas legadas do 001_schema_compras.sql
DROP POLICY IF EXISTS "Insercao publica requisicoes" ON requisicoes;
DROP POLICY IF EXISTS "Update publica requisicoes" ON requisicoes;
DROP POLICY IF EXISTS "Insercao publica itens" ON requisicao_itens;
DROP POLICY IF EXISTS "Insercao publica aprovacoes" ON aprovacoes;
DROP POLICY IF EXISTS "Update publica aprovacoes" ON aprovacoes;
DROP POLICY IF EXISTS "Insercao publica cotacoes" ON cotacoes;
DROP POLICY IF EXISTS "Update publica cotacoes" ON cotacoes;
DROP POLICY IF EXISTS "Insercao publica cotacao_fornecedores" ON cotacao_fornecedores;

-- Revogar EXECUTE no dashboard para anon
REVOKE EXECUTE ON FUNCTION get_dashboard_compras(TEXT, UUID) FROM anon;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. MÓDULO COMPRAS (007_fluxo_real.sql) — Substituir blanket policies
-- ══════════════════════════════════════════════════════════════════════════════

-- cmp_requisicoes
DROP POLICY IF EXISTS "req_all_auth" ON cmp_requisicoes;
DROP POLICY IF EXISTS "cmp_req_read" ON cmp_requisicoes;
DROP POLICY IF EXISTS "cmp_req_insert" ON cmp_requisicoes;
DROP POLICY IF EXISTS "cmp_req_update" ON cmp_requisicoes;
DROP POLICY IF EXISTS "cmp_req_delete" ON cmp_requisicoes;

CREATE POLICY "cmp_req_read" ON cmp_requisicoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cmp_req_insert" ON cmp_requisicoes
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "cmp_req_update" ON cmp_requisicoes
  FOR UPDATE TO authenticated
  USING (auth_at_least('requisitante'))
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "cmp_req_delete" ON cmp_requisicoes
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- cmp_requisicao_itens
DROP POLICY IF EXISTS "req_itens_all_auth" ON cmp_requisicao_itens;
DROP POLICY IF EXISTS "cmp_ritens_read" ON cmp_requisicao_itens;
DROP POLICY IF EXISTS "cmp_ritens_insert" ON cmp_requisicao_itens;
DROP POLICY IF EXISTS "cmp_ritens_update" ON cmp_requisicao_itens;
DROP POLICY IF EXISTS "cmp_ritens_delete" ON cmp_requisicao_itens;

CREATE POLICY "cmp_ritens_read" ON cmp_requisicao_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cmp_ritens_insert" ON cmp_requisicao_itens
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "cmp_ritens_update" ON cmp_requisicao_itens
  FOR UPDATE TO authenticated
  USING (auth_at_least('requisitante'))
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "cmp_ritens_delete" ON cmp_requisicao_itens
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- cmp_cotacoes
DROP POLICY IF EXISTS "cot_all_auth" ON cmp_cotacoes;
DROP POLICY IF EXISTS "cmp_cot_read" ON cmp_cotacoes;
DROP POLICY IF EXISTS "cmp_cot_insert" ON cmp_cotacoes;
DROP POLICY IF EXISTS "cmp_cot_update" ON cmp_cotacoes;
DROP POLICY IF EXISTS "cmp_cot_delete" ON cmp_cotacoes;

CREATE POLICY "cmp_cot_read" ON cmp_cotacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cmp_cot_insert" ON cmp_cotacoes
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "cmp_cot_update" ON cmp_cotacoes
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "cmp_cot_delete" ON cmp_cotacoes
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- cmp_cotacao_fornecedores
DROP POLICY IF EXISTS "cotforn_all_auth" ON cmp_cotacao_fornecedores;
DROP POLICY IF EXISTS "cmp_cotforn_read" ON cmp_cotacao_fornecedores;
DROP POLICY IF EXISTS "cmp_cotforn_insert" ON cmp_cotacao_fornecedores;
DROP POLICY IF EXISTS "cmp_cotforn_update" ON cmp_cotacao_fornecedores;
DROP POLICY IF EXISTS "cmp_cotforn_delete" ON cmp_cotacao_fornecedores;

CREATE POLICY "cmp_cotforn_read" ON cmp_cotacao_fornecedores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cmp_cotforn_insert" ON cmp_cotacao_fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "cmp_cotforn_update" ON cmp_cotacao_fornecedores
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "cmp_cotforn_delete" ON cmp_cotacao_fornecedores
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- cmp_pedidos
DROP POLICY IF EXISTS "ped_all_auth" ON cmp_pedidos;
DROP POLICY IF EXISTS "cmp_ped_read" ON cmp_pedidos;
DROP POLICY IF EXISTS "cmp_ped_insert" ON cmp_pedidos;
DROP POLICY IF EXISTS "cmp_ped_update" ON cmp_pedidos;
DROP POLICY IF EXISTS "cmp_ped_delete" ON cmp_pedidos;

CREATE POLICY "cmp_ped_read" ON cmp_pedidos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cmp_ped_insert" ON cmp_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "cmp_ped_update" ON cmp_pedidos
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "cmp_ped_delete" ON cmp_pedidos
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- apr_aprovacoes
DROP POLICY IF EXISTS "apr_all_auth" ON apr_aprovacoes;
DROP POLICY IF EXISTS "apr_read" ON apr_aprovacoes;
DROP POLICY IF EXISTS "apr_insert" ON apr_aprovacoes;
DROP POLICY IF EXISTS "apr_update" ON apr_aprovacoes;
DROP POLICY IF EXISTS "apr_delete" ON apr_aprovacoes;

CREATE POLICY "apr_read" ON apr_aprovacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "apr_insert" ON apr_aprovacoes
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('aprovador'));

CREATE POLICY "apr_update" ON apr_aprovacoes
  FOR UPDATE TO authenticated
  USING (auth_at_least('aprovador'))
  WITH CHECK (auth_at_least('aprovador'));

CREATE POLICY "apr_delete" ON apr_aprovacoes
  FOR DELETE TO authenticated
  USING (auth_at_least('admin'));

-- cmp_fornecedores (proteger dados bancários)
DROP POLICY IF EXISTS "fornecedores_read" ON cmp_fornecedores;
DROP POLICY IF EXISTS "fornecedores_write" ON cmp_fornecedores;
DROP POLICY IF EXISTS "cmp_forn_read" ON cmp_fornecedores;
DROP POLICY IF EXISTS "cmp_forn_insert" ON cmp_fornecedores;
DROP POLICY IF EXISTS "cmp_forn_update" ON cmp_fornecedores;
DROP POLICY IF EXISTS "cmp_forn_delete" ON cmp_fornecedores;

CREATE POLICY "cmp_forn_read" ON cmp_fornecedores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cmp_forn_insert" ON cmp_fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "cmp_forn_update" ON cmp_fornecedores
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "cmp_forn_delete" ON cmp_fornecedores
  FOR DELETE TO authenticated
  USING (auth_at_least('admin'));

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. MÓDULO FINANCEIRO (011) — Manter service_role write, add authenticated read
-- ══════════════════════════════════════════════════════════════════════════════
-- fin_contas_pagar e fin_contas_receber já usam service_role para writes (bom!)
-- Apenas garantir que não há blanket write para authenticated

-- fin_documentos: adicionar insert para authenticated (upload de docs)
DROP POLICY IF EXISTS "fin_docs_write" ON fin_documentos;
DROP POLICY IF EXISTS "fin_docs_insert" ON fin_documentos;
DROP POLICY IF EXISTS "fin_docs_delete" ON fin_documentos;

CREATE POLICY "fin_docs_insert" ON fin_documentos
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "fin_docs_delete" ON fin_documentos
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. MÓDULO ESTOQUE (015)
-- ══════════════════════════════════════════════════════════════════════════════

-- est_itens
DROP POLICY IF EXISTS "auth_write_itens" ON est_itens;
DROP POLICY IF EXISTS "est_itens_read" ON est_itens;
DROP POLICY IF EXISTS "est_itens_insert" ON est_itens;
DROP POLICY IF EXISTS "est_itens_update" ON est_itens;
DROP POLICY IF EXISTS "est_itens_delete" ON est_itens;

CREATE POLICY "est_itens_read" ON est_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "est_itens_insert" ON est_itens
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "est_itens_update" ON est_itens
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "est_itens_delete" ON est_itens
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- est_solicitacoes
DROP POLICY IF EXISTS "auth_write_sol" ON est_solicitacoes;
DROP POLICY IF EXISTS "est_sol_read" ON est_solicitacoes;
DROP POLICY IF EXISTS "est_sol_insert" ON est_solicitacoes;
DROP POLICY IF EXISTS "est_sol_update" ON est_solicitacoes;
DROP POLICY IF EXISTS "est_sol_delete" ON est_solicitacoes;

CREATE POLICY "est_sol_read" ON est_solicitacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "est_sol_insert" ON est_solicitacoes
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "est_sol_update" ON est_solicitacoes
  FOR UPDATE TO authenticated
  USING (auth_at_least('requisitante'))
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "est_sol_delete" ON est_solicitacoes
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- est_solicitacao_itens
DROP POLICY IF EXISTS "auth_write_sol_itens" ON est_solicitacao_itens;
DROP POLICY IF EXISTS "est_sol_itens_read" ON est_solicitacao_itens;
DROP POLICY IF EXISTS "est_sol_itens_insert" ON est_solicitacao_itens;
DROP POLICY IF EXISTS "est_sol_itens_update" ON est_solicitacao_itens;
DROP POLICY IF EXISTS "est_sol_itens_delete" ON est_solicitacao_itens;

CREATE POLICY "est_sol_itens_read" ON est_solicitacao_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "est_sol_itens_insert" ON est_solicitacao_itens
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "est_sol_itens_update" ON est_solicitacao_itens
  FOR UPDATE TO authenticated
  USING (auth_at_least('requisitante'))
  WITH CHECK (auth_at_least('requisitante'));

CREATE POLICY "est_sol_itens_delete" ON est_solicitacao_itens
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- est_inventarios
DROP POLICY IF EXISTS "auth_write_inv" ON est_inventarios;
DROP POLICY IF EXISTS "est_inv_read" ON est_inventarios;
DROP POLICY IF EXISTS "est_inv_insert" ON est_inv;
DROP POLICY IF EXISTS "est_inv_update" ON est_inventarios;
DROP POLICY IF EXISTS "est_inv_delete" ON est_inventarios;

CREATE POLICY "est_inv_read" ON est_inventarios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "est_inv_insert" ON est_inventarios
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "est_inv_update" ON est_inventarios
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "est_inv_delete" ON est_inventarios
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- est_inventario_itens
DROP POLICY IF EXISTS "auth_write_inv_itens" ON est_inventario_itens;
DROP POLICY IF EXISTS "est_inv_itens_read" ON est_inventario_itens;
DROP POLICY IF EXISTS "est_inv_itens_insert" ON est_inventario_itens;
DROP POLICY IF EXISTS "est_inv_itens_update" ON est_inventario_itens;
DROP POLICY IF EXISTS "est_inv_itens_delete" ON est_inventario_itens;

CREATE POLICY "est_inv_itens_read" ON est_inventario_itens
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "est_inv_itens_insert" ON est_inventario_itens
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "est_inv_itens_update" ON est_inventario_itens
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "est_inv_itens_delete" ON est_inventario_itens
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

-- pat_imobilizados
DROP POLICY IF EXISTS "auth_write_imob" ON pat_imobilizados;
DROP POLICY IF EXISTS "pat_imob_read" ON pat_imobilizados;
DROP POLICY IF EXISTS "pat_imob_insert" ON pat_imobilizados;
DROP POLICY IF EXISTS "pat_imob_update" ON pat_imobilizados;
DROP POLICY IF EXISTS "pat_imob_delete" ON pat_imobilizados;

CREATE POLICY "pat_imob_read" ON pat_imobilizados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pat_imob_insert" ON pat_imobilizados
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "pat_imob_update" ON pat_imobilizados
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "pat_imob_delete" ON pat_imobilizados
  FOR DELETE TO authenticated
  USING (auth_at_least('admin'));

-- pat_movimentacoes
DROP POLICY IF EXISTS "auth_write_pat_movs" ON pat_movimentacoes;
DROP POLICY IF EXISTS "pat_mov_read" ON pat_movimentacoes;
DROP POLICY IF EXISTS "pat_mov_insert" ON pat_movimentacoes;
DROP POLICY IF EXISTS "pat_mov_delete" ON pat_movimentacoes;

CREATE POLICY "pat_mov_read" ON pat_movimentacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pat_mov_insert" ON pat_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "pat_mov_delete" ON pat_movimentacoes
  FOR DELETE TO authenticated
  USING (auth_at_least('admin'));

-- pat_termos_responsabilidade
DROP POLICY IF EXISTS "auth_write_termos" ON pat_termos_responsabilidade;
DROP POLICY IF EXISTS "pat_termos_read" ON pat_termos_responsabilidade;
DROP POLICY IF EXISTS "pat_termos_insert" ON pat_termos_responsabilidade;
DROP POLICY IF EXISTS "pat_termos_delete" ON pat_termos_responsabilidade;

CREATE POLICY "pat_termos_read" ON pat_termos_responsabilidade
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pat_termos_insert" ON pat_termos_responsabilidade
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('comprador'));

CREATE POLICY "pat_termos_delete" ON pat_termos_responsabilidade
  FOR DELETE TO authenticated
  USING (auth_at_least('admin'));

-- pat_depreciacoes
DROP POLICY IF EXISTS "auth_write_depre" ON pat_depreciacoes;
DROP POLICY IF EXISTS "pat_depre_read" ON pat_depreciacoes;
DROP POLICY IF EXISTS "pat_depre_insert" ON pat_depreciacoes;
DROP POLICY IF EXISTS "pat_depre_delete" ON pat_depreciacoes;

CREATE POLICY "pat_depre_read" ON pat_depreciacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pat_depre_insert" ON pat_depreciacoes
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('gerente'));

CREATE POLICY "pat_depre_delete" ON pat_depreciacoes
  FOR DELETE TO authenticated
  USING (auth_at_least('admin'));

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. MÓDULO LOGÍSTICA (016)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  old_policy TEXT;
BEGIN
  FOR tbl, old_policy IN VALUES
    ('log_transportadoras',       'log_transportadoras_write'),
    ('log_rotas',                 'log_rotas_write'),
    ('log_solicitacoes',          'log_solicitacoes_write'),
    ('log_itens_solicitacao',     'log_itens_write'),
    ('log_checklists_expedicao',  'log_checklist_write'),
    ('log_nfe',                   'log_nfe_write'),
    ('log_transportes',           'log_transportes_write'),
    ('log_ocorrencias',           'log_ocorrencias_write'),
    ('log_recebimentos',          'log_recebimentos_write'),
    ('log_avaliacoes',            'log_avaliacoes_write')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', old_policy, tbl);

    -- SELECT: todos autenticados
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      tbl || '_sel', tbl
    );

    -- INSERT: requisitante+
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_at_least(''requisitante''))',
      tbl || '_ins', tbl
    );

    -- UPDATE: comprador+
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_at_least(''comprador'')) WITH CHECK (auth_at_least(''comprador''))',
      tbl || '_upd', tbl
    );

    -- DELETE: gerente+
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_at_least(''gerente''))',
      tbl || '_del', tbl
    );
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. MÓDULO FROTAS (017)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN VALUES
    ('fro_veiculos'), ('fro_fornecedores'), ('fro_ordens_servico'),
    ('fro_itens_os'), ('fro_cotacoes_os'), ('fro_checklists'),
    ('fro_abastecimentos'), ('fro_ocorrencias_telemetria'),
    ('fro_avaliacoes_fornecedor'), ('fro_planos_preventiva')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS fro_auth_all ON %I', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      tbl || '_sel', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_at_least(''requisitante''))',
      tbl || '_ins', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_at_least(''comprador'')) WITH CHECK (auth_at_least(''comprador''))',
      tbl || '_upd', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_at_least(''gerente''))',
      tbl || '_del', tbl
    );
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. MÓDULO RH (019)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  old_pol TEXT;
BEGIN
  FOR tbl, old_pol IN VALUES
    ('rh_colaboradores',  'rh_col_write'),
    ('rh_documentos',     'rh_doc_write'),
    ('rh_beneficios',     'rh_ben_write')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', old_pol, tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      tbl || '_sel', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_at_least(''comprador''))',
      tbl || '_ins', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_at_least(''comprador'')) WITH CHECK (auth_at_least(''comprador''))',
      tbl || '_upd', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_at_least(''gerente''))',
      tbl || '_del', tbl
    );
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. MÓDULO HHT (020)
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "hht_lan_write" ON hht_lancamentos;
DROP POLICY IF EXISTS "hht_apr_write" ON hht_aprovacoes;

CREATE POLICY "hht_lan_sel" ON hht_lancamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hht_lan_ins" ON hht_lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('requisitante'));
CREATE POLICY "hht_lan_upd" ON hht_lancamentos
  FOR UPDATE TO authenticated
  USING (auth_at_least('comprador'))
  WITH CHECK (auth_at_least('comprador'));
CREATE POLICY "hht_lan_del" ON hht_lancamentos
  FOR DELETE TO authenticated
  USING (auth_at_least('gerente'));

CREATE POLICY "hht_apr_sel" ON hht_aprovacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "hht_apr_ins" ON hht_aprovacoes
  FOR INSERT TO authenticated
  WITH CHECK (auth_at_least('aprovador'));
CREATE POLICY "hht_apr_upd" ON hht_aprovacoes
  FOR UPDATE TO authenticated
  USING (auth_at_least('aprovador'))
  WITH CHECK (auth_at_least('aprovador'));
CREATE POLICY "hht_apr_del" ON hht_aprovacoes
  FOR DELETE TO authenticated
  USING (auth_at_least('admin'));

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. MÓDULO SSMA (021)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  old_pol TEXT;
BEGIN
  FOR tbl, old_pol IN VALUES
    ('ssm_epis',                'ssm_epis_write'),
    ('ssm_epi_colaborador',     'ssm_epict_write'),
    ('ssm_col_treinamento',     'ssm_ctrei_write'),
    ('ssm_aso',                 'ssm_aso_write'),
    ('ssm_permissoes_trabalho', 'ssm_pt_write'),
    ('ssm_inspecoes',           'ssm_insp_write'),
    ('ssm_ocorrencias',         'ssm_ocor_write')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', old_pol, tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      tbl || '_sel', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_at_least(''requisitante''))',
      tbl || '_ins', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_at_least(''comprador'')) WITH CHECK (auth_at_least(''comprador''))',
      tbl || '_upd', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_at_least(''gerente''))',
      tbl || '_del', tbl
    );
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 10. MÓDULO CONTRATOS (022 + 024)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl TEXT;
  old_pol TEXT;
BEGIN
  FOR tbl, old_pol IN VALUES
    ('con_clientes',        'con_cli_write'),
    ('con_contratos',       'con_cont_write'),
    ('con_medicoes',        'con_med_write'),
    ('con_medicao_itens',   'con_medi_write'),
    ('con_pleitos',         'con_ple_write'),
    ('con_contrato_itens',  'con_itens_write'),
    ('con_parcelas',        'con_parc_write'),
    ('con_parcela_anexos',  'con_panex_write')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', old_pol, tbl);

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      tbl || '_sel', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_at_least(''comprador''))',
      tbl || '_ins', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_at_least(''comprador'')) WITH CHECK (auth_at_least(''comprador''))',
      tbl || '_upd', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_at_least(''gerente''))',
      tbl || '_del', tbl
    );
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 11. MÓDULO CONTROLADORIA (023)
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "ctrl_orc_write" ON ctrl_orcamentos;
DROP POLICY IF EXISTS "ctrl_cen_write" ON ctrl_cenarios;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN VALUES ('ctrl_orcamentos'), ('ctrl_cenarios')
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (true)',
      tbl || '_sel', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (auth_at_least(''gerente''))',
      tbl || '_ins', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (auth_at_least(''gerente'')) WITH CHECK (auth_at_least(''gerente''))',
      tbl || '_upd', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (auth_at_least(''admin''))',
      tbl || '_del', tbl
    );
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIM 025_rls_granular.sql
-- ══════════════════════════════════════════════════════════════════════════════
