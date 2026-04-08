# Fluxo de Aprovação Completo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add esclarecimento flow, detail page, comments field, and AprovAi integration to the requisition approval system.

**Architecture:** Database-first approach — add enum values and columns first, then build the frontend hooks, detail page, and modify existing components. All admin decisions auto-create `apr_aprovacoes` records so AprovAi works.

**Tech Stack:** Supabase PostgreSQL (migrations), React 18, TypeScript, TanStack Query v5, Tailwind CSS, React Router v6

---

### Task 1: Database Migration — New Enum Values + Columns

**Files:**
- Create: `supabase/019_esclarecimento_flow.sql`

**Step 1: Write and apply the migration**

Apply via Supabase MCP `apply_migration` with project_id `uzfjfucrinokeuwpbeie`:

```sql
-- 019: Esclarecimento flow — new enum values + columns
-- Adds 'em_esclarecimento' to status_requisicao
-- Adds 'esclarecimento' to status_aprovacao
-- Adds esclarecimento fields to cmp_requisicoes

ALTER TYPE status_requisicao ADD VALUE IF NOT EXISTS 'em_esclarecimento';
ALTER TYPE status_aprovacao ADD VALUE IF NOT EXISTS 'esclarecimento';

ALTER TABLE cmp_requisicoes
  ADD COLUMN IF NOT EXISTS esclarecimento_msg text,
  ADD COLUMN IF NOT EXISTS esclarecimento_por varchar(200),
  ADD COLUMN IF NOT EXISTS esclarecimento_em  timestamptz;
```

**Step 2: Verify migration applied**

Run SQL: `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'status_requisicao'::regtype ORDER BY enumsortorder;`

Expected: includes `em_esclarecimento` in the list.

Run SQL: `SELECT column_name FROM information_schema.columns WHERE table_name = 'cmp_requisicoes' AND column_name LIKE 'esclarecimento%';`

Expected: 3 rows (esclarecimento_msg, esclarecimento_por, esclarecimento_em).

**Step 3: Save migration file locally and commit**

Save the SQL to `supabase/019_esclarecimento_flow.sql` and commit:
```bash
git add supabase/019_esclarecimento_flow.sql
git commit -m "db: add esclarecimento enum values and columns (migration 019)"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add `em_esclarecimento` to StatusRequisicao type**

In `types/index.ts`, line 1-7, change the `StatusRequisicao` union to include `'em_esclarecimento'`:

```typescript
export type StatusRequisicao =
  | 'rascunho' | 'pendente' | 'em_aprovacao'
  | 'aprovada' | 'rejeitada' | 'em_esclarecimento'
  | 'em_cotacao' | 'cotacao_enviada' | 'cotacao_aprovada' | 'cotacao_rejeitada'
  | 'pedido_emitido' | 'em_entrega' | 'entregue'
  | 'aguardando_pgto' | 'pago'
  | 'comprada' | 'cancelada'
```

**Step 2: Add esclarecimento fields to Requisicao interface**

In `types/index.ts`, after `created_at: string` in the Requisicao interface, add:

```typescript
  esclarecimento_msg?: string
  esclarecimento_por?: string
  esclarecimento_em?: string
```

**Step 3: Add `'esclarecimento'` to Aprovacao status union**

In `types/index.ts`, line 100, change Aprovacao.status:

```typescript
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'expirada' | 'esclarecimento'
```

**Step 4: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "types: add esclarecimento to StatusRequisicao, Aprovacao, and Requisicao"
```

---

### Task 3: Update StatusBadge + FluxoTimeline for `em_esclarecimento`

**Files:**
- Modify: `frontend/src/components/StatusBadge.tsx`
- Modify: `frontend/src/components/FluxoTimeline.tsx`

**Step 1: Add em_esclarecimento config to StatusBadge**

In `StatusBadge.tsx`, inside the `config` object, after the `rejeitada` entry (line 10), add:

```typescript
  em_esclarecimento: { dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Em Esclarecimento' },
```

**Step 2: Handle em_esclarecimento in FluxoTimeline**

In `FluxoTimeline.tsx`, in the `getEtapaIndex` function (line 54-65), add a case before the loop:

```typescript
  if (status === 'em_esclarecimento') return 0  // volta para etapa RC
```

Also, in `ETAPAS[0].statuses` (line 19), add `'em_esclarecimento'`:

```typescript
  statuses: ['rascunho', 'pendente', 'em_esclarecimento'],
```

**Step 3: Commit**

```bash
git add frontend/src/components/StatusBadge.tsx frontend/src/components/FluxoTimeline.tsx
git commit -m "ui: add em_esclarecimento to StatusBadge and FluxoTimeline"
```

---

### Task 4: Add `useRequisicao(id)` Hook for Single Record + Items

**Files:**
- Modify: `frontend/src/hooks/useRequisicoes.ts`

**Step 1: Add useRequisicao hook**

At the end of `useRequisicoes.ts` (before the closing), add:

```typescript
export interface RequisicaoDetalhe extends Requisicao {
  itens: RequisicaoItem[]
}

export function useRequisicao(id?: string) {
  return useQuery<RequisicaoDetalhe | null>({
    queryKey: ['requisicao', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from(TABLE)
        .select(`
          id, numero, solicitante_nome, obra_nome, obra_id,
          descricao, justificativa, valor_estimado, urgencia, status,
          alcada_nivel, categoria, comprador_id, texto_original, ai_confianca,
          created_at, esclarecimento_msg, esclarecimento_por, esclarecimento_em,
          comprador:cmp_compradores(nome, email),
          itens:cmp_requisicao_itens(id, descricao, quantidade, unidade, valor_unitario_estimado)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      if (!data) return null

      const d = data as any
      return {
        ...d,
        comprador_nome: d.comprador?.nome ?? undefined,
        comprador: undefined,
        itens: d.itens ?? [],
      } as RequisicaoDetalhe
    },
    enabled: !!id,
    staleTime: 15_000,
  })
}
```

**Step 2: Add RequisicaoItem import if not already present**

Ensure the import line includes `RequisicaoItem`:

```typescript
import type { Requisicao, NovaRequisicaoPayload, RequisicaoItem } from '../types'
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/useRequisicoes.ts
git commit -m "hook: add useRequisicao(id) for single record with items"
```

---

### Task 5: Add `useDecisaoRequisicao` Mutation Hook

This central hook handles all 3 decisions (aprovar/rejeitar/esclarecimento), creates `apr_aprovacoes` record, and updates `cmp_requisicoes`.

**Files:**
- Modify: `frontend/src/hooks/useAprovacoes.ts`

**Step 1: Add the mutation hook**

At the end of `useAprovacoes.ts`, add:

```typescript
export interface DecisaoPayload {
  requisicaoId: string
  decisao: 'aprovada' | 'rejeitada' | 'esclarecimento'
  observacao?: string
  /** Required context from the requisicao + perfil */
  requisicaoNumero: string
  alcadaNivel: number
  aprovadorNome: string
  aprovadorEmail: string
}

export function useDecisaoRequisicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: DecisaoPayload) => {
      const {
        requisicaoId, decisao, observacao,
        requisicaoNumero, alcadaNivel, aprovadorNome, aprovadorEmail,
      } = payload

      // 1. Update cmp_requisicoes status
      const updates: Record<string, unknown> = {}

      if (decisao === 'aprovada') {
        updates.status = 'aprovada'
        updates.data_aprovacao = new Date().toISOString()
      } else if (decisao === 'rejeitada') {
        updates.status = 'rejeitada'
      } else if (decisao === 'esclarecimento') {
        updates.status = 'em_esclarecimento'
        updates.esclarecimento_msg = observacao || 'Esclarecimento solicitado'
        updates.esclarecimento_por = aprovadorNome
        updates.esclarecimento_em = new Date().toISOString()
      }

      const { error: reqError } = await supabase
        .from('cmp_requisicoes')
        .update(updates)
        .eq('id', requisicaoId)

      if (reqError) throw reqError

      // 2. Create apr_aprovacoes record (audit trail + feeds AprovAi)
      const aprStatus = decisao === 'aprovada' ? 'aprovada'
                      : decisao === 'rejeitada' ? 'rejeitada'
                      : 'esclarecimento'

      const { error: aprError } = await supabase
        .from('apr_aprovacoes')
        .insert({
          modulo: 'cmp',
          entidade_id: requisicaoId,
          entidade_numero: requisicaoNumero,
          aprovador_nome: aprovadorNome,
          aprovador_email: aprovadorEmail,
          nivel: alcadaNivel,
          status: aprStatus,
          observacao: observacao || null,
          data_decisao: new Date().toISOString(),
        })

      // Non-critical: don't throw if apr_aprovacoes insert fails
      if (aprError) console.warn('Aviso: apr_aprovacoes não inserido:', aprError.message)

      return { decisao }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requisicoes'] })
      qc.invalidateQueries({ queryKey: ['requisicao'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useAprovacoes.ts
git commit -m "hook: add useDecisaoRequisicao mutation with apr_aprovacoes auto-creation"
```

---

### Task 6: Create RequisicaoDetalhe Page

**Files:**
- Create: `frontend/src/pages/RequisicaoDetalhe.tsx`

**Step 1: Create the detail page component**

Create `frontend/src/pages/RequisicaoDetalhe.tsx` with:

- `useParams()` to get `:id`
- `useRequisicao(id)` for data
- `useAuth()` for admin check
- `useDecisaoRequisicao()` for actions
- Header: back button + RC number + urgency + status badge
- FluxoTimeline (full mode)
- Grid: obra, solicitante, categoria, valor, data criação
- Items table (from Aprovacao.tsx template)
- Justificativa section
- Esclarecimento alert (if `status === 'em_esclarecimento'`)
- Decision panel: 3 buttons (Aprovar verde, Rejeitar vermelho, Esclarecimento âmbar) + textarea
- Uses `useNavigate(-1)` for back

Key patterns to follow:
- Layout: `Aprovacao.tsx` grid/table patterns
- Styling: Tailwind with `rounded-2xl`, `shadow-sm`, `border border-slate-200`
- Money format: `v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
- Date format: `new Date(d).toLocaleDateString('pt-BR')`

The component should be ~250-350 lines. Full code in implementation.

**Step 2: Commit**

```bash
git add frontend/src/pages/RequisicaoDetalhe.tsx
git commit -m "feat: add RequisicaoDetalhe page with items, esclarecimento, and decision panel"
```

---

### Task 7: Add Route + Make Cards Clickable

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/ListaRequisicoes.tsx`

**Step 1: Add route in App.tsx**

Import the new page:
```typescript
import RequisicaoDetalhe from './pages/RequisicaoDetalhe'
```

Add route inside the Compras Layout block (after line 143):
```typescript
<Route path="/requisicoes/:id" element={<RequisicaoDetalhe />} />
```

**Step 2: Make cards clickable in ListaRequisicoes.tsx**

Add `useNavigate` import:
```typescript
import { useNavigate } from 'react-router-dom'
```

Add hook inside component:
```typescript
const navigate = useNavigate()
```

Wrap each card div with an onClick. Change the card `<div>` (line 204) to add:
```typescript
<div key={r.id}
  onClick={() => navigate(`/requisicoes/${r.id}`)}
  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 cursor-pointer hover:border-teal-300 hover:shadow-md transition-all active:scale-[0.99]"
>
```

**Important:** The approve/reject/clarification buttons must `e.stopPropagation()` so clicking them doesn't navigate.

**Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/ListaRequisicoes.tsx
git commit -m "feat: add /requisicoes/:id route and make list cards clickable"
```

---

### Task 8: Update ListaRequisicoes — Esclarecimento Button + Comments + Pipeline Tab

**Files:**
- Modify: `frontend/src/pages/ListaRequisicoes.tsx`

**Step 1: Replace `handleAdminDecision` with `useDecisaoRequisicao`**

Remove the old `handleAdminDecision` function and `supabase` import. Use the new centralized `useDecisaoRequisicao` hook instead. The approve/reject buttons call:

```typescript
const decisao = useDecisaoRequisicao()

// In button onClick:
decisao.mutate({
  requisicaoId: r.id,
  decisao: 'aprovada', // or 'rejeitada' or 'esclarecimento'
  observacao,
  requisicaoNumero: r.numero,
  alcadaNivel: r.alcada_nivel,
  aprovadorNome: perfil?.nome ?? 'Admin',
  aprovadorEmail: perfil?.email ?? '',
})
```

**Step 2: Add esclarecimento button**

Add a third amber button between reject and approve:
```typescript
<button className="... text-amber-600 bg-amber-50 border-amber-200 ...">
  <MessageSquare size={14} /> Esclarecer
</button>
```

When clicked, shows a textarea. The textarea is mandatory for esclarecimento.

**Step 3: Add `em_esclarecimento` pipeline tab**

In `PIPELINE_TABS`, after `em_aprovacao` entry (line 23), add:
```typescript
{ value: 'em_esclarecimento', label: 'Esclarec.' },
```

**Step 4: Update StatusChip for em_esclarecimento**

Add case in `StatusChip`:
```typescript
if (status === 'em_esclarecimento') {
  return <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5 font-semibold">⚠ Esclarecimento</span>
}
```

**Step 5: Add comments (observacao) state per card**

Add `observacaoMap` state or per-card expansion to show a textarea when admin wants to add a comment before approving/rejecting.

**Step 6: Commit**

```bash
git add frontend/src/pages/ListaRequisicoes.tsx
git commit -m "feat: add esclarecimento button, comments, and pipeline tab to ListaRequisicoes"
```

---

### Task 9: Update AprovAi — Esclarecimento + Detail Link

**Files:**
- Modify: `frontend/src/pages/AprovAi.tsx`

**Step 1: Add esclarecimento button to AprovacaoCard**

In the decision buttons grid (line 172), change from `grid-cols-2` to `grid-cols-3` and add a third button:

```typescript
<button onClick={() => { setAction('esclarecimento'); handleDecision('esclarecimento') }}
  className="... text-amber-600 hover:bg-amber-50 ...">
  <MessageSquare size={22} /> Esclarecer
</button>
```

Update `handleDecision` to accept `'esclarecimento'` as well. The mutation `useProcessarAprovacaoAi` already sends to the API which can handle it (or we add a direct Supabase fallback).

**Step 2: Add "Ver detalhes" link**

Below the header/description in each AprovacaoCard, add:

```typescript
<a href={`/requisicoes/${req.id}`} target="_blank"
  className="text-xs text-indigo-400 underline">
  Ver detalhes completos →
</a>
```

**Step 3: Handle success state for esclarecimento**

Update the success render to handle `action === 'esclarecimento'` with an amber color scheme and message.

**Step 4: Commit**

```bash
git add frontend/src/pages/AprovAi.tsx
git commit -m "feat: add esclarecimento button and detail link to AprovAi"
```

---

### Task 10: Update useRequisicoes list to include esclarecimento fields

**Files:**
- Modify: `frontend/src/hooks/useRequisicoes.ts`

**Step 1: Add esclarecimento fields to the list select**

In the `useRequisicoes` hook select string (line 15-20), add the esclarecimento fields:

```typescript
.select(`
  id, numero, solicitante_nome, obra_nome, obra_id,
  descricao, justificativa, valor_estimado, urgencia, status,
  alcada_nivel, categoria, comprador_id, texto_original, ai_confianca,
  esclarecimento_msg, esclarecimento_por, esclarecimento_em,
  created_at,
  comprador:cmp_compradores(nome, email)
`)
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/useRequisicoes.ts
git commit -m "hook: include esclarecimento fields in useRequisicoes list query"
```

---

### Task 11: Build Verification + Final Commit

**Step 1: Run TypeScript build**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 2: Run Vite build**

```bash
npm run build
```

Expected: build succeeds.

**Step 3: Fix any build errors**

If TypeScript or build errors, fix them.

**Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: complete approval flow — esclarecimento, detail page, comments, AprovAi integration"
git push origin main
```


## Links
- [[obsidian/12 - Fluxo Aprovação]]
