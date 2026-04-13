# Certisign Digital Signature Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Certisign Portal de Assinaturas with the Contratos module via n8n webhooks, enabling digital/electronic signing of contract drafts (minutas) directly from the solicitation workflow.

**Architecture:** Frontend CertisignModal POSTs to n8n webhook `/certisign-enviar`, which orchestrates Certisign API calls (upload doc, create envelope), writes results to `con_assinaturas` table, and returns status. A callback webhook `/certisign-callback` receives signature events from Certisign and updates status + downloads signed docs.

**Tech Stack:** React 18 + TypeScript + Tailwind, Supabase (PostgreSQL + Storage), n8n (webhook orchestration), Certisign API (REST + Bearer auth)

**Design doc:** `docs/plans/2026-03-11-certisign-integration-design.md`

---

## Task 1: Supabase Migration — `con_assinaturas` Table

**Files:**
- Create: `supabase/045_con_assinaturas.sql`

**Step 1: Write the migration SQL**

Create `supabase/045_con_assinaturas.sql`:

```sql
-- Migration: con_assinaturas — Certisign digital signature tracking
-- Issue: #76

CREATE TABLE con_assinaturas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id             UUID REFERENCES con_contratos(id),
  solicitacao_id          UUID REFERENCES con_solicitacoes(id),
  minuta_id               UUID REFERENCES con_minutas(id),
  provedor                TEXT NOT NULL DEFAULT 'certisign'
                          CHECK (provedor IN ('certisign','manual')),
  tipo_assinatura         TEXT NOT NULL DEFAULT 'eletronica'
                          CHECK (tipo_assinatura IN ('eletronica','digital_icp')),
  documento_externo_id    TEXT,
  envelope_id             TEXT,
  status                  TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','enviado','parcialmente_assinado',
                                            'assinado','recusado','expirado','cancelado')),
  signatarios             JSONB NOT NULL DEFAULT '[]',
  enviado_em              TIMESTAMPTZ,
  concluido_em            TIMESTAMPTZ,
  expira_em               TIMESTAMPTZ,
  documento_assinado_url  TEXT,
  certificado_url         TEXT,
  webhook_log             JSONB DEFAULT '[]',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE con_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "con_assinaturas_all" ON con_assinaturas
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at (reuses existing moddatetime extension)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON con_assinaturas
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Indexes
CREATE INDEX idx_con_assinaturas_solicitacao ON con_assinaturas(solicitacao_id);
CREATE INDEX idx_con_assinaturas_envelope ON con_assinaturas(envelope_id);
CREATE INDEX idx_con_assinaturas_contrato ON con_assinaturas(contrato_id);
```

**Step 2: Apply migration via Supabase MCP**

Use MCP tool `mcp__402c23fe-4707-49e1-a558-76f47f37d917__apply_migration` with:
- `project_id`: `uzfjfucrinokeuwpbeie`
- `name`: `045_con_assinaturas`
- `query`: the SQL above

**Step 3: Verify table exists**

Use MCP tool `mcp__402c23fe-4707-49e1-a558-76f47f37d917__execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'con_assinaturas' ORDER BY ordinal_position;
```

Expected: 18 columns (id, contrato_id, solicitacao_id, ... updated_at)

**Step 4: Commit**

```bash
git add supabase/045_con_assinaturas.sql
git commit -m "feat(db): add con_assinaturas table for Certisign integration (#76)"
```

---

## Task 2: TypeScript Types — Assinatura

**Files:**
- Modify: `frontend/src/types/contratos.ts` (append after line ~511)

**Step 1: Add types at end of file**

Append to `frontend/src/types/contratos.ts`:

```typescript
// ── Certisign Assinaturas ───────────────────────────────────────────

export type StatusAssinatura = 'pendente' | 'enviado' | 'parcialmente_assinado' | 'assinado' | 'recusado' | 'expirado' | 'cancelado'
export type ProvedorAssinatura = 'certisign' | 'manual'
export type TipoAssinatura = 'eletronica' | 'digital_icp'

export interface Signatario {
  nome: string
  email: string
  cpf: string
  papel: string
  ordem: number
  status: 'pendente' | 'assinado' | 'recusado'
  assinado_em: string | null
  link_assinatura: string | null
}

export interface Assinatura {
  id: string
  contrato_id: string | null
  solicitacao_id: string | null
  minuta_id: string | null
  provedor: ProvedorAssinatura
  tipo_assinatura: TipoAssinatura
  documento_externo_id: string | null
  envelope_id: string | null
  status: StatusAssinatura
  signatarios: Signatario[]
  enviado_em: string | null
  concluido_em: string | null
  expira_em: string | null
  documento_assinado_url: string | null
  certificado_url: string | null
  webhook_log: unknown[]
  created_at: string
  updated_at: string
}

export interface EnviarAssinaturaPayload {
  solicitacao_id: string
  minuta_url: string
  tipo_assinatura: TipoAssinatura
  signatarios: Pick<Signatario, 'nome' | 'email' | 'cpf' | 'papel'>[]
}

export interface EnviarAssinaturaResponse {
  assinatura_id: string
  envelope_id: string
  status: 'enviado'
}
```

**Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors from the types (existing errors may appear but nothing from this addition).

**Step 3: Commit**

```bash
git add frontend/src/types/contratos.ts
git commit -m "feat(types): add Assinatura types for Certisign integration (#76)"
```

---

## Task 3: Hooks — `useAssinaturas` + `useEnviarAssinatura`

**Files:**
- Modify: `frontend/src/hooks/useSolicitacoes.ts` (append at end, before last line)

**Context:** This file already has `N8N_BASE` defined at line 476. All mutation hooks follow the same pattern: `useMutation` + `useQueryClient` + `invalidateQueries` in `onSuccess`. N8N webhook calls use raw `fetch()` (not the `api.ts` helper) — see `useMelhorarMinuta` at line 573 for pattern.

**Step 1: Add the hooks at end of file**

Append to `frontend/src/hooks/useSolicitacoes.ts` (before the closing, after the last export):

```typescript
// ── Assinaturas (Certisign) ─────────────────────────────────────────

import type {
  Assinatura,
  EnviarAssinaturaPayload,
  EnviarAssinaturaResponse,
} from '../types/contratos'

export function useAssinaturas(solicitacaoId?: string) {
  return useQuery<Assinatura[]>({
    queryKey: ['con-assinaturas', solicitacaoId],
    enabled: !!solicitacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_assinaturas')
        .select('*')
        .eq('solicitacao_id', solicitacaoId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as Assinatura[]
    },
  })
}

export function useAssinaturasAll() {
  return useQuery<Assinatura[]>({
    queryKey: ['con-assinaturas-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('con_assinaturas')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as Assinatura[]
    },
  })
}

export function useEnviarAssinatura() {
  const qc = useQueryClient()
  return useMutation<EnviarAssinaturaResponse, Error, EnviarAssinaturaPayload>({
    mutationFn: async (payload) => {
      const res = await fetch(`${N8N_BASE}/certisign-enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          callback_url: `${N8N_BASE}/certisign-callback`,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Erro ao enviar para assinatura: ${res.status} ${body}`)
      }
      return res.json() as Promise<EnviarAssinaturaResponse>
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['con-assinaturas', vars.solicitacao_id] })
      qc.invalidateQueries({ queryKey: ['con-assinaturas-all'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['con-solicitacao', vars.solicitacao_id] })
    },
  })
}
```

**Important:** The `import type` block must be added at the TOP of the file alongside the existing imports from `'../types/contratos'`. If the file already imports from that path, merge the new types into the existing import.

**Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/useSolicitacoes.ts
git commit -m "feat(hooks): add useAssinaturas + useEnviarAssinatura for Certisign (#76)"
```

---

## Task 4: CertisignModal — Real Signatário Form

**Files:**
- Modify: `frontend/src/pages/contratos/SolicitacaoDetalhe.tsx` (lines 252-319)

**Context:** The current CertisignModal (lines 252-319) is a placeholder with an amber "em desenvolvimento" warning. Replace its contents with a real form. The modal receives `{ open, onClose, onConfirm, isPending }` — we need to change its interface to accept the solicitacao data and handle the webhook call internally.

**Step 1: Replace CertisignModal component**

Replace lines 252-319 in `SolicitacaoDetalhe.tsx` with the new component. The new CertisignModal needs:

- **Props change:** `{ open, onClose, solicitacao, minutaUrl, onSuccess }` instead of `{ open, onClose, onConfirm, isPending }`
- **State:** `signatarios` array (nome, email, cpf, papel), `tipoAssinatura` select
- **Form:** Dynamic list of signatário rows with add/remove
- **Submit:** Calls `useEnviarAssinatura().mutateAsync()`, then `onSuccess()` to advance etapa

```typescript
function CertisignModal({ open, onClose, solicitacao, minutaUrl, onSuccess }: {
  open: boolean
  onClose: () => void
  solicitacao: Solicitacao
  minutaUrl: string | null
  onSuccess: () => void
}) {
  const enviarAssinatura = useEnviarAssinatura()
  const [tipoAssinatura, setTipoAssinatura] = useState<'eletronica' | 'digital_icp'>('eletronica')
  const [signatarios, setSignatarios] = useState([
    { nome: '', email: '', cpf: '', papel: 'contratante' },
  ])
  const [erro, setErro] = useState('')

  if (!open) return null

  const addSignatario = () =>
    setSignatarios(prev => [...prev, { nome: '', email: '', cpf: '', papel: 'contratado' }])

  const removeSignatario = (idx: number) =>
    setSignatarios(prev => prev.filter((_, i) => i !== idx))

  const updateSignatario = (idx: number, field: string, value: string) =>
    setSignatarios(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))

  const canSubmit = minutaUrl && signatarios.every(s => s.nome && s.email && s.cpf)

  const handleSubmit = async () => {
    if (!minutaUrl) return setErro('Nenhuma minuta com arquivo disponível')
    setErro('')
    try {
      await enviarAssinatura.mutateAsync({
        solicitacao_id: solicitacao.id,
        minuta_url: minutaUrl,
        tipo_assinatura: tipoAssinatura,
        signatarios,
      })
      onSuccess()
      onClose()
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao enviar para assinatura')
    }
  }

  // ... render form UI (see implementation details below)
}
```

**UI Layout for the modal body:**

1. **Tipo de Assinatura** — select with 2 options: "Eletrônica" / "Digital ICP-Brasil"
2. **Signatários** — dynamic list, each row has:
   - Input: Nome (text)
   - Input: Email (email)
   - Input: CPF (text, masked)
   - Select: Papel (contratante, contratado, testemunha, interveniente)
   - Button: Remove (Trash2 icon, red) — hidden if only 1 signatário
3. **Button:** "+ Adicionar Signatário" (Plus icon)
4. **Error banner** if `erro` is set (red bg)
5. **Footer buttons:** "Cancelar" (slate) + "Enviar para Assinatura" (teal gradient, with spinner)

**Design patterns to follow:**
- Rounded-2xl inputs with `border-slate-200 focus:ring-2 focus:ring-teal-500/30`
- `text-xs font-semibold text-slate-500 uppercase tracking-wider` labels
- Same teal gradient button style as current modal
- Same modal overlay backdrop as current (fixed inset-0 bg-black/40 backdrop-blur-sm)
- Max-w-lg (wider than current max-w-md to fit form)

**Step 2: Update modal invocation**

At lines 803-811, update the `<CertisignModal>` usage:

```typescript
<CertisignModal
  open={showCertisignModal}
  onClose={() => setShowCertisignModal(false)}
  solicitacao={sol}
  minutaUrl={/* get latest minuta arquivo_url from useMinutas */}
  onSuccess={() => handleAvancar('arquivar')}
/>
```

This requires passing the latest minuta URL. The `useMinutas(sol.id)` hook is already called in the component — grab the latest minuta with `status === 'aprovado'` or the first one with `arquivo_url`.

**Step 3: Add imports**

Add to the imports section at top of file:
- `useEnviarAssinatura` from `'../../hooks/useSolicitacoes'`
- `Plus, Trash2, Users` from `'lucide-react'` (if not already imported)
- Types `Assinatura, TipoAssinatura` from `'../../types/contratos'`

**Step 4: Verify build**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/src/pages/contratos/SolicitacaoDetalhe.tsx
git commit -m "feat(certisign): replace placeholder modal with real signatário form (#76)"
```

---

## Task 5: Assinaturas Page — Consume `con_assinaturas`

**Files:**
- Modify: `frontend/src/pages/contratos/Assinaturas.tsx` (full rewrite of data layer)

**Context:** Currently (lines 40-91) the page builds items from `useSolicitacoes` + `useContratos`. After this change, it should ALSO pull from `con_assinaturas` to show real Certisign status per envelope.

**Step 1: Add import and hook call**

Add import at top:
```typescript
import { useSolicitacoes, useAssinaturasAll } from '../../hooks/useSolicitacoes'
```

Add hook call after existing hooks (line ~47):
```typescript
const { data: assinaturas = [], isLoading: loadingAss2 } = useAssinaturasAll()
```

Update `isLoading` to include `loadingAss2`.

**Step 2: Enhance item mapping**

When building the unified items list, cross-reference `assinaturas` to get real status:

```typescript
// For solicitacoes, check if there's a con_assinaturas record
...solicitacoes.map(s => {
  const ass = assinaturas.find(a => a.solicitacao_id === s.id)
  return {
    id: s.id,
    tipo: 'solicitacao' as const,
    numero: s.numero,
    objeto: s.objeto,
    contraparte: s.contraparte_nome,
    valor: s.valor_estimado ?? undefined,
    status: (ass?.status === 'enviado' ? 'enviado'
           : ass?.status === 'assinado' ? 'assinado'
           : ass?.status === 'recusado' ? 'recusado'
           : 'pendente') as StatusAssinatura,
    data: ass?.enviado_em ?? s.updated_at,
    assinatura: ass ?? null,
  }
}),
```

**Step 3: Add signatário badges to card**

In the card render (lines ~199-238), add a row showing signatário statuses when `item.assinatura` exists:

```typescript
{item.assinatura && item.assinatura.signatarios.length > 0 && (
  <div className="flex flex-wrap gap-1 mt-2">
    {item.assinatura.signatarios.map((sig, i) => (
      <span key={i} className={`text-[9px] font-semibold rounded-full px-2 py-0.5 ${
        sig.status === 'assinado' ? 'bg-emerald-50 text-emerald-600'
        : sig.status === 'recusado' ? 'bg-red-50 text-red-600'
        : 'bg-slate-100 text-slate-500'
      }`}>
        {sig.nome.split(' ')[0]} — {sig.status === 'assinado' ? 'Assinado' : sig.status === 'recusado' ? 'Recusado' : 'Pendente'}
      </span>
    ))}
  </div>
)}
```

**Step 4: Add "parcialmente_assinado" and "expirado" to STATUS_CFG**

Expand the `StatusAssinatura` type and `STATUS_CFG` (lines 17-24):

```typescript
type StatusAssinatura = 'pendente' | 'enviado' | 'parcialmente_assinado' | 'assinado' | 'recusado' | 'expirado'

// Add to STATUS_CFG:
parcialmente_assinado: { label: 'Parcial', dot: 'bg-cyan-400', bg: 'bg-cyan-50', text: 'text-cyan-700', icon: Clock },
expirado: { label: 'Expirado', dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600', icon: AlertTriangle },
```

Add matching filter buttons.

**Step 5: Add "documento assinado" link**

When `item.assinatura?.documento_assinado_url` exists, show a download link icon:

```typescript
{item.assinatura?.documento_assinado_url && (
  <a
    href={item.assinatura.documento_assinado_url}
    target="_blank"
    rel="noopener"
    onClick={e => e.stopPropagation()}
    className="text-teal-500 hover:text-teal-700"
    title="Download documento assinado"
  >
    <FileText size={14} />
  </a>
)}
```

**Step 6: Verify build + visual**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```

Then preview: navigate to `/contratos/assinaturas`, confirm page loads with new status types.

**Step 7: Commit**

```bash
git add frontend/src/pages/contratos/Assinaturas.tsx
git commit -m "feat(assinaturas): consume con_assinaturas for real Certisign status (#76)"
```

---

## Task 6: n8n Workflow — "Certisign - Enviar Assinatura"

**Files:**
- n8n workflow (created via MCP tools)

**Context:** n8n base URL is `https://teg-agents-n8n.nmmcas.easypanel.host/webhook`. Workflows are created via `mcp__n8n-mcp__n8n_create_workflow`. The Certisign API endpoints are at `https://api.portaldeassinaturas.com.br` (exact paths TBD — the workflow will be parametrized for easy adjustment).

**Step 1: Create workflow via n8n MCP**

Use `mcp__n8n-mcp__n8n_create_workflow` to create:

**Workflow name:** `Certisign - Enviar Assinatura`

**Nodes:**

1. **Webhook** (trigger): POST path `/certisign-enviar`, response mode "Last Node"
2. **HTTP Request — Download PDF**: GET `{{ $json.minuta_url }}` → binary output
3. **HTTP Request — Upload to Certisign**: POST `https://api.portaldeassinaturas.com.br/documents`
   - Auth: Header Auth `Authorization: Bearer {{credential}}`
   - Body: binary (PDF from step 2)
   - Response: `{ id: "doc_id" }`
4. **HTTP Request — Create Envelope**: POST `https://api.portaldeassinaturas.com.br/envelopes`
   - Auth: same Bearer
   - Body JSON: `{ document_id, signers: [...], callback_url, signature_type }`
   - Response: `{ id: "envelope_id", signers: [{ id, signing_url }] }`
5. **Code Node — Build signatarios JSONB**: Merge signer URLs from Certisign response with original signatarios array
6. **Supabase — INSERT con_assinaturas**: Insert record with status='enviado', envelope_id, signatarios JSONB
7. **Supabase — UPDATE con_solicitacoes**: SET `assinatura_status = 'enviado'` WHERE `id = solicitacao_id`
8. **Respond to Webhook**: 200 with `{ assinatura_id, envelope_id, status: 'enviado' }`

**Error path (from node 3 or 4):**
- **Supabase — INSERT con_assinaturas**: status='pendente' (record the attempt)
- **Respond to Webhook**: 500 with `{ error: message }`

**Step 2: Validate workflow**

Use `mcp__n8n-mcp__n8n_validate_workflow` with the workflow ID.

**Step 3: Document**

Add workflow ID to memory file for future reference.

---

## Task 7: n8n Workflow — "Certisign - Callback"

**Files:**
- n8n workflow (created via MCP tools)

**Step 1: Create workflow via n8n MCP**

**Workflow name:** `Certisign - Callback`

**Nodes:**

1. **Webhook** (trigger): POST path `/certisign-callback`, response mode "Last Node"
2. **Switch** — on `{{ $json.event_type }}`:
   - `signed` → branch "Assinado"
   - `refused` → branch "Recusado"
   - `expired` → branch "Expirado"
3. **Supabase — SELECT**: `SELECT * FROM con_assinaturas WHERE envelope_id = {{ $json.envelope_id }}`
4. **Code Node — Update signatário**: Find signatário by email in JSONB, update their status + assinado_em. Determine overall status (all signed → 'assinado', any refused → 'recusado', mixed → 'parcialmente_assinado').
5. **Supabase — UPDATE con_assinaturas**: SET status, signatarios, `webhook_log = webhook_log || [new_event]`
6. **IF** all signed:
   - **HTTP Request — Download signed PDF**: GET Certisign API `/documents/{id}/signed`
   - **Supabase Storage — Upload**: to `contratos-anexos` bucket
   - **Supabase — UPDATE con_assinaturas**: SET `documento_assinado_url`, `concluido_em`
   - **Supabase — UPDATE con_solicitacoes**: SET `etapa_atual = 'arquivar'`, `assinatura_status = 'assinado'`
7. **Respond to Webhook**: 200 OK

**Step 2: Validate workflow**

Use `mcp__n8n-mcp__n8n_validate_workflow`.

---

## Task 8: End-to-End Verification

**Step 1: Verify DB**

```sql
SELECT * FROM con_assinaturas LIMIT 1;
```

Confirm table is queryable.

**Step 2: Verify frontend build**

```bash
cd frontend && npx vite build
```

Must complete with no errors.

**Step 3: Preview verification**

- Navigate to `/contratos/solicitacoes/{any-id-at-enviar_assinatura-etapa}`
- Click "Enviar para Assinatura" → CertisignModal should show form
- Fill in 1 signatário → click "Enviar" → should POST to n8n (may fail if n8n not yet configured with real Certisign credentials, but the request should go out)
- Navigate to `/contratos/assinaturas` → should show new status types

**Step 4: Final commit + push**

```bash
git push -u origin feat/certisign-integration
```

Then create PR:
```bash
gh pr create --title "feat(contratos): Certisign digital signature integration (#76)" \
  --body "## Summary
- New \`con_assinaturas\` table tracking signature envelopes
- CertisignModal replaced with real signatário form
- Hooks: \`useEnviarAssinatura\`, \`useAssinaturas\`, \`useAssinaturasAll\`
- Assinaturas page shows real Certisign status per signatário
- 2 n8n workflows: Enviar Assinatura + Callback

## Test plan
- [ ] DB: con_assinaturas table exists with correct schema
- [ ] Frontend: CertisignModal shows form with signatários
- [ ] Frontend: Assinaturas page shows real status badges
- [ ] n8n: Enviar webhook accepts POST and returns response
- [ ] n8n: Callback webhook processes signature events

Closes #76"
```


## Links
- [[obsidian/27 - Módulo Contratos Gestão]]
