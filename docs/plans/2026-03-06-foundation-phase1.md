# TEG+ Foundation Phase 1 — Clean Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the core infrastructure (RLS, layouts, routing, hooks) so every module benefits from a solid, DRY, scalable foundation — without changing ANY visual/design.

**Architecture:** Replace 7 duplicated module layouts with a single generic `ModuleLayout`. Lock down Supabase RLS by removing dangerous `anon ALL` policies. Add `ModuleRoute` guard, shared pagination hook, unified lookups RPC, and atomic mutation template.

**Tech Stack:** React 18 + React Router 6 + TanStack Query + Supabase (PostgreSQL + Auth) + Tailwind CSS

**Constraint:** ZERO visual changes. Every page must render identically before and after.

---

## Current State (Diagnosis)

### RLS: 28 anon policies with `qual: true` = open to the world
Tables exposed to unauthenticated users (anon ALL true):
- `apr_aprovacoes`, `cmp_anexos`, `cmp_categorias`, `cmp_compradores`
- `cmp_cotacao_fornecedores`, `cmp_cotacoes`, `cmp_historico_status`
- `cmp_pedidos`, `cmp_requisicao_itens`, `cmp_requisicoes`
- `n8n_chat_histories`, `sys_obras`, `sys_whatsapp_log`

Tables with RLS DISABLED: `apr_alcadas`, `sys_configuracoes`

Duplicate policies on 14+ tables (e.g., `anexos_anon` + `anon_full_cmp_anexos`).

### Frontend: 7 layouts with ~3500 lines of duplicated code
Files: `FinanceiroLayout.tsx` (206L), `EstoqueLayout.tsx` (204L), `FrotasLayout.tsx` (147L), `LogisticaLayout.tsx` (205L), `RHLayout.tsx` (156L), `ContratosLayout.tsx` (203L), `CadastrosLayout.tsx` (237L), `FiscalLayout.tsx` (202L), `Layout.tsx` (270L)

### No ModuleRoute: `hasModule()` exists but zero routes use it
### No pagination hook: each module will reinvent
### No atomic RPC pattern: mutations are multi-step JS calls

---

## Task 1: RLS Helper Functions

**Files:**
- Supabase migration (via MCP apply_migration)

**Step 1: Create role-checking helper functions**

These functions let RLS policies check user role without repeating queries:

```sql
-- Helper: get current user's role from sys_perfis
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM sys_perfis WHERE auth_id = auth.uid() AND ativo = true),
    'visitante'
  );
$$;

-- Helper: check if user has at least a certain role level
CREATE OR REPLACE FUNCTION auth.at_least(required_role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT CASE auth.user_role()
    WHEN 'admin'        THEN 5
    WHEN 'gerente'      THEN 4
    WHEN 'aprovador'    THEN 3
    WHEN 'comprador'    THEN 2
    WHEN 'requisitante' THEN 1
    ELSE 0
  END >= CASE required_role
    WHEN 'admin'        THEN 5
    WHEN 'gerente'      THEN 4
    WHEN 'aprovador'    THEN 3
    WHEN 'comprador'    THEN 2
    WHEN 'requisitante' THEN 1
    ELSE 0
  END;
$$;
```

**Step 2: Verify helpers work**

```sql
-- Should return 'visitante' when called without auth context (from SQL editor using service_role)
SELECT auth.user_role();
SELECT auth.at_least('requisitante');
```

**Step 3: Commit migration**

---

## Task 2: RLS Migration — Drop Dangerous Policies

**Files:**
- Supabase migration (via MCP apply_migration)

**Strategy:**
- DROP all `anon ALL` policies on business tables
- DROP all duplicate policies
- KEEP narrowed anon policies where needed (external approval, auto-provisioning)
- Enable RLS on `apr_alcadas` and `sys_configuracoes`

**Step 1: Drop all dangerous anon policies**

```sql
-- ═══ COMPRAS MODULE ═══
DROP POLICY IF EXISTS "anon_full_cmp_anexos" ON cmp_anexos;
DROP POLICY IF EXISTS "anexos_anon" ON cmp_anexos;
DROP POLICY IF EXISTS "anon_full_cmp_categorias" ON cmp_categorias;
DROP POLICY IF EXISTS "anon_full_cmp_compradores" ON cmp_compradores;
DROP POLICY IF EXISTS "anon_full_cmp_cotacao_fornecedores" ON cmp_cotacao_fornecedores;
DROP POLICY IF EXISTS "anon_insert_cmp_fornecedores" ON cmp_cotacao_fornecedores;
DROP POLICY IF EXISTS "anon_read_cmp_fornecedores" ON cmp_cotacao_fornecedores;
DROP POLICY IF EXISTS "anon_full_cmp_cotacoes" ON cmp_cotacoes;
DROP POLICY IF EXISTS "anon_full_cmp_historico_status" ON cmp_historico_status;
DROP POLICY IF EXISTS "historico_anon" ON cmp_historico_status;
DROP POLICY IF EXISTS "anon_full_cmp_pedidos" ON cmp_pedidos;
DROP POLICY IF EXISTS "pedidos_anon_all" ON cmp_pedidos;
DROP POLICY IF EXISTS "anon_full_cmp_requisicao_itens" ON cmp_requisicao_itens;
DROP POLICY IF EXISTS "anon_full_cmp_requisicoes" ON cmp_requisicoes;

-- ═══ APROVACOES ═══
-- DROP the blanket anon ALL, KEEP service_role
DROP POLICY IF EXISTS "anon_full_apr_aprovacoes" ON apr_aprovacoes;
-- Also drop duplicate auth policy
DROP POLICY IF EXISTS "auth_all_apr_aprovacoes" ON apr_aprovacoes;

-- ═══ SYSTEM TABLES ═══
DROP POLICY IF EXISTS "anon_full_sys_obras" ON sys_obras;
DROP POLICY IF EXISTS "anon_full_sys_whatsapp_log" ON sys_whatsapp_log;
DROP POLICY IF EXISTS "anon_full_n8n_chat_histories" ON n8n_chat_histories;

-- ═══ DUPLICATES ON COMPRAS ═══
-- cmp_requisicoes has auth_full + auth_all (duplicate)
DROP POLICY IF EXISTS "auth_all_cmp_requisicoes" ON cmp_requisicoes;
-- cmp_anexos has anexos_auth + auth_full (duplicate)
DROP POLICY IF EXISTS "anexos_auth" ON cmp_anexos;
-- cmp_historico_status has historico_auth + auth_full (duplicate)
DROP POLICY IF EXISTS "historico_auth" ON cmp_historico_status;
-- cmp_pedidos has pedidos_auth_all + auth_full (duplicate)
DROP POLICY IF EXISTS "pedidos_auth_all" ON cmp_pedidos;
```

**Step 2: Enable RLS on unprotected tables**

```sql
ALTER TABLE apr_alcadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_configuracoes ENABLE ROW LEVEL SECURITY;

-- apr_alcadas: read-only for authenticated, full for service_role
CREATE POLICY "alcadas_read" ON apr_alcadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "alcadas_service" ON apr_alcadas FOR ALL TO service_role USING (true);

-- sys_configuracoes: read for authenticated, write for admin
CREATE POLICY "config_read" ON sys_configuracoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_admin_write" ON sys_configuracoes FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "config_service" ON sys_configuracoes FOR ALL TO service_role USING (true);
```

**Step 3: Add narrowed anon policy for external approval**

```sql
-- External approval flow: anon can SELECT/UPDATE aprovacoes by token only
CREATE POLICY "anon_approval_by_token" ON apr_aprovacoes
  FOR SELECT TO anon
  USING (token IS NOT NULL AND token != '');

CREATE POLICY "anon_approval_update_by_token" ON apr_aprovacoes
  FOR UPDATE TO anon
  USING (token IS NOT NULL AND token != '')
  WITH CHECK (token IS NOT NULL AND token != '');
```

**Step 4: Add missing authenticated policies for tables that lost their only policy**

```sql
-- sys_obras: was relying on anon policy, needs authenticated
CREATE POLICY "obras_auth_read" ON sys_obras FOR SELECT TO authenticated USING (true);
CREATE POLICY "obras_auth_write" ON sys_obras FOR ALL TO authenticated USING (auth.at_least('gerente'));

-- n8n_chat_histories: authenticated only
CREATE POLICY "chat_auth_all" ON n8n_chat_histories FOR ALL TO authenticated USING (true);

-- sys_whatsapp_log: authenticated read, service write
CREATE POLICY "whatsapp_auth_read" ON sys_whatsapp_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "whatsapp_service_write" ON sys_whatsapp_log FOR ALL TO service_role USING (true);

-- cmp_categorias: authenticated all (lookup table)
CREATE POLICY "categorias_auth_all" ON cmp_categorias FOR ALL TO authenticated USING (true);

-- cmp_compradores: authenticated all
CREATE POLICY "compradores_auth_all" ON cmp_compradores FOR ALL TO authenticated USING (true);

-- cmp_cotacoes: needs service_role (already exists) + authenticated
-- auth_full_cmp_cotacoes already exists, keep it

-- cmp_cotacao_fornecedores: authenticated already has auth_full, keep it
-- Add narrowed anon for external supplier quoting
CREATE POLICY "cotforn_anon_read" ON cmp_cotacao_fornecedores
  FOR SELECT TO anon USING (true);
CREATE POLICY "cotforn_anon_insert" ON cmp_cotacao_fornecedores
  FOR INSERT TO anon WITH CHECK (true);
```

**Step 5: Verify — count policies per role**

```sql
SELECT
  roles::text,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY roles::text
ORDER BY policy_count DESC;
```

Expected: `anon` count drops from 28 to ~6 (only approval, cache, convites, perfis auto-provision, external supplier).

**Step 6: Commit migration**

---

## Task 3: Lookup RPC + useLookups Hook

**Files:**
- Create: `frontend/src/hooks/useLookups.ts`
- Supabase migration (RPC)

**Step 1: Create RPC get_lookups**

```sql
CREATE OR REPLACE FUNCTION get_lookups()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'obras', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'codigo', codigo, 'ativa', ativa))
      FROM sys_obras WHERE ativa = true ORDER BY nome
    ), '[]'::jsonb),
    'centros_custo', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'codigo', codigo, 'ativo', ativo))
      FROM sys_centros_custo WHERE ativo = true ORDER BY nome
    ), '[]'::jsonb),
    'classes_financeiras', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'codigo', codigo))
      FROM fin_classes_financeiras ORDER BY nome
    ), '[]'::jsonb),
    'categorias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'nome', nome))
      FROM cmp_categorias ORDER BY nome
    ), '[]'::jsonb),
    'empresas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'razao_social', razao_social, 'nome_fantasia', nome_fantasia, 'cnpj', cnpj))
      FROM sys_empresas WHERE ativa = true ORDER BY razao_social
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END $$;
```

**Step 2: Create useLookups hook**

```typescript
// frontend/src/hooks/useLookups.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export interface Lookups {
  obras: Array<{ id: string; nome: string; codigo: string; ativa: boolean }>
  centros_custo: Array<{ id: string; nome: string; codigo: string; ativo: boolean }>
  classes_financeiras: Array<{ id: string; nome: string; codigo: string }>
  categorias: Array<{ id: string; nome: string }>
  empresas: Array<{ id: string; razao_social: string; nome_fantasia: string; cnpj: string }>
}

const EMPTY: Lookups = {
  obras: [], centros_custo: [], classes_financeiras: [],
  categorias: [], empresas: [],
}

export function useLookups() {
  return useQuery<Lookups>({
    queryKey: ['lookups'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_lookups')
      if (error) return EMPTY
      return (data ?? EMPTY) as Lookups
    },
    staleTime: 10 * 60 * 1000, // 10 min cache
    gcTime: 30 * 60 * 1000,
  })
}

// Convenience selectors
export function useLookupObras() {
  const { data } = useLookups()
  return data?.obras ?? []
}

export function useLookupCentrosCusto() {
  const { data } = useLookups()
  return data?.centros_custo ?? []
}

export function useLookupClassesFinanceiras() {
  const { data } = useLookups()
  return data?.classes_financeiras ?? []
}
```

**Step 3: Verify build**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

---

## Task 4: ModuleLayout Generic Component

**Files:**
- Create: `frontend/src/components/ModuleLayout.tsx`

This is the core refactoring. The component must produce IDENTICAL HTML/CSS output for each module.

**Step 1: Create ModuleLayout.tsx**

The component accepts configuration props and renders the exact same structure as the current layouts. Two variants: `full` (lg breakpoint, sidebar + bottom nav) and `compact` (md breakpoint, drawer).

```typescript
// frontend/src/components/ModuleLayout.tsx
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutGrid, LogOut, Shield, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from './LogoTeg'
import ThemeToggle from './ThemeToggle'

// ── Types ────────────────────────────────────────────────────────────────────

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
  adminOnly?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export interface ModuleConfig {
  moduleKey: string
  moduleName: string
  moduleEmoji: string
  accent: string            // tailwind color token: 'teal' | 'emerald' | 'blue' | etc.
  nav: NavItem[]
  navSections?: NavSection[]  // if set, renders grouped nav on desktop
  mobileNav?: NavItem[]       // override for mobile bottom nav (defaults to first 6 of nav)
  variant?: 'full' | 'compact'  // full = lg sidebar + bottom nav, compact = md drawer
  showCadastrosLink?: boolean   // default true
  showAdminLink?: boolean       // default false
  showUserCard?: boolean        // default true
  maxWidth?: string             // default 'max-w-5xl'
  sidebarWidth?: string         // default 'w-64'
  moduleSubtitle?: string       // default 'Modulo ativo'
  backRoute?: string            // default '/'
}

// ── Avatar helpers (shared, extracted once) ──────────────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-cyan-500',
  'bg-teal-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
]

function getAvatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Accent color class generators ────────────────────────────────────────────
// Tailwind needs full class names (no dynamic concat), so we map from token

const ACCENT_CLASSES: Record<string, {
  badgeBgLight: string; badgeBorderLight: string; badgeHoverBgLight: string; badgeHoverBorderLight: string;
  badgeBgDark: string; badgeBorderDark: string; badgeHoverBgDark: string; badgeHoverBorderDark: string;
  textLight: string; textDark: string; subtextLight: string; subtextDark: string;
  gridLight: string; gridHoverLight: string; gridDark: string; gridHoverDark: string;
  activeBgLight: string; activeTextLight: string; activeBorderLight: string;
  activeBgDark: string; activeTextDark: string; activeBorderDark: string;
  mobileActiveTextLight: string; mobileActiveBgLight: string;
  mobileActiveTextDark: string; mobileActiveBgDark: string;
}> = {
  teal: {
    badgeBgLight: 'bg-teal-50', badgeBorderLight: 'border-teal-200',
    badgeHoverBgLight: 'hover:bg-teal-100', badgeHoverBorderLight: 'hover:border-teal-300',
    badgeBgDark: 'bg-teal-500/10', badgeBorderDark: 'border-teal-500/25',
    badgeHoverBgDark: 'hover:bg-teal-500/18', badgeHoverBorderDark: 'hover:border-teal-500/40',
    textLight: 'text-teal-700', textDark: 'text-teal-300',
    subtextLight: 'text-teal-500/60', subtextDark: 'text-teal-500/60',
    gridLight: 'text-teal-400', gridHoverLight: 'group-hover:text-teal-500',
    gridDark: 'text-teal-500/50', gridHoverDark: 'group-hover:text-teal-400',
    activeBgLight: 'bg-teal-50', activeTextLight: 'text-teal-700', activeBorderLight: 'border-teal-200',
    activeBgDark: 'bg-teal-500/15', activeTextDark: 'text-teal-300', activeBorderDark: 'border-teal-500/25',
    mobileActiveTextLight: 'text-teal-600', mobileActiveBgLight: 'bg-teal-50',
    mobileActiveTextDark: 'text-teal-400', mobileActiveBgDark: 'bg-teal-400/10',
  },
  emerald: {
    badgeBgLight: 'bg-emerald-50', badgeBorderLight: 'border-emerald-200',
    badgeHoverBgLight: 'hover:bg-emerald-100', badgeHoverBorderLight: 'hover:border-emerald-300',
    badgeBgDark: 'bg-emerald-500/10', badgeBorderDark: 'border-emerald-500/25',
    badgeHoverBgDark: 'hover:bg-emerald-500/18', badgeHoverBorderDark: 'hover:border-emerald-500/40',
    textLight: 'text-emerald-700', textDark: 'text-emerald-300',
    subtextLight: 'text-emerald-500/60', subtextDark: 'text-emerald-500/60',
    gridLight: 'text-emerald-400', gridHoverLight: 'group-hover:text-emerald-500',
    gridDark: 'text-emerald-500/50', gridHoverDark: 'group-hover:text-emerald-400',
    activeBgLight: 'bg-emerald-50', activeTextLight: 'text-emerald-700', activeBorderLight: 'border-emerald-200',
    activeBgDark: 'bg-emerald-500/15', activeTextDark: 'text-emerald-300', activeBorderDark: 'border-emerald-500/25',
    mobileActiveTextLight: 'text-emerald-600', mobileActiveBgLight: 'bg-emerald-50',
    mobileActiveTextDark: 'text-emerald-400', mobileActiveBgDark: 'bg-emerald-400/10',
  },
  blue: {
    badgeBgLight: 'bg-blue-50', badgeBorderLight: 'border-blue-200',
    badgeHoverBgLight: 'hover:bg-blue-100', badgeHoverBorderLight: 'hover:border-blue-300',
    badgeBgDark: 'bg-blue-500/10', badgeBorderDark: 'border-blue-500/25',
    badgeHoverBgDark: 'hover:bg-blue-500/18', badgeHoverBorderDark: 'hover:border-blue-500/40',
    textLight: 'text-blue-700', textDark: 'text-blue-300',
    subtextLight: 'text-blue-500/60', subtextDark: 'text-blue-500/60',
    gridLight: 'text-blue-400', gridHoverLight: 'group-hover:text-blue-500',
    gridDark: 'text-blue-500/50', gridHoverDark: 'group-hover:text-blue-400',
    activeBgLight: 'bg-blue-50', activeTextLight: 'text-blue-700', activeBorderLight: 'border-blue-200',
    activeBgDark: 'bg-blue-500/15', activeTextDark: 'text-blue-300', activeBorderDark: 'border-blue-500/25',
    mobileActiveTextLight: 'text-blue-600', mobileActiveBgLight: 'bg-blue-50',
    mobileActiveTextDark: 'text-blue-400', mobileActiveBgDark: 'bg-blue-400/10',
  },
  orange: {
    badgeBgLight: 'bg-orange-50', badgeBorderLight: 'border-orange-200',
    badgeHoverBgLight: 'hover:bg-orange-100', badgeHoverBorderLight: 'hover:border-orange-300',
    badgeBgDark: 'bg-orange-500/10', badgeBorderDark: 'border-orange-500/25',
    badgeHoverBgDark: 'hover:bg-orange-500/18', badgeHoverBorderDark: 'hover:border-orange-500/40',
    textLight: 'text-orange-700', textDark: 'text-orange-300',
    subtextLight: 'text-orange-500/60', subtextDark: 'text-orange-500/60',
    gridLight: 'text-orange-400', gridHoverLight: 'group-hover:text-orange-500',
    gridDark: 'text-orange-500/50', gridHoverDark: 'group-hover:text-orange-400',
    activeBgLight: 'bg-orange-50', activeTextLight: 'text-orange-700', activeBorderLight: 'border-orange-200',
    activeBgDark: 'bg-orange-500/15', activeTextDark: 'text-orange-300', activeBorderDark: 'border-orange-500/25',
    mobileActiveTextLight: 'text-orange-600', mobileActiveBgLight: 'bg-orange-50',
    mobileActiveTextDark: 'text-orange-400', mobileActiveBgDark: 'bg-orange-400/10',
  },
  violet: {
    badgeBgLight: 'bg-violet-50', badgeBorderLight: 'border-violet-200',
    badgeHoverBgLight: 'hover:bg-violet-100', badgeHoverBorderLight: 'hover:border-violet-300',
    badgeBgDark: 'bg-violet-500/10', badgeBorderDark: 'border-violet-500/25',
    badgeHoverBgDark: 'hover:bg-violet-500/18', badgeHoverBorderDark: 'hover:border-violet-500/40',
    textLight: 'text-violet-700', textDark: 'text-violet-300',
    subtextLight: 'text-violet-500/60', subtextDark: 'text-violet-500/60',
    gridLight: 'text-violet-400', gridHoverLight: 'group-hover:text-violet-500',
    gridDark: 'text-violet-500/50', gridHoverDark: 'group-hover:text-violet-400',
    activeBgLight: 'bg-violet-50', activeTextLight: 'text-violet-700', activeBorderLight: 'border-violet-200',
    activeBgDark: 'bg-violet-500/15', activeTextDark: 'text-violet-300', activeBorderDark: 'border-violet-500/25',
    mobileActiveTextLight: 'text-violet-600', mobileActiveBgLight: 'bg-violet-50',
    mobileActiveTextDark: 'text-violet-400', mobileActiveBgDark: 'bg-violet-400/10',
  },
  indigo: {
    badgeBgLight: 'bg-indigo-50', badgeBorderLight: 'border-indigo-200',
    badgeHoverBgLight: 'hover:bg-indigo-100', badgeHoverBorderLight: 'hover:border-indigo-300',
    badgeBgDark: 'bg-indigo-500/10', badgeBorderDark: 'border-indigo-500/25',
    badgeHoverBgDark: 'hover:bg-indigo-500/18', badgeHoverBorderDark: 'hover:border-indigo-500/40',
    textLight: 'text-indigo-700', textDark: 'text-indigo-300',
    subtextLight: 'text-indigo-500/60', subtextDark: 'text-indigo-500/60',
    gridLight: 'text-indigo-400', gridHoverLight: 'group-hover:text-indigo-500',
    gridDark: 'text-indigo-500/50', gridHoverDark: 'group-hover:text-indigo-400',
    activeBgLight: 'bg-indigo-50', activeTextLight: 'text-indigo-700', activeBorderLight: 'border-indigo-200',
    activeBgDark: 'bg-indigo-500/15', activeTextDark: 'text-indigo-300', activeBorderDark: 'border-indigo-500/25',
    mobileActiveTextLight: 'text-indigo-600', mobileActiveBgLight: 'bg-indigo-50',
    mobileActiveTextDark: 'text-indigo-400', mobileActiveBgDark: 'bg-indigo-400/10',
  },
  amber: {
    badgeBgLight: 'bg-amber-50', badgeBorderLight: 'border-amber-200',
    badgeHoverBgLight: 'hover:bg-amber-100', badgeHoverBorderLight: 'hover:border-amber-300',
    badgeBgDark: 'bg-amber-500/10', badgeBorderDark: 'border-amber-500/25',
    badgeHoverBgDark: 'hover:bg-amber-500/18', badgeHoverBorderDark: 'hover:border-amber-500/40',
    textLight: 'text-amber-700', textDark: 'text-amber-300',
    subtextLight: 'text-amber-500/60', subtextDark: 'text-amber-500/60',
    gridLight: 'text-amber-400', gridHoverLight: 'group-hover:text-amber-500',
    gridDark: 'text-amber-500/50', gridHoverDark: 'group-hover:text-amber-400',
    activeBgLight: 'bg-amber-50', activeTextLight: 'text-amber-700', activeBorderLight: 'border-amber-200',
    activeBgDark: 'bg-amber-500/15', activeTextDark: 'text-amber-300', activeBorderDark: 'border-amber-500/25',
    mobileActiveTextLight: 'text-amber-600', mobileActiveBgLight: 'bg-amber-50',
    mobileActiveTextDark: 'text-amber-400', mobileActiveBgDark: 'bg-amber-400/10',
  },
  rose: {
    badgeBgLight: 'bg-rose-50', badgeBorderLight: 'border-rose-200',
    badgeHoverBgLight: 'hover:bg-rose-100', badgeHoverBorderLight: 'hover:border-rose-300',
    badgeBgDark: 'bg-rose-500/10', badgeBorderDark: 'border-rose-500/25',
    badgeHoverBgDark: 'hover:bg-rose-500/18', badgeHoverBorderDark: 'hover:border-rose-500/40',
    textLight: 'text-rose-700', textDark: 'text-rose-300',
    subtextLight: 'text-rose-500/60', subtextDark: 'text-rose-500/60',
    gridLight: 'text-rose-400', gridHoverLight: 'group-hover:text-rose-500',
    gridDark: 'text-rose-500/50', gridHoverDark: 'group-hover:text-rose-400',
    activeBgLight: 'bg-rose-50', activeTextLight: 'text-rose-700', activeBorderLight: 'border-rose-200',
    activeBgDark: 'bg-rose-500/15', activeTextDark: 'text-rose-300', activeBorderDark: 'border-rose-500/25',
    mobileActiveTextLight: 'text-rose-600', mobileActiveBgLight: 'bg-rose-50',
    mobileActiveTextDark: 'text-rose-400', mobileActiveBgDark: 'bg-rose-400/10',
  },
}

export default function ModuleLayout(config: ModuleConfig) {
  // ... full implementation that renders the exact same HTML
  // See implementation in Task 4 execution
}
```

The full component renders:
1. Desktop sidebar (hidden on mobile) — logo, module badge, nav items, cadastros link, theme toggle, user card
2. Mobile header (hidden on desktop) — logo, module name, avatar, logout
3. Main content with `<Outlet />`
4. Mobile bottom nav (hidden on desktop)

Each section uses `ACCENT_CLASSES[config.accent]` for color tokens, producing identical output to current layouts.

**Step 2: Verify build compiles**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

---

## Task 5: Refactor All Layouts to Thin Wrappers

**Files:**
- Modify: `frontend/src/components/FinanceiroLayout.tsx`
- Modify: `frontend/src/components/EstoqueLayout.tsx`
- Modify: `frontend/src/components/LogisticaLayout.tsx`
- Modify: `frontend/src/components/ContratosLayout.tsx`
- Modify: `frontend/src/components/FiscalLayout.tsx`
- Modify: `frontend/src/components/FrotasLayout.tsx`
- Modify: `frontend/src/components/RHLayout.tsx`
- Modify: `frontend/src/components/CadastrosLayout.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Strategy:** Replace each 150-270 line file with a 15-30 line wrapper that passes config to `ModuleLayout`. Do ONE layout at a time, build-verify between each.

**Step 1: Refactor FinanceiroLayout.tsx**

```typescript
import {
  LayoutDashboard, Receipt, DollarSign, FileCheck2,
  Landmark, BarChart3, Settings,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/financeiro',                icon: LayoutDashboard, label: 'Painel',          end: true  },
  { to: '/financeiro/cp',             icon: Receipt,         label: 'Contas a Pagar',  end: false },
  { to: '/financeiro/cr',             icon: DollarSign,      label: 'A Receber',       end: false },
  { to: '/financeiro/aprovacoes',     icon: FileCheck2,      label: 'Aprovações',      end: false },
  { to: '/financeiro/conciliacao',    icon: Landmark,        label: 'Conciliação',     end: false },
  { to: '/financeiro/relatorios',     icon: BarChart3,       label: 'Relatórios',      end: false },
  { to: '/financeiro/configuracoes',  icon: Settings,        label: 'Configurações',   end: false },
]

export default function FinanceiroLayout() {
  return (
    <ModuleLayout
      moduleKey="financeiro"
      moduleName="Financeiro"
      moduleEmoji="💰"
      accent="emerald"
      nav={NAV}
    />
  )
}
```

**Step 2: Build verify**

```bash
cd frontend && npm run build
```

**Step 3: Repeat for each layout** (same pattern, just different NAV + config)

Each layout becomes a thin wrapper: icon imports + NAV definition + ModuleLayout call.

Special cases:
- **CadastrosLayout**: Uses `navSections` instead of flat `nav`, custom `mobileNav`, `backRoute: undefined` (navigate(-1))
- **FrotasLayout**: `variant: 'compact'`, `showUserCard: false`, `sidebarWidth: 'w-56'`
- **RHLayout**: `variant: 'compact'`, NAV items have `adminOnly: true`
- **Layout.tsx (Compras)**: `showAdminLink: true`, `maxWidth: 'max-w-4xl'`

**Step 4: Build verify after all layouts are refactored**

**Step 5: Commit**

```
refactor: replace 9 duplicated layouts with ModuleLayout wrapper (~3500 lines → ~300 lines)
```

---

## Task 6: ModuleRoute Guard Component

**Files:**
- Create: `frontend/src/components/ModuleRoute.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create ModuleRoute.tsx**

```typescript
// frontend/src/components/ModuleRoute.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  moduleKey: string
  children?: React.ReactNode
}

export default function ModuleRoute({ moduleKey, children }: Props) {
  const { isAdmin, hasModule, perfilReady, perfil } = useAuth()

  // Wait for profile to load
  if (!perfilReady || !perfil) return null

  // Admins always have access
  if (isAdmin) return children ? <>{children}</> : <Outlet />

  // Check module permission
  if (!hasModule(moduleKey)) {
    return <Navigate to="/" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
```

**Step 2: Wrap module routes in App.tsx**

```tsx
// Before:
<Route element={<FinanceiroLayout />}>
  <Route path="/financeiro" element={<DashboardFinanceiro />} />
  ...
</Route>

// After:
<Route element={<ModuleRoute moduleKey="financeiro" />}>
  <Route element={<FinanceiroLayout />}>
    <Route path="/financeiro" element={<DashboardFinanceiro />} />
    ...
  </Route>
</Route>
```

Apply to all modules: financeiro, fiscal, estoque, logistica, frotas, rh, contratos, compras.
Cadastros remains unguarded (accessible to all authenticated users).

**Step 3: Build verify**

**Step 4: Commit**

---

## Task 7: usePagination Hook

**Files:**
- Create: `frontend/src/hooks/usePagination.ts`

**Step 1: Create the hook**

```typescript
// frontend/src/hooks/usePagination.ts
import { useState, useMemo, useCallback } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  from: number       // for supabase .range(from, to)
  to: number
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  nextPage: () => void
  prevPage: () => void
  totalPages: number
  setTotalCount: (n: number) => void
  totalCount: number
  hasNext: boolean
  hasPrev: boolean
}

export function usePagination(initialPageSize = 50): PaginationState {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [totalCount, setTotalCount] = useState(0)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize],
  )

  const hasNext = page < totalPages
  const hasPrev = page > 1

  const nextPage = useCallback(() => {
    setPage(p => Math.min(p + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setPage(p => Math.max(p - 1, 1))
  }, [])

  return {
    page, pageSize, from, to,
    setPage, setPageSize, nextPage, prevPage,
    totalPages, totalCount, setTotalCount,
    hasNext, hasPrev,
  }
}
```

**Step 2: Build verify**

**Step 3: Commit**

---

## Task 8: Atomic Mutation RPC Template

**Files:**
- Supabase migration (via MCP apply_migration)

**Step 1: Create template RPC**

This creates the pattern that all future transactional mutations will follow. First real use case: `rpc_emitir_pedido` (already partially exists as trigger `criar_cp_ao_emitir_pedido`).

```sql
-- Template: Atomic mutation pattern
-- Every transactional business operation should follow this pattern:
-- 1. SECURITY DEFINER (bypasses RLS, runs as owner)
-- 2. Returns jsonb { success, data, error }
-- 3. Uses EXCEPTION block for rollback
-- 4. Logs the operation

CREATE OR REPLACE FUNCTION rpc_template_atomic(
  p_param1 uuid,
  p_param2 text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result jsonb;
  v_user_id uuid := auth.uid();
BEGIN
  -- Validate
  IF p_param1 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'param1 is required');
  END IF;

  -- Execute multiple operations atomically
  -- (all succeed or all rollback)

  -- Operation 1: ...
  -- Operation 2: ...
  -- Operation 3: log

  v_result := jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('id', p_param1)
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END $$;
```

**Step 2: Create first real atomic RPC — classificar_lote**

Replaces the JavaScript-side batch classification that currently does N individual updates:

```sql
CREATE OR REPLACE FUNCTION rpc_classificar_cp_lote(
  p_ids uuid[],
  p_centro_custo text DEFAULT NULL,
  p_classe_financeira text DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  IF array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhum ID fornecido');
  END IF;

  UPDATE fin_contas_pagar
  SET
    centro_custo = COALESCE(p_centro_custo, centro_custo),
    classe_financeira = COALESCE(p_classe_financeira, classe_financeira),
    projeto_id = COALESCE(p_projeto_id, projeto_id),
    updated_at = now()
  WHERE id = ANY(p_ids);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object('updated', v_count)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;
```

**Step 3: Commit**

---

## Task 9: Final Verification

**Step 1: Full build**
```bash
cd frontend && npm run build
```
Expected: 0 errors

**Step 2: Verify Supabase RLS**
```sql
-- Should return ~6 anon policies (down from 28)
SELECT COUNT(*) FROM pg_policies
WHERE schemaname='public' AND roles::text LIKE '%anon%';

-- Should return 0 tables with RLS disabled
SELECT COUNT(*) FROM pg_tables
WHERE schemaname='public' AND NOT rowsecurity;
```

**Step 3: Verify get_lookups RPC works**
```sql
SELECT get_lookups();
```

**Step 4: Verify auth.user_role() and auth.at_least() exist**
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'auth' AND routine_name IN ('user_role', 'at_least');
```

**Step 5: Commit everything, push branch**

```bash
git push -u origin feat/foundation-phase1
```

---

## Execution Order Summary

| # | Task | Type | Risk |
|---|------|------|------|
| 1 | RLS helper functions | SQL migration | Low |
| 2 | Drop dangerous anon policies + enable RLS | SQL migration | Medium (test external approval) |
| 3 | Lookup RPC + useLookups hook | SQL + TypeScript | Low |
| 4 | ModuleLayout generic component | TypeScript (new file) | Low (additive) |
| 5 | Refactor all 9 layouts to wrappers | TypeScript (modify) | Medium (visual regression risk) |
| 6 | ModuleRoute guard + App.tsx | TypeScript | Low |
| 7 | usePagination hook | TypeScript (new file) | Low (additive) |
| 8 | Atomic RPC template + classificar_lote | SQL | Low |
| 9 | Final verification | Build + SQL checks | None |

**Total estimated files changed:** 12 modified, 4 created
**Total estimated lines:** ~3500 lines removed (layout duplication), ~600 lines added (new components + hooks), ~200 lines SQL
