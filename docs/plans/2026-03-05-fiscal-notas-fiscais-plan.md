# Notas Fiscais (Historico Fiscal) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a centralized NF (Nota Fiscal) history page inside the Financeiro module so accounting can filter, view, and batch-download invoice PDFs organized by month and centro de custo.

**Architecture:** New table `fis_notas_fiscais` in Supabase holds denormalized NF metadata (number, supplier, value, date, classification) with PDF storage in a Supabase Storage bucket. A new page `/financeiro/notas-fiscais` provides filter+select+download UX. Upload triggers n8n AI parse to extract data from PDFs. Batch ZIP download via n8n webhook.

**Tech Stack:** React 18 + TailwindCSS 3.4 + TanStack Query v5, Supabase PostgreSQL 15 + Storage + RLS, n8n webhooks (AI parse + ZIP generation)

**Design doc:** `docs/plans/2026-03-05-fiscal-notas-fiscais-design.md`

---

## Task 1: Supabase Migration — `fis_notas_fiscais` table + storage bucket

**Files:**
- Create migration via Supabase MCP tool (project_id: `uzfjfucrinokeuwpbeie`)

**Step 1: Apply migration 028**

Use `mcp__402c23fe...apply_migration` with name `028_fiscal_notas_fiscais` and this SQL:

```sql
-- ============================================================
-- 028 — Fiscal: Notas Fiscais (historico centralizado)
-- ============================================================

CREATE TABLE fis_notas_fiscais (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT,
  serie             TEXT DEFAULT '1',
  chave_acesso      TEXT,
  data_emissao      DATE NOT NULL,
  data_entrada      DATE DEFAULT CURRENT_DATE,

  -- Fornecedor (denormalizado + FK)
  fornecedor_id     UUID REFERENCES cmp_fornecedores(id),
  fornecedor_cnpj   TEXT,
  fornecedor_nome   TEXT,

  -- Valores
  valor_total       NUMERIC(15,2) NOT NULL,
  valor_desconto    NUMERIC(15,2) DEFAULT 0,
  valor_liquido     NUMERIC(15,2) GENERATED ALWAYS AS (valor_total - COALESCE(valor_desconto, 0)) STORED,

  -- Classificacao
  classe_id         UUID REFERENCES fin_classes_financeiras(id),
  centro_custo_id   UUID REFERENCES sys_centros_custo(id),
  empresa_id        UUID REFERENCES sys_empresas(id),
  obra_id           UUID REFERENCES sys_obras(id),

  -- Origem
  origem            TEXT NOT NULL DEFAULT 'avulso'
                    CHECK (origem IN ('pedido','cp','contrato','avulso')),
  pedido_id         UUID REFERENCES cmp_pedidos(id),
  conta_pagar_id    UUID REFERENCES fin_contas_pagar(id),
  contrato_id       UUID REFERENCES con_contratos(id),

  -- Arquivos (Supabase Storage bucket: notas-fiscais)
  pdf_path          TEXT,
  pdf_url           TEXT,
  xml_path          TEXT,
  xml_url           TEXT,

  -- Meta
  observacoes       TEXT,
  criado_por        UUID REFERENCES auth.users(id),
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para filtros frequentes
CREATE INDEX idx_fis_nf_data_emissao   ON fis_notas_fiscais(data_emissao);
CREATE INDEX idx_fis_nf_fornecedor     ON fis_notas_fiscais(fornecedor_id);
CREATE INDEX idx_fis_nf_centro_custo   ON fis_notas_fiscais(centro_custo_id);
CREATE INDEX idx_fis_nf_classe         ON fis_notas_fiscais(classe_id);
CREATE INDEX idx_fis_nf_empresa        ON fis_notas_fiscais(empresa_id);
CREATE INDEX idx_fis_nf_origem         ON fis_notas_fiscais(origem);

-- RLS
ALTER TABLE fis_notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fis_nf_select" ON fis_notas_fiscais
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fis_nf_insert" ON fis_notas_fiscais
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "fis_nf_update" ON fis_notas_fiscais
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "fis_nf_delete" ON fis_notas_fiscais
  FOR DELETE TO authenticated USING (true);

-- Storage bucket (manual: go to Supabase Dashboard > Storage > New bucket "notas-fiscais", public=true)
-- Or use: INSERT INTO storage.buckets (id, name, public) VALUES ('notas-fiscais', 'notas-fiscais', true);
```

**Step 2: Verify migration applied**

Run `mcp__402c23fe...execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'fis_notas_fiscais' ORDER BY ordinal_position;
```
Expected: ~24 columns starting with id, numero, serie...

**Step 3: Create storage bucket**

Run `mcp__402c23fe...execute_sql`:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('notas-fiscais', 'notas-fiscais', true)
ON CONFLICT (id) DO NOTHING;
```

Then create storage RLS policy:
```sql
CREATE POLICY "nf_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'notas-fiscais');

CREATE POLICY "nf_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'notas-fiscais');
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat(fiscal): migration 028 — fis_notas_fiscais table + storage bucket"
```

---

## Task 2: TypeScript Types — `types/fiscal.ts`

**Files:**
- Create: `frontend/src/types/fiscal.ts`

**Step 1: Create the types file**

```typescript
// frontend/src/types/fiscal.ts

export type OrigemNF = 'pedido' | 'cp' | 'contrato' | 'avulso'

export interface NotaFiscal {
  id: string
  numero?: string
  serie: string
  chave_acesso?: string
  data_emissao: string       // DATE as ISO string
  data_entrada?: string

  fornecedor_id?: string
  fornecedor_cnpj?: string
  fornecedor_nome?: string

  valor_total: number
  valor_desconto: number
  valor_liquido: number      // GENERATED column

  classe_id?: string
  centro_custo_id?: string
  empresa_id?: string
  obra_id?: string

  origem: OrigemNF
  pedido_id?: string
  conta_pagar_id?: string
  contrato_id?: string

  pdf_path?: string
  pdf_url?: string
  xml_path?: string
  xml_url?: string

  observacoes?: string
  criado_por?: string
  criado_em: string
  updated_at: string

  // Joined data (from select with joins)
  classe?: { id: string; codigo: string; descricao: string }
  centro_custo?: { id: string; codigo: string; descricao: string }
  empresa?: { id: string; codigo: string; razao_social: string }
  obra?: { id: string; codigo: string; nome: string }
  fornecedor?: { id: string; razao_social: string; cnpj?: string }
}

export interface NotaFiscalFilters {
  mes?: number          // 1-12
  ano?: number          // 2024, 2025, 2026...
  centro_custo_id?: string
  empresa_id?: string
  classe_id?: string
  obra_id?: string
  fornecedor_id?: string
  origem?: OrigemNF
  busca?: string        // free-text search
}

export interface NfParseResult {
  numero?: string
  serie?: string
  chave_acesso?: string
  cnpj_emitente?: string
  nome_emitente?: string
  valor_total?: number
  data_emissao?: string
  confidence: number    // 0-1
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/fiscal.ts
git commit -m "feat(fiscal): add TypeScript types for NotaFiscal"
```

---

## Task 3: Hook — `useNotasFiscais.ts`

**Files:**
- Create: `frontend/src/hooks/useNotasFiscais.ts`

**Context:** Follow the exact same patterns as `useFinanceiro.ts` (TanStack Query + Supabase direct) and `useAnexos.ts` (upload to Storage pattern).

**Step 1: Create the hook file**

```typescript
// frontend/src/hooks/useNotasFiscais.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { NotaFiscal, NotaFiscalFilters, NfParseResult } from '../types/fiscal'

const BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

const SELECT_NF = `
  *,
  classe:fin_classes_financeiras!classe_id(id, codigo, descricao),
  centro_custo:sys_centros_custo!centro_custo_id(id, codigo, descricao),
  empresa:sys_empresas!empresa_id(id, codigo, razao_social),
  obra:sys_obras!obra_id(id, codigo, nome),
  fornecedor:cmp_fornecedores!fornecedor_id(id, razao_social, cnpj)
`

// ── List with filters ──────────────────────────────────────────────────────
export function useNotasFiscais(filters: NotaFiscalFilters = {}) {
  return useQuery<NotaFiscal[]>({
    queryKey: ['notas-fiscais', filters],
    queryFn: async () => {
      let q = supabase
        .from('fis_notas_fiscais')
        .select(SELECT_NF)
        .order('data_emissao', { ascending: false })

      // Month/year filter
      if (filters.mes && filters.ano) {
        const startDate = `${filters.ano}-${String(filters.mes).padStart(2, '0')}-01`
        const endMonth = filters.mes === 12 ? 1 : filters.mes + 1
        const endYear = filters.mes === 12 ? filters.ano + 1 : filters.ano
        const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
        q = q.gte('data_emissao', startDate).lt('data_emissao', endDate)
      }

      if (filters.centro_custo_id) q = q.eq('centro_custo_id', filters.centro_custo_id)
      if (filters.empresa_id) q = q.eq('empresa_id', filters.empresa_id)
      if (filters.classe_id) q = q.eq('classe_id', filters.classe_id)
      if (filters.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters.fornecedor_id) q = q.eq('fornecedor_id', filters.fornecedor_id)
      if (filters.origem) q = q.eq('origem', filters.origem)
      if (filters.busca) {
        q = q.or(`numero.ilike.%${filters.busca}%,fornecedor_nome.ilike.%${filters.busca}%`)
      }

      const { data, error } = await q
      if (error) return []
      return (data ?? []) as NotaFiscal[]
    },
  })
}

// ── Summary stats (computed from filtered data — no separate RPC) ──────────
export function useNfResumo(notas: NotaFiscal[]) {
  const total = notas.reduce((s, n) => s + (n.valor_total ?? 0), 0)
  const porOrigem = {
    pedido: notas.filter(n => n.origem === 'pedido').length,
    cp: notas.filter(n => n.origem === 'cp').length,
    contrato: notas.filter(n => n.origem === 'contrato').length,
    avulso: notas.filter(n => n.origem === 'avulso').length,
  }
  return { total, count: notas.length, porOrigem }
}

// ── Upload NF PDF + save record ────────────────────────────────────────────
export function useUploadNF() {
  const qc = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async ({
      file,
      dados,
    }: {
      file: File
      dados: Omit<NotaFiscal, 'id' | 'criado_em' | 'updated_at' | 'valor_liquido' |
        'classe' | 'centro_custo' | 'empresa' | 'obra' | 'fornecedor'>
    }) => {
      // 1. Upload PDF to Supabase Storage
      const ext = file.name.split('.').pop() || 'pdf'
      const ts = Date.now()
      const path = `${dados.origem}/${ts}-${dados.numero || 'nf'}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('notas-fiscais')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw new Error('Falha no upload: ' + upErr.message)

      const { data: { publicUrl } } = supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(path)

      // 2. Insert record
      const { error: dbErr } = await supabase
        .from('fis_notas_fiscais')
        .insert({
          ...dados,
          pdf_path: path,
          pdf_url: publicUrl,
          criado_por: perfil?.id ?? null,
        })
      if (dbErr) throw new Error('Falha ao salvar NF: ' + dbErr.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas-fiscais'] }),
  })
}

// ── Delete NF ──────────────────────────────────────────────────────────────
export function useDeleteNF() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Get pdf_path first to delete from storage
      const { data: nf } = await supabase
        .from('fis_notas_fiscais')
        .select('pdf_path')
        .eq('id', id)
        .single()

      if (nf?.pdf_path) {
        await supabase.storage.from('notas-fiscais').remove([nf.pdf_path])
      }

      const { error } = await supabase
        .from('fis_notas_fiscais')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas-fiscais'] }),
  })
}

// ── Parse NF via n8n AI ────────────────────────────────────────────────────
export function useParseNF() {
  return useMutation<NfParseResult, Error, { base64: string; filename: string }>({
    mutationFn: async ({ base64, filename }) => {
      const res = await fetch(`${BASE}/fiscal/nf/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivo: base64, nome: filename }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      return res.json()
    },
  })
}

// ── Download ZIP via n8n ───────────────────────────────────────────────────
export function useDownloadZip() {
  return useMutation<Blob, Error, { nf_ids: string[] }>({
    mutationFn: async ({ nf_ids }) => {
      const res = await fetch(`${BASE}/fiscal/nf/download-lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nf_ids }),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      return res.blob()
    },
  })
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useNotasFiscais.ts
git commit -m "feat(fiscal): add useNotasFiscais hook (CRUD + upload + parse + ZIP)"
```

---

## Task 4: Page — `NotasFiscais.tsx`

**Files:**
- Create: `frontend/src/pages/financeiro/NotasFiscais.tsx`

**Context:** This is the main (and only) page for v1. Follow the same TailwindCSS patterns as `ContasPagar.tsx` and `Conciliacao.tsx` — emerald accent color since it's inside Financeiro module. World-class UI per project directive.

**Step 1: Create the page**

Create file at `frontend/src/pages/financeiro/NotasFiscais.tsx` with these features:

1. **State:** filters (mes, ano, centro_custo_id, busca), selected IDs (Set<string>), modal open/closed
2. **Data hooks:** `useNotasFiscais(filters)`, `useCadCentrosCusto()`, `useCadClasses()`, `useCadEmpresas()`
3. **Filter bar:** Month/Year selector (current month default), Centro de Custo dropdown, free-text search input
4. **Summary line:** "{count} notas • R$ {total}" — computed from `useNfResumo(notas)`
5. **Batch action bar:** "Selecionar todos" checkbox + "Baixar ZIP" button (disabled when none selected)
6. **List items:** Each NF as a card/row with:
   - Checkbox for selection
   - Main line: `NF {numero}` em bold + fornecedor nome + valor formatado right-aligned
   - Sub line: data emissao + centro_custo.descricao + classe.descricao + badge de origem
   - Download individual button (anchor to pdf_url)
7. **Upload modal:** triggered by "+ Upload NF" header button
   - Dropzone (drag+drop or click to select PDF)
   - On file selected: convert to base64 → call `useParseNF` → pre-fill form
   - Form fields: numero, fornecedor (autocomplete from useCadFornecedores), valor_total, data_emissao, empresa, centro_custo, obra, classe, origem, observacoes
   - Save button calls `useUploadNF`
8. **Empty state:** illustration + "Nenhuma nota fiscal encontrada" + "Altere os filtros ou faça upload"

**UI patterns to follow (from ContasPagar.tsx):**
- Header with icon: `<FileText />` + "Notas Fiscais"
- Filter inputs: `rounded-xl border bg-white/80 dark:bg-slate-800 px-3 py-2 text-sm`
- List items: `rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all`
- Badges: `text-[10px] font-bold px-2 py-0.5 rounded-full`
- Emerald accent for active/primary elements matching Financeiro module theme
- Dark mode support via `useTheme()` context (`isDark`, `isLightSidebar`)

**Badge colors per origem:**
- pedido: `bg-blue-50 text-blue-600` (📦)
- cp: `bg-emerald-50 text-emerald-600` (💳)
- contrato: `bg-violet-50 text-violet-600` (📋)
- avulso: `bg-amber-50 text-amber-600` (📝)

**Step 2: Commit**

```bash
git add frontend/src/pages/financeiro/NotasFiscais.tsx
git commit -m "feat(fiscal): add NotasFiscais page with filters, list, upload modal"
```

---

## Task 5: Route + Layout — Wire into Financeiro

**Files:**
- Modify: `frontend/src/App.tsx` (add import + route)
- Modify: `frontend/src/components/FinanceiroLayout.tsx` (add NAV entry)

**Step 1: Add import and route to App.tsx**

In `frontend/src/App.tsx`:

After the existing Financeiro page imports (around line 57, after `import Configuracoes`):
```typescript
import NotasFiscais from './pages/financeiro/NotasFiscais'
```

Inside the `<FinanceiroLayout />` route block (after `/financeiro/configuracoes`):
```tsx
<Route path="/financeiro/notas-fiscais" element={<NotasFiscais />} />
```

**Step 2: Add sidebar entry to FinanceiroLayout.tsx**

In `frontend/src/components/FinanceiroLayout.tsx`:

Add `FileText` to the lucide import:
```typescript
import {
  LayoutDashboard, Receipt, Landmark, FileCheck2,
  BarChart3, Users, LogOut, LayoutGrid, DollarSign, Settings,
  FileText,   // ← add
} from 'lucide-react'
```

Add new entry to NAV array (before Configuracoes, after Fornecedores):
```typescript
{ to: '/financeiro/notas-fiscais', icon: FileText, label: 'Notas Fiscais', end: false },
```

**Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/FinanceiroLayout.tsx
git commit -m "feat(fiscal): wire NotasFiscais route + sidebar entry in Financeiro"
```

---

## Task 6: Verify — TypeScript + Build

**Step 1: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

**Step 2: Production build**

```bash
cd frontend && npm run build
```
Expected: build succeeds (chunk size warning OK)

**Step 3: Fix any errors found**

If TS or build errors occur, fix them before proceeding.

**Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(fiscal): resolve build errors"
```

---

## Task 7: n8n Workflow — NF PDF Parse (AI)

**Context:** Create n8n workflow that receives a PDF (base64), sends it to Claude/GPT-4o for data extraction, and returns structured JSON. Use the existing n8n MCP tools.

**Step 1: Create the n8n workflow**

Workflow name: `Fiscal — Parse NF PDF`

Nodes:
1. **Webhook** — POST `/fiscal/nf/parse`, receives `{ arquivo: string (base64), nome: string }`
2. **Code node** — Prepare prompt: "Extract from this invoice PDF: numero (NF number), serie, chave_acesso (44 digits), cnpj_emitente, nome_emitente (company name), valor_total, data_emissao (YYYY-MM-DD format). Return JSON only."
3. **HTTP Request / AI node** — Send to Claude API or GPT-4o with the PDF content
4. **Code node** — Parse response, validate fields, compute confidence score
5. **Respond to Webhook** — Return `NfParseResult` JSON

**Step 2: Create the n8n workflow for ZIP download**

Workflow name: `Fiscal — Download Lote ZIP`

Nodes:
1. **Webhook** — POST `/fiscal/nf/download-lote`, receives `{ nf_ids: string[] }`
2. **Code node** — Query Supabase for pdf_path of each NF ID
3. **HTTP Request (loop)** — Download each PDF from Supabase Storage
4. **Code node** — Use `archiver` or similar to create ZIP buffer
5. **Respond to Webhook** — Return ZIP as binary blob

**Step 3: Activate workflows and test**

Test parse: POST to webhook with a sample PDF base64.
Test download: POST with array of NF IDs that have pdf_url populated.

---

## Summary of all files

| Action | File |
|--------|------|
| Migration | `028_fiscal_notas_fiscais` via Supabase MCP |
| Create | `frontend/src/types/fiscal.ts` |
| Create | `frontend/src/hooks/useNotasFiscais.ts` |
| Create | `frontend/src/pages/financeiro/NotasFiscais.tsx` |
| Modify | `frontend/src/App.tsx` (1 import + 1 route) |
| Modify | `frontend/src/components/FinanceiroLayout.tsx` (1 import + 1 NAV entry) |
| n8n | Workflow: Fiscal — Parse NF PDF |
| n8n | Workflow: Fiscal — Download Lote ZIP |

## Execution order

Tasks 1-6 are sequential (each depends on previous).
Task 7 (n8n) can be done in parallel with Tasks 4-6 but is needed for full functionality.

For v1 MVP: Tasks 1-6 give a fully working page with manual upload + individual download. Task 7 adds AI parse + batch ZIP (can be added after).


## Links
- [[obsidian/29 - Módulo Fiscal]]
