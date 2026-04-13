# Tesouraria Cockpit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Treasury cockpit page with bank accounts, cash flow chart, auto-movements from CP/CR, OFX import, and aging — single-page "Bloomberg terminal" layout.

**Architecture:** New Supabase tables (fin_contas_bancarias, fin_movimentacoes_tesouraria, fin_extratos_import) + DB triggers on CP/CR payment + RPC for dashboard aggregation + Recharts area chart + single-page cockpit React component.

**Tech Stack:** React 18 + TypeScript + Tailwind + Recharts (new) + Supabase RPC + TanStack Query v5

---

## Task 1: Install Recharts

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install recharts**

Run: `cd /c/teg-plus/frontend && npm install recharts`

**Step 2: Verify installation**

Run: `cat package.json | grep recharts`
Expected: `"recharts": "^2.x.x"`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install recharts for Tesouraria charts"
```

---

## Task 2: Database Migration — Tables + Triggers + RPC

**Files:**
- Create: `supabase/050_tesouraria.sql` (migration number may vary — check latest)

**Step 1: Write migration SQL**

```sql
-- =============================================
-- TESOURARIA — Contas Bancarias, Movimentacoes, Import
-- =============================================

-- 1. Contas Bancarias
CREATE TABLE IF NOT EXISTS fin_contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  banco_codigo TEXT,
  banco_nome TEXT,
  agencia TEXT,
  conta TEXT,
  tipo TEXT NOT NULL DEFAULT 'corrente'
    CHECK (tipo IN ('corrente', 'poupanca', 'investimento')),
  saldo_atual NUMERIC NOT NULL DEFAULT 0,
  saldo_atualizado_em TIMESTAMPTZ DEFAULT now(),
  cor TEXT DEFAULT '#0d9488',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. Movimentacoes
CREATE TABLE IF NOT EXISTS fin_movimentacoes_tesouraria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES fin_contas_bancarias(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'transferencia')),
  valor NUMERIC NOT NULL,
  data_movimentacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_competencia DATE,
  descricao TEXT,
  categoria TEXT DEFAULT 'outros'
    CHECK (categoria IN (
      'pagamento_fornecedor', 'recebimento_cliente', 'transferencia',
      'taxa_bancaria', 'rendimento', 'imposto', 'folha', 'outros'
    )),
  cp_id UUID REFERENCES fin_contas_pagar(id),
  cr_id UUID REFERENCES fin_contas_receber(id),
  conciliado BOOLEAN NOT NULL DEFAULT false,
  conciliado_em TIMESTAMPTZ,
  origem TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'import_ofx', 'import_csv', 'auto_cp', 'auto_cr')),
  hash_import TEXT UNIQUE,
  criado_em TIMESTAMPTZ DEFAULT now(),
  criado_por UUID
);

CREATE INDEX idx_mov_tes_conta ON fin_movimentacoes_tesouraria(conta_id);
CREATE INDEX idx_mov_tes_data ON fin_movimentacoes_tesouraria(data_movimentacao);
CREATE INDEX idx_mov_tes_tipo ON fin_movimentacoes_tesouraria(tipo);
CREATE INDEX idx_mov_tes_cp ON fin_movimentacoes_tesouraria(cp_id) WHERE cp_id IS NOT NULL;
CREATE INDEX idx_mov_tes_cr ON fin_movimentacoes_tesouraria(cr_id) WHERE cr_id IS NOT NULL;

-- 3. Extratos Import
CREATE TABLE IF NOT EXISTS fin_extratos_import (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES fin_contas_bancarias(id),
  arquivo_url TEXT,
  nome_arquivo TEXT,
  formato TEXT CHECK (formato IN ('ofx', 'csv')),
  periodo_inicio DATE,
  periodo_fim DATE,
  total_registros INT DEFAULT 0,
  importados INT DEFAULT 0,
  duplicados INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processando'
    CHECK (status IN ('processando', 'concluido', 'erro')),
  importado_em TIMESTAMPTZ DEFAULT now(),
  importado_por UUID
);

-- 4. RLS
ALTER TABLE fin_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_movimentacoes_tesouraria ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_extratos_import ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_contas_bancarias_read" ON fin_contas_bancarias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_contas_bancarias_write" ON fin_contas_bancarias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "fin_mov_tes_read" ON fin_movimentacoes_tesouraria
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_mov_tes_write" ON fin_movimentacoes_tesouraria
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "fin_extratos_read" ON fin_extratos_import
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fin_extratos_write" ON fin_extratos_import
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. RPC: Dashboard da Tesouraria
CREATE OR REPLACE FUNCTION get_tesouraria_dashboard(p_periodo TEXT DEFAULT '30d')
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_dias INT;
  v_data_inicio DATE;
  v_result JSONB;
BEGIN
  v_dias := CASE p_periodo
    WHEN '7d' THEN 7 WHEN '30d' THEN 30
    WHEN '60d' THEN 60 WHEN '90d' THEN 90
    WHEN '365d' THEN 365 ELSE 30
  END;
  v_data_inicio := CURRENT_DATE - v_dias;

  SELECT jsonb_build_object(
    'saldo_total', COALESCE((SELECT SUM(saldo_atual) FROM fin_contas_bancarias WHERE ativo = true), 0),
    'entradas_periodo', COALESCE((
      SELECT SUM(valor) FROM fin_movimentacoes_tesouraria
      WHERE tipo = 'entrada' AND data_movimentacao >= v_data_inicio
    ), 0),
    'saidas_periodo', COALESCE((
      SELECT SUM(valor) FROM fin_movimentacoes_tesouraria
      WHERE tipo = 'saida' AND data_movimentacao >= v_data_inicio
    ), 0),
    'contas', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'banco_nome', banco_nome,
        'saldo_atual', saldo_atual, 'cor', cor, 'tipo', tipo
      ) ORDER BY saldo_atual DESC)
      FROM fin_contas_bancarias WHERE ativo = true
    ), '[]'::jsonb),
    'movimentacoes_recentes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'tipo', m.tipo, 'valor', m.valor,
        'data_movimentacao', m.data_movimentacao, 'descricao', m.descricao,
        'categoria', m.categoria, 'conta_nome', c.nome, 'conta_cor', c.cor,
        'origem', m.origem, 'conciliado', m.conciliado
      ) ORDER BY m.data_movimentacao DESC, m.criado_em DESC)
      FROM fin_movimentacoes_tesouraria m
      JOIN fin_contas_bancarias c ON c.id = m.conta_id
      WHERE m.data_movimentacao >= v_data_inicio
      LIMIT 50
    ), '[]'::jsonb),
    'fluxo_diario', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'data', d.dia,
        'entradas', COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'entrada'), 0),
        'saidas', COALESCE(SUM(m.valor) FILTER (WHERE m.tipo = 'saida'), 0)
      ) ORDER BY d.dia)
      FROM generate_series(v_data_inicio, CURRENT_DATE, '1 day'::interval) d(dia)
      LEFT JOIN fin_movimentacoes_tesouraria m
        ON m.data_movimentacao = d.dia::date
      GROUP BY d.dia
    ), '[]'::jsonb),
    'previsao_cp', COALESCE((
      SELECT SUM(valor_original - COALESCE(valor_pago, 0))
      FROM fin_contas_pagar
      WHERE status NOT IN ('pago', 'conciliado', 'cancelado')
        AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    ), 0),
    'previsao_cr', COALESCE((
      SELECT SUM(valor_original - COALESCE(valor_recebido, 0))
      FROM fin_contas_receber
      WHERE status NOT IN ('recebido', 'conciliado', 'cancelado')
        AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    ), 0),
    'aging_cp', jsonb_build_object(
      'hoje', COALESCE((SELECT SUM(valor_original) FROM fin_contas_pagar WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento = CURRENT_DATE), 0),
      'd7', COALESCE((SELECT SUM(valor_original) FROM fin_contas_pagar WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7), 0),
      'd30', COALESCE((SELECT SUM(valor_original) FROM fin_contas_pagar WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE + 8 AND CURRENT_DATE + 30), 0),
      'd60', COALESCE((SELECT SUM(valor_original) FROM fin_contas_pagar WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60), 0)
    ),
    'aging_cr', jsonb_build_object(
      'hoje', COALESCE((SELECT SUM(valor_original) FROM fin_contas_receber WHERE status NOT IN ('recebido','conciliado','cancelado') AND data_vencimento = CURRENT_DATE), 0),
      'd7', COALESCE((SELECT SUM(valor_original) FROM fin_contas_receber WHERE status NOT IN ('recebido','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7), 0),
      'd30', COALESCE((SELECT SUM(valor_original) FROM fin_contas_receber WHERE status NOT IN ('recebido','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE + 8 AND CURRENT_DATE + 30), 0),
      'd60', COALESCE((SELECT SUM(valor_original) FROM fin_contas_receber WHERE status NOT IN ('recebido','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE + 31 AND CURRENT_DATE + 60), 0)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 6. RPC: Recalcular saldo de uma conta
CREATE OR REPLACE FUNCTION rpc_recalcular_saldo(p_conta_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_saldo NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE WHEN tipo = 'entrada' THEN valor
         WHEN tipo = 'saida' THEN -valor
         ELSE 0 END
  ), 0)
  INTO v_saldo
  FROM fin_movimentacoes_tesouraria
  WHERE conta_id = p_conta_id;

  UPDATE fin_contas_bancarias
  SET saldo_atual = v_saldo, saldo_atualizado_em = now(), atualizado_em = now()
  WHERE id = p_conta_id;

  RETURN v_saldo;
END;
$$;

-- 7. Trigger: atualizar saldo ao inserir/deletar movimentacao
CREATE OR REPLACE FUNCTION trg_mov_tesouraria_saldo()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM rpc_recalcular_saldo(OLD.conta_id);
    RETURN OLD;
  ELSE
    PERFORM rpc_recalcular_saldo(NEW.conta_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mov_tesouraria_saldo
  AFTER INSERT OR UPDATE OR DELETE ON fin_movimentacoes_tesouraria
  FOR EACH ROW EXECUTE FUNCTION trg_mov_tesouraria_saldo();
```

**Step 2: Apply migration via Supabase MCP**

Use tool: `mcp__402c23fe-4707-49e1-a558-76f47f37d917__apply_migration`
- project_id: uzfjfucrinokeuwpbeie
- name: tesouraria_tables_rpc_triggers
- query: (the SQL above)

**Step 3: Verify tables created**

Use tool: `mcp__402c23fe-4707-49e1-a558-76f47f37d917__execute_sql`
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'fin_%tesou%' OR table_name = 'fin_contas_bancarias' OR table_name = 'fin_extratos_import'
ORDER BY table_name;
```

**Step 4: Commit migration file**

```bash
git add supabase/050_tesouraria.sql
git commit -m "feat(db): add Tesouraria tables, triggers, and RPC functions"
```

---

## Task 3: TypeScript Types

**Files:**
- Modify: `frontend/src/types/financeiro.ts` (add at end)

**Step 1: Add types**

Add at the end of `frontend/src/types/financeiro.ts`:

```typescript
// ── Tesouraria ────────────────────────────────────────────
export interface ContaBancaria {
  id: string
  nome: string
  banco_codigo?: string
  banco_nome?: string
  agencia?: string
  conta?: string
  tipo: 'corrente' | 'poupanca' | 'investimento'
  saldo_atual: number
  saldo_atualizado_em?: string
  cor: string
  ativo: boolean
}

export interface MovimentacaoTesouraria {
  id: string
  conta_id: string
  tipo: 'entrada' | 'saida' | 'transferencia'
  valor: number
  data_movimentacao: string
  data_competencia?: string
  descricao?: string
  categoria: string
  cp_id?: string
  cr_id?: string
  conciliado: boolean
  conciliado_em?: string
  origem: 'manual' | 'import_ofx' | 'import_csv' | 'auto_cp' | 'auto_cr'
  conta_nome?: string
  conta_cor?: string
  criado_em?: string
}

export interface ExtratoImport {
  id: string
  conta_id: string
  arquivo_url?: string
  nome_arquivo?: string
  formato: 'ofx' | 'csv'
  periodo_inicio?: string
  periodo_fim?: string
  total_registros: number
  importados: number
  duplicados: number
  status: 'processando' | 'concluido' | 'erro'
}

export interface TesourariaDashboardData {
  saldo_total: number
  entradas_periodo: number
  saidas_periodo: number
  contas: ContaBancaria[]
  movimentacoes_recentes: MovimentacaoTesouraria[]
  fluxo_diario: Array<{ data: string; entradas: number; saidas: number }>
  previsao_cp: number
  previsao_cr: number
  aging_cp: { hoje: number; d7: number; d30: number; d60: number }
  aging_cr: { hoje: number; d7: number; d30: number; d60: number }
}

export type CategoriaMovimentacao =
  | 'pagamento_fornecedor' | 'recebimento_cliente' | 'transferencia'
  | 'taxa_bancaria' | 'rendimento' | 'imposto' | 'folha' | 'outros'
```

**Step 2: Commit**

```bash
git add frontend/src/types/financeiro.ts
git commit -m "feat(types): add Tesouraria types (ContaBancaria, Movimentacao, Dashboard)"
```

---

## Task 4: Hooks — useTesouraria.ts

**Files:**
- Create: `frontend/src/hooks/useTesouraria.ts`

**Step 1: Write hooks file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type {
  ContaBancaria, MovimentacaoTesouraria, TesourariaDashboardData,
  CategoriaMovimentacao
} from '../types/financeiro'

// ── Dashboard RPC ─────────────────────────────────────────
const EMPTY_DASHBOARD: TesourariaDashboardData = {
  saldo_total: 0, entradas_periodo: 0, saidas_periodo: 0,
  contas: [], movimentacoes_recentes: [], fluxo_diario: [],
  previsao_cp: 0, previsao_cr: 0,
  aging_cp: { hoje: 0, d7: 0, d30: 0, d60: 0 },
  aging_cr: { hoje: 0, d7: 0, d30: 0, d60: 0 },
}

export function useTesourariaDashboard(periodo = '30d') {
  return useQuery<TesourariaDashboardData>({
    queryKey: ['tesouraria-dashboard', periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tesouraria_dashboard', {
        p_periodo: periodo,
      })
      if (error) return EMPTY_DASHBOARD
      return data as TesourariaDashboardData
    },
    refetchInterval: 30_000,
  })
}

// ── Contas Bancarias ──────────────────────────────────────
export function useContasBancarias() {
  return useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_contas_bancarias')
        .select('*')
        .eq('ativo', true)
        .order('saldo_atual', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCriarContaBancaria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (conta: Omit<ContaBancaria, 'id' | 'saldo_atual' | 'saldo_atualizado_em' | 'ativo'>) => {
      const { data, error } = await supabase
        .from('fin_contas_bancarias')
        .insert(conta)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
    },
  })
}

export function useEditarContaBancaria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContaBancaria> & { id: string }) => {
      const { data, error } = await supabase
        .from('fin_contas_bancarias')
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
    },
  })
}

// ── Movimentacoes ─────────────────────────────────────────
export function useMovimentacoes(contaId?: string, periodo = '30d') {
  return useQuery<MovimentacaoTesouraria[]>({
    queryKey: ['movimentacoes-tesouraria', contaId, periodo],
    queryFn: async () => {
      const dias = periodo === '7d' ? 7 : periodo === '60d' ? 60 : periodo === '90d' ? 90 : 30
      const dataInicio = new Date()
      dataInicio.setDate(dataInicio.getDate() - dias)

      let q = supabase
        .from('fin_movimentacoes_tesouraria')
        .select('*, conta:fin_contas_bancarias(nome, cor)')
        .gte('data_movimentacao', dataInicio.toISOString().split('T')[0])
        .order('data_movimentacao', { ascending: false })
        .limit(200)

      if (contaId) q = q.eq('conta_id', contaId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((m: any) => ({
        ...m,
        conta_nome: m.conta?.nome,
        conta_cor: m.conta?.cor,
      }))
    },
  })
}

export function useCriarMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (mov: {
      conta_id: string; tipo: 'entrada' | 'saida' | 'transferencia'
      valor: number; data_movimentacao: string; descricao?: string
      categoria?: CategoriaMovimentacao
    }) => {
      const { data, error } = await supabase
        .from('fin_movimentacoes_tesouraria')
        .insert({ ...mov, origem: 'manual' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimentacoes-tesouraria'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
    },
  })
}

// ── Import OFX/CSV ────────────────────────────────────────
export function useImportExtrato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contaId, file }: { contaId: string; file: File }) => {
      // 1. Upload file to storage
      const ext = file.name.split('.').pop()?.toLowerCase() || 'ofx'
      const path = `extratos/${contaId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('notas-fiscais')
        .upload(path, file)
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('notas-fiscais').getPublicUrl(path)

      // 2. Create import record
      const { data: importRec, error: insErr } = await supabase
        .from('fin_extratos_import')
        .insert({
          conta_id: contaId,
          arquivo_url: urlData.publicUrl,
          nome_arquivo: file.name,
          formato: ext === 'csv' ? 'csv' : 'ofx',
          status: 'processando',
        })
        .select()
        .single()
      if (insErr) throw insErr

      // 3. Call n8n to parse (fire-and-forget, n8n will update status)
      const BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || ''
      try {
        await fetch(`${BASE}/tesouraria/import-extrato`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            import_id: importRec.id,
            conta_id: contaId,
            arquivo_url: urlData.publicUrl,
            formato: ext,
          }),
        })
      } catch { /* n8n may not be configured yet */ }

      return importRec
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimentacoes-tesouraria'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
    },
  })
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useTesouraria.ts
git commit -m "feat(hooks): add useTesouraria hooks (dashboard, contas, movimentacoes, import)"
```

---

## Task 5: Tesouraria Cockpit Page

**Files:**
- Create: `frontend/src/pages/financeiro/Tesouraria.tsx`

**Step 1: Build the cockpit page**

This is the main implementation — a single large React component (~600-800 lines) with:

1. **Header** — title + period selector (7d/30d/60d/90d)
2. **KPI Row** — 4 cards: Saldo Total, Entradas, Saidas, Previsao 30d
3. **Main Grid** — 2 columns:
   - Left (2/3): Recharts AreaChart fluxo de caixa + Movimentacoes table
   - Right (1/3): Contas Bancarias cards + Aging CP/CR
4. **Modals** — Nova Conta, Nova Movimentacao, Import OFX

Key patterns to follow:
- `const { isDark } = useTheme()` for dark mode
- `const cardBg = isDark ? 'bg-[#1e293b]' : 'bg-white'`
- KpiCard pattern from DashboardFinanceiro.tsx
- lucide-react icons: Landmark, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Plus, Upload, Wallet, Building2, CircleDollarSign
- Recharts: AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
- BRL formatter: `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })`
- Glassmorphism for dark: `backdrop-blur-xl bg-white/5 border border-white/10`
- Animate KPI values with CSS `transition-all` on mount

**Step 2: Verify page renders**

Start dev server and navigate to `/financeiro/tesouraria`
Expected: Page renders with empty state (no data yet), KPIs show R$ 0, chart empty, "Nenhuma conta cadastrada" message

**Step 3: Commit**

```bash
git add frontend/src/pages/financeiro/Tesouraria.tsx
git commit -m "feat(tesouraria): cockpit page with KPIs, chart, contas, movimentacoes, modals"
```

---

## Task 6: Routes & Navigation

**Files:**
- Modify: `frontend/src/components/FinanceiroLayout.tsx` — add Tesouraria nav item
- Modify: `frontend/src/App.tsx` — add route

**Step 1: Add nav item to FinanceiroLayout**

In the NAV array, add after 'Painel':
```typescript
{ to: '/financeiro/tesouraria', icon: Landmark, label: 'Tesouraria', end: false },
```

Import `Landmark` from lucide-react. Update `bottomNavMaxItems` to 5.

**Step 2: Add route to App.tsx**

Import: `import Tesouraria from './pages/financeiro/Tesouraria'`

Add route inside financeiro group:
```typescript
<Route path="tesouraria" element={<Tesouraria />} />
```

**Step 3: Verify navigation works**

Navigate to `/financeiro` → click "Tesouraria" in sidebar → page loads correctly.

**Step 4: Commit**

```bash
git add frontend/src/components/FinanceiroLayout.tsx frontend/src/App.tsx
git commit -m "feat(nav): add Tesouraria route and nav item in Financeiro"
```

---

## Task 7: Test End-to-End & Deploy

**Step 1: Create a test bank account via Supabase**

```sql
INSERT INTO fin_contas_bancarias (nome, banco_codigo, banco_nome, agencia, conta, tipo, saldo_atual, cor)
VALUES
  ('Itau PJ', '341', 'Itau Unibanco', '1234', '56789-0', 'corrente', 0, '#FF6B00'),
  ('BB Folha', '001', 'Banco do Brasil', '5678', '12345-6', 'corrente', 0, '#FFCC00');
```

**Step 2: Create test movements**

```sql
INSERT INTO fin_movimentacoes_tesouraria (conta_id, tipo, valor, data_movimentacao, descricao, categoria)
SELECT id, 'entrada', 150000, CURRENT_DATE - 5, 'Recebimento medicao Obra LD-01', 'recebimento_cliente'
FROM fin_contas_bancarias WHERE nome = 'Itau PJ';

INSERT INTO fin_movimentacoes_tesouraria (conta_id, tipo, valor, data_movimentacao, descricao, categoria)
SELECT id, 'saida', 45000, CURRENT_DATE - 3, 'Pagamento fornecedor TransBrasil', 'pagamento_fornecedor'
FROM fin_contas_bancarias WHERE nome = 'Itau PJ';

INSERT INTO fin_movimentacoes_tesouraria (conta_id, tipo, valor, data_movimentacao, descricao, categoria)
SELECT id, 'entrada', 80000, CURRENT_DATE - 1, 'Transferencia para folha', 'transferencia'
FROM fin_contas_bancarias WHERE nome = 'BB Folha';
```

**Step 3: Verify dashboard shows data**

- KPIs populated with correct values
- Chart shows entries for the dates
- Contas list shows Itau PJ and BB Folha with correct saldos
- Movimentacoes table lists 3 records

**Step 4: Test creating account and movement via UI**

- Click "+ Nova Conta" → fill form → save → appears in list
- Click "+ Lancamento" → fill form → save → appears in table, saldo updates

**Step 5: Push and deploy**

```bash
git push origin main
```

Verify Vercel build succeeds and page works in production.

---

## Summary

| Task | Description | New Files |
|------|-------------|-----------|
| 1 | Install Recharts | package.json |
| 2 | DB migration (3 tables + RPC + triggers) | supabase/050_tesouraria.sql |
| 3 | TypeScript types | types/financeiro.ts |
| 4 | Hooks (dashboard, CRUD, import) | hooks/useTesouraria.ts |
| 5 | Cockpit page (main UI) | pages/financeiro/Tesouraria.tsx |
| 6 | Routes & navigation | FinanceiroLayout.tsx, App.tsx |
| 7 | E2E test & deploy | — |


## Links
- [[obsidian/20 - Módulo Financeiro]]
