# Foundation Phase 2 — Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 68 open write policies, 3 dangerous anon policies, missing FKs, exposed secrets, trigger gaps, and audit trail.

**Architecture:** All changes are Supabase SQL migrations via MCP `apply_migration`. Uses existing `role_at_least()` helper from Phase 1. Zero frontend changes.

**Tech Stack:** PostgreSQL 15 (Supabase), RLS policies, triggers, SECURITY DEFINER functions.

**Supabase project ID:** `uzfjfucrinokeuwpbeie`

---

### Task 1: Drop dangerous anon write policies

**What:** Remove 3 anon policies that allow unauthenticated writes to sensitive tables.

**Step 1: Apply migration**

```sql
-- Migration name: phase2_drop_dangerous_anon
DROP POLICY IF EXISTS "cotforn_anon_insert" ON cmp_cotacao_fornecedores;
DROP POLICY IF EXISTS "anon_insert_sys_log" ON sys_log_atividades;
DROP POLICY IF EXISTS "perfil_anon_insert" ON sys_perfis;
```

**Step 2: Verify**

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE 'anon' = ANY(roles) AND cmd != 'SELECT'
ORDER BY tablename;
```

Expected: Only 3 remaining (apr_aprovacoes UPDATE, cache_consultas INSERT, cache_consultas UPDATE).

**Step 3: Commit** — `fix(security): drop 3 dangerous anon write policies`

---

### Task 2: Replace open write policies — Compras module (cmp_*)

**What:** Drop 12 open policies on 8 cmp_* tables, replace with role-gated versions.

**Step 1: Apply migration**

```sql
-- Migration name: phase2_rls_compras

-- ── cmp_requisicoes ──
DROP POLICY IF EXISTS "auth_full_cmp_requisicoes" ON cmp_requisicoes;
CREATE POLICY "cmp_req_insert" ON cmp_requisicoes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "cmp_req_update" ON cmp_requisicoes FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_req_delete" ON cmp_requisicoes FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── cmp_requisicao_itens ──
DROP POLICY IF EXISTS "auth_full_cmp_requisicao_itens" ON cmp_requisicao_itens;
CREATE POLICY "cmp_ri_insert" ON cmp_requisicao_itens FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "cmp_ri_update" ON cmp_requisicao_itens FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_ri_delete" ON cmp_requisicao_itens FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── cmp_cotacoes ──
DROP POLICY IF EXISTS "auth_full_cmp_cotacoes" ON cmp_cotacoes;
CREATE POLICY "cmp_cot_insert" ON cmp_cotacoes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_cot_update" ON cmp_cotacoes FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_cot_delete" ON cmp_cotacoes FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── cmp_cotacao_fornecedores ──
DROP POLICY IF EXISTS "auth_full_cmp_cotacao_fornecedores" ON cmp_cotacao_fornecedores;
CREATE POLICY "cmp_cf_insert" ON cmp_cotacao_fornecedores FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_cf_update" ON cmp_cotacao_fornecedores FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_cf_delete" ON cmp_cotacao_fornecedores FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── cmp_pedidos ──
DROP POLICY IF EXISTS "auth_full_cmp_pedidos" ON cmp_pedidos;
CREATE POLICY "cmp_ped_insert" ON cmp_pedidos FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_ped_update" ON cmp_pedidos FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_ped_delete" ON cmp_pedidos FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── cmp_pedidos_anexos (INSERT only, no DELETE by design) ──
DROP POLICY IF EXISTS "pedidos_anexos_insert" ON cmp_pedidos_anexos;
CREATE POLICY "cmp_pa_insert" ON cmp_pedidos_anexos FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));

-- ── cmp_anexos ──
DROP POLICY IF EXISTS "auth_full_cmp_anexos" ON cmp_anexos;
CREATE POLICY "cmp_anx_insert" ON cmp_anexos FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "cmp_anx_update" ON cmp_anexos FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_anx_delete" ON cmp_anexos FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── cmp_historico_status (INSERT only — immutable log) ──
DROP POLICY IF EXISTS "auth_full_cmp_historico_status" ON cmp_historico_status;
CREATE POLICY "cmp_hs_insert" ON cmp_historico_status FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));

-- ── cmp_categorias ──
DROP POLICY IF EXISTS "auth_full_cmp_categorias" ON cmp_categorias;
DROP POLICY IF EXISTS "categorias_auth_all" ON cmp_categorias;
CREATE POLICY "cmp_cat_insert" ON cmp_categorias FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_cat_update" ON cmp_categorias FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_cat_delete" ON cmp_categorias FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── cmp_compradores ──
DROP POLICY IF EXISTS "auth_full_cmp_compradores" ON cmp_compradores;
DROP POLICY IF EXISTS "compradores_auth_all" ON cmp_compradores;
CREATE POLICY "cmp_comp_insert" ON cmp_compradores FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "cmp_comp_update" ON cmp_compradores FOR UPDATE TO authenticated
  USING (public.role_at_least('gerente')) WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "cmp_comp_delete" ON cmp_compradores FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── cmp_fornecedores ──
DROP POLICY IF EXISTS "fornecedores_insert_auth" ON cmp_fornecedores;
DROP POLICY IF EXISTS "fornecedores_update_auth" ON cmp_fornecedores;
DROP POLICY IF EXISTS "fornecedores_delete_auth" ON cmp_fornecedores;
CREATE POLICY "cmp_forn_insert" ON cmp_fornecedores FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_forn_update" ON cmp_fornecedores FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "cmp_forn_delete" ON cmp_fornecedores FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));
```

**Step 2: Verify**

```sql
SELECT COUNT(*) FROM pg_policies
WHERE tablename LIKE 'cmp_%' AND 'authenticated' = ANY(roles)
  AND (qual = 'true' OR with_check = 'true') AND cmd IN ('ALL','INSERT','UPDATE','DELETE');
```

Expected: 0

**Step 3: Commit** — `fix(security): role-gate all cmp_* write policies`

---

### Task 3: Replace open write policies — Financeiro module (fin_*)

**Step 1: Apply migration**

```sql
-- Migration name: phase2_rls_financeiro

-- ── fin_contas_pagar ──
DROP POLICY IF EXISTS "fin_cp_insert_authenticated" ON fin_contas_pagar;
DROP POLICY IF EXISTS "fin_cp_update_authenticated" ON fin_contas_pagar;
CREATE POLICY "fin_cp_insert" ON fin_contas_pagar FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fin_cp_update" ON fin_contas_pagar FOR UPDATE TO authenticated
  USING (public.role_at_least('aprovador')) WITH CHECK (public.role_at_least('aprovador'));
CREATE POLICY "fin_cp_delete" ON fin_contas_pagar FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── fin_grupos_financeiros ──
DROP POLICY IF EXISTS "grupos_fin_insert" ON fin_grupos_financeiros;
DROP POLICY IF EXISTS "grupos_fin_update" ON fin_grupos_financeiros;
DROP POLICY IF EXISTS "grupos_fin_delete" ON fin_grupos_financeiros;
CREATE POLICY "fin_gf_insert" ON fin_grupos_financeiros FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fin_gf_update" ON fin_grupos_financeiros FOR UPDATE TO authenticated
  USING (public.role_at_least('aprovador')) WITH CHECK (public.role_at_least('aprovador'));
CREATE POLICY "fin_gf_delete" ON fin_grupos_financeiros FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── fin_categorias_financeiras ──
DROP POLICY IF EXISTS "categorias_fin_insert" ON fin_categorias_financeiras;
DROP POLICY IF EXISTS "categorias_fin_update" ON fin_categorias_financeiras;
DROP POLICY IF EXISTS "categorias_fin_delete" ON fin_categorias_financeiras;
CREATE POLICY "fin_cf_insert" ON fin_categorias_financeiras FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fin_cf_update" ON fin_categorias_financeiras FOR UPDATE TO authenticated
  USING (public.role_at_least('aprovador')) WITH CHECK (public.role_at_least('aprovador'));
CREATE POLICY "fin_cf_delete" ON fin_categorias_financeiras FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));
```

**Step 2: Verify** — same pattern, `WHERE tablename LIKE 'fin_%'`, expect 0

**Step 3: Commit** — `fix(security): role-gate all fin_* write policies`

---

### Task 4: Replace open write policies — Fiscal module (fis_*)

**Step 1: Apply migration**

```sql
-- Migration name: phase2_rls_fiscal

-- ── fis_notas_fiscais ──
DROP POLICY IF EXISTS "fis_nf_insert" ON fis_notas_fiscais;
DROP POLICY IF EXISTS "fis_nf_update" ON fis_notas_fiscais;
DROP POLICY IF EXISTS "fis_nf_delete" ON fis_notas_fiscais;
CREATE POLICY "fis_nf_insert_rg" ON fis_notas_fiscais FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fis_nf_update_rg" ON fis_notas_fiscais FOR UPDATE TO authenticated
  USING (public.role_at_least('aprovador')) WITH CHECK (public.role_at_least('aprovador'));
CREATE POLICY "fis_nf_delete_rg" ON fis_notas_fiscais FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── fis_solicitacoes_nf ──
DROP POLICY IF EXISTS "Authenticated can insert solicitacoes_nf" ON fis_solicitacoes_nf;
DROP POLICY IF EXISTS "Authenticated can update solicitacoes_nf" ON fis_solicitacoes_nf;
CREATE POLICY "fis_snf_insert" ON fis_solicitacoes_nf FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fis_snf_update" ON fis_solicitacoes_nf FOR UPDATE TO authenticated
  USING (public.role_at_least('aprovador')) WITH CHECK (public.role_at_least('aprovador'));
CREATE POLICY "fis_snf_delete" ON fis_solicitacoes_nf FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));
```

**Step 2: Verify** — same pattern, `WHERE tablename LIKE 'fis_%'`, expect 0

**Step 3: Commit** — `fix(security): role-gate all fis_* write policies`

---

### Task 5: Replace open write policies — Contratos module (con_*)

**Step 1: Apply migration**

```sql
-- Migration name: phase2_rls_contratos

-- Drop all 5 con_* open policies
DROP POLICY IF EXISTS "con_clientes_all" ON con_clientes;
DROP POLICY IF EXISTS "con_contratos_all" ON con_contratos;
DROP POLICY IF EXISTS "con_contrato_itens_all" ON con_contrato_itens;
DROP POLICY IF EXISTS "con_parcelas_all" ON con_parcelas;
DROP POLICY IF EXISTS "con_parcela_anexos_all" ON con_parcela_anexos;

-- ── con_clientes ──
CREATE POLICY "con_cli_select" ON con_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_cli_insert" ON con_clientes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_cli_update" ON con_clientes FOR UPDATE TO authenticated
  USING (public.role_at_least('gerente')) WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_cli_delete" ON con_clientes FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── con_contratos ──
CREATE POLICY "con_cont_select" ON con_contratos FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_cont_insert" ON con_contratos FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_cont_update" ON con_contratos FOR UPDATE TO authenticated
  USING (public.role_at_least('gerente')) WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_cont_delete" ON con_contratos FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── con_contrato_itens ──
CREATE POLICY "con_ci_select" ON con_contrato_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_ci_insert" ON con_contrato_itens FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_ci_update" ON con_contrato_itens FOR UPDATE TO authenticated
  USING (public.role_at_least('gerente')) WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_ci_delete" ON con_contrato_itens FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── con_parcelas ──
CREATE POLICY "con_parc_select" ON con_parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_parc_insert" ON con_parcelas FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_parc_update" ON con_parcelas FOR UPDATE TO authenticated
  USING (public.role_at_least('gerente')) WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_parc_delete" ON con_parcelas FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── con_parcela_anexos ──
CREATE POLICY "con_pa_select" ON con_parcela_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "con_pa_insert" ON con_parcela_anexos FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "con_pa_delete" ON con_parcela_anexos FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));
```

**Step 2: Verify** — same pattern, `WHERE tablename LIKE 'con_%'`, expect 0

**Step 3: Commit** — `fix(security): role-gate all con_* write policies`

---

### Task 6: Replace open write policies — Estoque + Patrimonial (est_*, pat_*)

**Step 1: Apply migration**

```sql
-- Migration name: phase2_rls_estoque_patrimonial

-- ── est_itens ──
DROP POLICY IF EXISTS "auth_write_itens" ON est_itens;
CREATE POLICY "est_it_insert" ON est_itens FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "est_it_update" ON est_itens FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "est_it_delete" ON est_itens FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── est_movimentacoes (INSERT only — immutable) ──
DROP POLICY IF EXISTS "auth_write_movs" ON est_movimentacoes;
CREATE POLICY "est_mov_insert" ON est_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));

-- ── est_solicitacoes ──
DROP POLICY IF EXISTS "auth_write_sol" ON est_solicitacoes;
CREATE POLICY "est_sol_insert" ON est_solicitacoes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "est_sol_update" ON est_solicitacoes FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "est_sol_delete" ON est_solicitacoes FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── est_solicitacao_itens ──
DROP POLICY IF EXISTS "auth_write_sol_itens" ON est_solicitacao_itens;
CREATE POLICY "est_si_insert" ON est_solicitacao_itens FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "est_si_update" ON est_solicitacao_itens FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "est_si_delete" ON est_solicitacao_itens FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── est_inventarios ──
DROP POLICY IF EXISTS "auth_write_inv" ON est_inventarios;
CREATE POLICY "est_inv_insert" ON est_inventarios FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "est_inv_update" ON est_inventarios FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "est_inv_delete" ON est_inventarios FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── est_inventario_itens ──
DROP POLICY IF EXISTS "auth_write_inv_itens" ON est_inventario_itens;
CREATE POLICY "est_ii_insert" ON est_inventario_itens FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "est_ii_update" ON est_inventario_itens FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "est_ii_delete" ON est_inventario_itens FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── pat_imobilizados ──
DROP POLICY IF EXISTS "auth_write_imob" ON pat_imobilizados;
CREATE POLICY "pat_imob_insert" ON pat_imobilizados FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "pat_imob_update" ON pat_imobilizados FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "pat_imob_delete" ON pat_imobilizados FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── pat_depreciacoes ──
DROP POLICY IF EXISTS "auth_write_depre" ON pat_depreciacoes;
CREATE POLICY "pat_dep_insert" ON pat_depreciacoes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "pat_dep_update" ON pat_depreciacoes FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "pat_dep_delete" ON pat_depreciacoes FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── pat_movimentacoes ──
DROP POLICY IF EXISTS "auth_write_pat_movs" ON pat_movimentacoes;
CREATE POLICY "pat_mov_insert" ON pat_movimentacoes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "pat_mov_update" ON pat_movimentacoes FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "pat_mov_delete" ON pat_movimentacoes FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── pat_termos_responsabilidade ──
DROP POLICY IF EXISTS "auth_write_termos" ON pat_termos_responsabilidade;
CREATE POLICY "pat_tr_insert" ON pat_termos_responsabilidade FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "pat_tr_update" ON pat_termos_responsabilidade FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "pat_tr_delete" ON pat_termos_responsabilidade FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));
```

**Step 2: Verify** — `WHERE tablename LIKE 'est_%' OR tablename LIKE 'pat_%'`, expect 0

**Step 3: Commit** — `fix(security): role-gate all est_*/pat_* write policies`

---

### Task 7: Replace open write policies — Frotas module (fro_*)

**Step 1: Apply migration**

```sql
-- Migration name: phase2_rls_frotas

-- Drop all fro_* open policies (10 tables, all named "fro_auth_all")
DROP POLICY IF EXISTS "fro_auth_all" ON fro_veiculos;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_ordens_servico;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_itens_os;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_cotacoes_os;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_fornecedores;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_avaliacoes_fornecedor;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_checklists;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_abastecimentos;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_planos_preventiva;
DROP POLICY IF EXISTS "fro_auth_all" ON fro_ocorrencias_telemetria;

-- Helper: creates standard INSERT/UPDATE/DELETE policies for a table
-- We'll inline for clarity

-- ── fro_veiculos ──
CREATE POLICY "fro_veic_insert" ON fro_veiculos FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_veic_update" ON fro_veiculos FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_veic_delete" ON fro_veiculos FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_ordens_servico ──
CREATE POLICY "fro_os_insert" ON fro_ordens_servico FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "fro_os_update" ON fro_ordens_servico FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_os_delete" ON fro_ordens_servico FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_itens_os ──
CREATE POLICY "fro_ios_insert" ON fro_itens_os FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "fro_ios_update" ON fro_itens_os FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_ios_delete" ON fro_itens_os FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_cotacoes_os ──
CREATE POLICY "fro_cos_insert" ON fro_cotacoes_os FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_cos_update" ON fro_cotacoes_os FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_cos_delete" ON fro_cotacoes_os FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_fornecedores ──
CREATE POLICY "fro_forn_insert" ON fro_fornecedores FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_forn_update" ON fro_fornecedores FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_forn_delete" ON fro_fornecedores FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_avaliacoes_fornecedor ──
CREATE POLICY "fro_af_insert" ON fro_avaliacoes_fornecedor FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_af_update" ON fro_avaliacoes_fornecedor FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_af_delete" ON fro_avaliacoes_fornecedor FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_checklists ──
CREATE POLICY "fro_ck_insert" ON fro_checklists FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "fro_ck_update" ON fro_checklists FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_ck_delete" ON fro_checklists FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_abastecimentos ──
CREATE POLICY "fro_ab_insert" ON fro_abastecimentos FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "fro_ab_update" ON fro_abastecimentos FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_ab_delete" ON fro_abastecimentos FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_planos_preventiva ──
CREATE POLICY "fro_pp_insert" ON fro_planos_preventiva FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_pp_update" ON fro_planos_preventiva FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "fro_pp_delete" ON fro_planos_preventiva FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));

-- ── fro_ocorrencias_telemetria (INSERT only — immutable sensor data) ──
CREATE POLICY "fro_ot_insert" ON fro_ocorrencias_telemetria FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));
```

**Step 2: Verify** — `WHERE tablename LIKE 'fro_%'`, expect 0

**Step 3: Commit** — `fix(security): role-gate all fro_* write policies`

---

### Task 8: Replace open write policies — Logistica + System + Other (log_*, sys_*, apr_*, n8n_*, cache_*)

**Step 1: Apply migration**

```sql
-- Migration name: phase2_rls_logistica_system

-- ── log_* tables (10 tables, all named "*_write") ──
DROP POLICY IF EXISTS "log_avaliacoes_write" ON log_avaliacoes;
DROP POLICY IF EXISTS "log_checklist_write" ON log_checklists_expedicao;
DROP POLICY IF EXISTS "log_itens_write" ON log_itens_solicitacao;
DROP POLICY IF EXISTS "log_nfe_write" ON log_nfe;
DROP POLICY IF EXISTS "log_ocorrencias_write" ON log_ocorrencias;
DROP POLICY IF EXISTS "log_recebimentos_write" ON log_recebimentos;
DROP POLICY IF EXISTS "log_rotas_write" ON log_rotas;
DROP POLICY IF EXISTS "log_solicitacoes_write" ON log_solicitacoes;
DROP POLICY IF EXISTS "log_transportadoras_write" ON log_transportadoras;
DROP POLICY IF EXISTS "log_transportes_write" ON log_transportes;

-- Logistica tables: INSERT=requisitante, UPDATE=comprador, DELETE=gerente
CREATE POLICY "log_aval_insert" ON log_avaliacoes FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_aval_update" ON log_avaliacoes FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_aval_delete" ON log_avaliacoes FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_ck_insert" ON log_checklists_expedicao FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_ck_update" ON log_checklists_expedicao FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_ck_delete" ON log_checklists_expedicao FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_is_insert" ON log_itens_solicitacao FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_is_update" ON log_itens_solicitacao FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_is_delete" ON log_itens_solicitacao FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_nfe_insert" ON log_nfe FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_nfe_update" ON log_nfe FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_nfe_delete" ON log_nfe FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_oco_insert" ON log_ocorrencias FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_oco_update" ON log_ocorrencias FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_oco_delete" ON log_ocorrencias FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_rec_insert" ON log_recebimentos FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_rec_update" ON log_recebimentos FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_rec_delete" ON log_recebimentos FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_rot_insert" ON log_rotas FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_rot_update" ON log_rotas FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_rot_delete" ON log_rotas FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_sol_insert" ON log_solicitacoes FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_sol_update" ON log_solicitacoes FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_sol_delete" ON log_solicitacoes FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_tran_insert" ON log_transportadoras FOR INSERT TO authenticated WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_tran_update" ON log_transportadoras FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_tran_delete" ON log_transportadoras FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

CREATE POLICY "log_tp_insert" ON log_transportes FOR INSERT TO authenticated WITH CHECK (public.role_at_least('requisitante'));
CREATE POLICY "log_tp_update" ON log_transportes FOR UPDATE TO authenticated USING (public.role_at_least('comprador')) WITH CHECK (public.role_at_least('comprador'));
CREATE POLICY "log_tp_delete" ON log_transportes FOR DELETE TO authenticated USING (public.role_at_least('gerente'));

-- ── apr_aprovacoes ──
DROP POLICY IF EXISTS "auth_full_apr_aprovacoes" ON apr_aprovacoes;
CREATE POLICY "apr_insert" ON apr_aprovacoes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('aprovador'));
CREATE POLICY "apr_update" ON apr_aprovacoes FOR UPDATE TO authenticated
  USING (public.role_at_least('aprovador')) WITH CHECK (public.role_at_least('aprovador'));
CREATE POLICY "apr_delete" ON apr_aprovacoes FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── sys_obras ──
DROP POLICY IF EXISTS "auth_full_sys_obras" ON sys_obras;
CREATE POLICY "sys_obras_insert" ON sys_obras FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "sys_obras_update" ON sys_obras FOR UPDATE TO authenticated
  USING (public.role_at_least('gerente')) WITH CHECK (public.role_at_least('gerente'));
CREATE POLICY "sys_obras_delete" ON sys_obras FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── sys_empresas ──
DROP POLICY IF EXISTS "empresas_insert" ON sys_empresas;
DROP POLICY IF EXISTS "empresas_update" ON sys_empresas;
DROP POLICY IF EXISTS "empresas_delete" ON sys_empresas;
CREATE POLICY "sys_emp_insert" ON sys_empresas FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('admin'));
CREATE POLICY "sys_emp_update" ON sys_empresas FOR UPDATE TO authenticated
  USING (public.role_at_least('admin')) WITH CHECK (public.role_at_least('admin'));
CREATE POLICY "sys_emp_delete" ON sys_empresas FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── sys_whatsapp_log (INSERT only — log table) ──
DROP POLICY IF EXISTS "auth_full_sys_whatsapp_log" ON sys_whatsapp_log;
CREATE POLICY "sys_wl_insert" ON sys_whatsapp_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── n8n_chat_histories (open for authenticated, delete restricted) ──
DROP POLICY IF EXISTS "auth_full_n8n_chat_histories" ON n8n_chat_histories;
DROP POLICY IF EXISTS "chat_auth_all" ON n8n_chat_histories;
CREATE POLICY "n8n_ch_insert" ON n8n_chat_histories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "n8n_ch_update" ON n8n_chat_histories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "n8n_ch_delete" ON n8n_chat_histories FOR DELETE TO authenticated
  USING (public.role_at_least('admin'));

-- ── cache_consultas (keep open — lookup cache) ──
-- Already has narrowed INSERT/UPDATE policies, but drop the authenticated ones
DROP POLICY IF EXISTS "Authenticated users can insert cache" ON cache_consultas;
DROP POLICY IF EXISTS "Authenticated users can update cache" ON cache_consultas;
-- Anon policies already cover this + authenticated inherits. No action needed.
-- But we do need authenticated write:
CREATE POLICY "cache_auth_insert" ON cache_consultas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cache_auth_update" ON cache_consultas FOR UPDATE TO authenticated USING (true);
```

**Step 2: Verify**

```sql
SELECT COUNT(*) FROM pg_policies
WHERE 'authenticated' = ANY(roles)
  AND (qual = 'true' OR with_check = 'true')
  AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
  AND tablename NOT IN ('n8n_chat_histories','cache_consultas','sys_whatsapp_log');
```

Expected: 0 (the 3 excluded tables intentionally keep open INSERT)

**Step 3: Commit** — `fix(security): role-gate log_*/sys_*/apr_* write policies`

---

### Task 9: Add FK constraints for projeto_id

**Step 1: Apply migration**

```sql
-- Migration name: phase2_fk_projeto_id

ALTER TABLE cmp_requisicoes
  ADD CONSTRAINT fk_cmp_req_projeto FOREIGN KEY (projeto_id)
  REFERENCES sys_obras(id) ON DELETE SET NULL;

ALTER TABLE cmp_pedidos
  ADD CONSTRAINT fk_cmp_ped_projeto FOREIGN KEY (projeto_id)
  REFERENCES sys_obras(id) ON DELETE SET NULL;

ALTER TABLE fin_contas_pagar
  ADD CONSTRAINT fk_fin_cp_projeto FOREIGN KEY (projeto_id)
  REFERENCES sys_obras(id) ON DELETE SET NULL;

ALTER TABLE fin_contas_receber
  ADD CONSTRAINT fk_fin_cr_projeto FOREIGN KEY (projeto_id)
  REFERENCES sys_obras(id) ON DELETE SET NULL;
```

**Step 2: Verify**

```sql
SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'projeto_id';
```

Expected: 4 rows, all referencing `sys_obras`

**Step 3: Commit** — `fix(data): add FK constraints for projeto_id → sys_obras`

---

### Task 10: Protect get_omie_config() — admin only

**Step 1: Apply migration**

```sql
-- Migration name: phase2_protect_omie_config

CREATE OR REPLACE FUNCTION get_omie_config()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_app_key    TEXT;
  v_app_secret TEXT;
BEGIN
  -- Only admins can access API credentials
  IF NOT public.role_at_least('admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente admin pode acessar configurações Omie';
  END IF;

  SELECT valor INTO v_app_key
  FROM sys_config
  WHERE chave = 'omie_app_key';

  SELECT valor INTO v_app_secret
  FROM sys_config
  WHERE chave = 'omie_app_secret';

  RETURN json_build_object(
    'omie_app_key',    v_app_key,
    'omie_app_secret', v_app_secret
  );
END;
$$;
```

**Step 2: Verify** — function exists with same name, prosecdef = true

**Step 3: Commit** — `fix(security): restrict get_omie_config() to admin role`

---

### Task 11: Fix trigger CP natureza — use requisition categoria

**Step 1: Apply migration**

```sql
-- Migration name: phase2_fix_trigger_natureza

CREATE OR REPLACE FUNCTION criar_cp_ao_emitir_pedido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req      cmp_requisicoes%ROWTYPE;
  v_data_venc DATE;
BEGIN
  IF EXISTS (SELECT 1 FROM fin_contas_pagar WHERE pedido_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_req
  FROM cmp_requisicoes
  WHERE id = NEW.requisicao_id;

  v_data_venc := COALESCE(NEW.data_prevista_entrega::DATE + 30, CURRENT_DATE + 30);

  INSERT INTO fin_contas_pagar (
    pedido_id,
    requisicao_id,
    fornecedor_nome,
    valor_original,
    data_emissao,
    data_vencimento,
    data_vencimento_orig,
    status,
    centro_custo,
    classe_financeira,
    projeto_id,
    descricao,
    natureza
  ) VALUES (
    NEW.id,
    NEW.requisicao_id,
    NEW.fornecedor_nome,
    NEW.valor_total,
    CURRENT_DATE,
    v_data_venc,
    v_data_venc,
    'previsto',
    v_req.centro_custo,
    v_req.classe_financeira,
    v_req.projeto_id,
    v_req.descricao,
    COALESCE(v_req.categoria, 'material')
  );

  RETURN NEW;
END;
$$;
```

**Step 2: Verify**

```sql
SELECT prosrc FROM pg_proc WHERE proname = 'criar_cp_ao_emitir_pedido';
-- Should contain COALESCE(v_req.categoria, 'material')
```

**Step 3: Commit** — `fix(trigger): use requisition categoria for CP natureza`

---

### Task 12: Audit trail trigger on critical tables

**Step 1: Apply migration**

```sql
-- Migration name: phase2_audit_trail

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO sys_log_atividades (
    modulo,
    entidade_tipo,
    entidade_id,
    tipo,
    descricao,
    usuario_id,
    dados,
    created_at
  ) VALUES (
    SPLIT_PART(TG_TABLE_NAME, '_', 1),
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN (OLD).id ELSE (NEW).id END,
    TG_OP,
    TG_OP || ' on ' || TG_TABLE_NAME,
    auth.uid(),
    jsonb_build_object(
      'operation', TG_OP,
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    ),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply to critical tables
CREATE TRIGGER audit_fin_cp AFTER INSERT OR UPDATE OR DELETE ON fin_contas_pagar
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_fin_cr AFTER INSERT OR UPDATE OR DELETE ON fin_contas_receber
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_con_contratos AFTER INSERT OR UPDATE OR DELETE ON con_contratos
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_con_parcelas AFTER INSERT OR UPDATE OR DELETE ON con_parcelas
  FOR EACH ROW EXECUTE FUNCTION log_audit_changes();
```

**Step 2: Verify**

```sql
SELECT tgname, tgrelid::regclass FROM pg_trigger
WHERE tgname LIKE 'audit_%' AND NOT tgisinternal;
```

Expected: 4 triggers

**Step 3: Commit** — `feat(audit): add audit trail triggers on financial/contracts tables`

---

### Task 13: Final verification

**Step 1: Count remaining open write policies**

```sql
SELECT COUNT(*) as open_write_policies
FROM pg_policies
WHERE 'authenticated' = ANY(roles)
  AND cmd IN ('ALL')
  AND (qual = 'true' OR with_check = 'true');
```

Expected: 0 (no more FOR ALL USING(true))

**Step 2: Count total role-gated policies**

```sql
SELECT COUNT(*) FROM pg_policies
WHERE 'authenticated' = ANY(roles)
  AND (qual LIKE '%role_at_least%' OR with_check LIKE '%role_at_least%');
```

Expected: ~100+ role-gated policies

**Step 3: Verify FK constraints**

```sql
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'projeto_id';
```

Expected: 4 rows

**Step 4: Build check**

```bash
cd frontend && npm run build
```

Expected: Clean build (no frontend changes)

**Step 5: Commit + push** — `chore: Foundation Phase 2 complete — security hardening`
