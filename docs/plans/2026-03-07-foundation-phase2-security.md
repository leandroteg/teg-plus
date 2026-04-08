# Foundation Phase 2 — Security Hardening & Data Integrity

**Date:** 2026-03-07
**Status:** Design approved
**Scope:** Fix all 7 remaining architectural issues (A–G)

---

## Overview

Phase 1 resolved layout duplication, ModuleRoute guards, lookup tables, and basic RLS helpers.
Phase 2 addresses the remaining 68 overly-permissive write policies, dangling anon policies,
missing FK constraints, exposed secrets, trigger logic gaps, and audit trail.

**Constraint:** Zero visual/functional changes. Everything must keep working exactly as before.

---

## Issue A — 68 open write policies for `authenticated`

### Problem
Every `authenticated` user (including `visitante` role=0) can INSERT/UPDATE/DELETE across nearly
all tables. The RLS helpers `get_user_role()` and `role_at_least()` exist but are unused.

### Solution
Drop all 68 open write policies and replace with role-gated versions.

**Role matrix (using `role_at_least()`):**

| Module prefix | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `cmp_*` (Compras) | authenticated | requisitante(1) | comprador(2) | gerente(4) |
| `fin_*` (Financeiro) | authenticated | comprador(2) | aprovador(3) | admin(5) |
| `fis_*` (Fiscal) | authenticated | comprador(2) | aprovador(3) | admin(5) |
| `con_*` (Contratos) | authenticated | gerente(4) | gerente(4) | admin(5) |
| `est_*` (Estoque) | authenticated | requisitante(1) | comprador(2) | gerente(4) |
| `pat_*` (Patrimonial) | authenticated | comprador(2) | comprador(2) | admin(5) |
| `fro_*` (Frotas) | authenticated | requisitante(1) | comprador(2) | gerente(4) |
| `log_*` (Logistica) | authenticated | requisitante(1) | comprador(2) | gerente(4) |
| `sys_obras` | authenticated | gerente(4) | gerente(4) | admin(5) |
| `sys_empresas` | authenticated | admin(5) | admin(5) | admin(5) |
| `n8n_chat_histories` | authenticated | authenticated | authenticated | admin(5) |
| `cache_consultas` | authenticated | authenticated | authenticated | — |
| `sys_whatsapp_log` | authenticated | authenticated | — | — |

**Implementation pattern:**
```sql
-- Drop old open policy
DROP POLICY IF EXISTS "auth_full_cmp_requisicoes" ON cmp_requisicoes;

-- Granular replacements
CREATE POLICY "cmp_req_insert" ON cmp_requisicoes FOR INSERT TO authenticated
  WITH CHECK (public.role_at_least('requisitante'));

CREATE POLICY "cmp_req_update" ON cmp_requisicoes FOR UPDATE TO authenticated
  USING (public.role_at_least('comprador'))
  WITH CHECK (public.role_at_least('comprador'));

CREATE POLICY "cmp_req_delete" ON cmp_requisicoes FOR DELETE TO authenticated
  USING (public.role_at_least('gerente'));
```

**Special cases:**
- `apr_aprovacoes`: INSERT/UPDATE require `aprovador(3)`, keep existing SELECT
- `cmp_historico_status`: INSERT-only for `requisitante`, no UPDATE/DELETE
- `cmp_pedidos_anexos`: INSERT for `comprador`, no DELETE needed
- `est_movimentacoes`: INSERT-only (immutable log), no UPDATE/DELETE

---

## Issue B — 5 dangerous anon write policies

### Problem
Non-authenticated users can write to certain tables.

### Solution

| Policy | Action |
|---|---|
| `anon_approval_update_by_token` on `apr_aprovacoes` | **KEEP** — required for external approval flow, already filtered by token |
| `Anon can insert cache` on `cache_consultas` | **KEEP** — CNPJ/CEP lookup from login page |
| `Anon can upsert cache` on `cache_consultas` | **KEEP** — same reason |
| `cotforn_anon_insert` on `cmp_cotacao_fornecedores` | **DROP** — external supplier quote should use RPC |
| `anon_insert_sys_log` on `sys_log_atividades` | **DROP** — log should require authentication |
| `perfil_anon_insert` on `sys_perfis` | **DROP** — profile is created via auth trigger |

---

## Issue C — Contratos FOR ALL without role filter

Covered by Issue A matrix. `con_*` tables get: INSERT/UPDATE → `gerente(4)`, DELETE → `admin(5)`.

---

## Issue D — `projeto_id` UUID without FK

### Problem
4 tables have `projeto_id UUID` with no REFERENCES constraint.

### Solution
```sql
ALTER TABLE cmp_requisicoes
  ADD CONSTRAINT fk_req_projeto FOREIGN KEY (projeto_id)
  REFERENCES sys_obras(id) ON DELETE SET NULL;

-- Same for cmp_pedidos, fin_contas_pagar, fin_contas_receber
```

`ON DELETE SET NULL` is safest — if an obra is deleted, financial records keep existing but lose the link.

---

## Issue E — `get_omie_config()` exposes API secret

### Problem
Any authenticated user can call `get_omie_config()` (SECURITY DEFINER) and see the Omie API key/secret.

### Solution
Add role check at start of function:
```sql
CREATE OR REPLACE FUNCTION get_omie_config()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.role_at_least('admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente admin pode acessar configurações Omie';
  END IF;
  -- ... existing body
END;
$$;
```

---

## Issue F — Trigger CP hardcodes `natureza = 'material'`

### Problem
`criar_cp_ao_emitir_pedido()` always sets `natureza = 'material'` regardless of requisition type.

### Solution
Read `natureza` from the requisition if available, fallback to 'material':
```sql
-- In the trigger function, replace:
--   'material'
-- With:
COALESCE(v_req.natureza, 'material')
```

Also need to check if `cmp_requisicoes.natureza` column exists and add it if not.

---

## Issue G — Audit trail (sys_log_atividades not populated)

### Problem
`sys_log_atividades` table exists but no triggers populate it.

### Solution
Create a generic audit trigger function:
```sql
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO sys_log_atividades (
    perfil_id, tipo, descricao, detalhes, created_at
  ) VALUES (
    auth.uid(),
    TG_TABLE_NAME || '.' || TG_OP,
    TG_OP || ' on ' || TG_TABLE_NAME,
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
      'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
    ),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
```

Apply to critical tables: `fin_contas_pagar`, `fin_contas_receber`, `con_contratos`, `con_parcelas`.

---

## Implementation Tasks

1. **Migration: Drop 3 dangerous anon policies** (~5 min)
2. **Migration: Replace 68 open authenticated write policies** (~45 min, one SQL file)
3. **Migration: Add FK constraints for projeto_id** (~5 min)
4. **Migration: Protect get_omie_config()** (~5 min)
5. **Migration: Fix trigger natureza** (~10 min)
6. **Migration: Audit trail trigger** (~15 min)
7. **Verification: Build + SQL checks + functional test** (~15 min)

**Total estimated:** ~2h of execution (SQL-only, no frontend changes needed)

---

## Risk Mitigation

- All changes are SQL migrations — easily reversible
- role_at_least() is battle-tested from Phase 1
- No frontend code changes = no risk of UI regression
- Each migration is independent and can be rolled back individually


## Links
- [[obsidian/09 - Auth Sistema]]
