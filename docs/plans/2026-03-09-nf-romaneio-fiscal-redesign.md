# NF Romaneio + Fiscal Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single "Emitir NF-e" in Logistica Expedicao with smart "Emitir Romaneio" (MG->MG) / "Solicitar NF" (inter-state), auto-sync fiscal back to logistica, and redesign fiscal emission UI.

**Architecture:** Event-driven with DB triggers. Logistica detects UF from `log_solicitacoes.destino` vs `sys_obras.uf`. Romaneio generates a simple cargo document locally. "Solicitar NF" creates `fis_solicitacoes_nf` record linked via `solicitacao_log_id`. When fiscal emits, a DB trigger updates `log_solicitacoes` status and copies `danfe_url` back. Fiscal SolicitacaoNF gets a world-class UI with complete field set.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, Supabase (PostgreSQL), Tailwind CSS 3.4, jsPDF (new dep for Romaneio PDF)

---

## Task 1: DB Migration — Add romaneio status + sync trigger

**Files:**
- Create: `supabase/019_nf_romaneio_sync.sql`

**Step 1: Write and apply the migration**

```sql
-- 019_nf_romaneio_sync.sql
-- Adds romaneio_emitido status + auto-sync trigger from fiscal -> logistica

-- 1. Add 'romaneio_emitido' to log_status_solicitacao enum
ALTER TYPE log_status_solicitacao ADD VALUE IF NOT EXISTS 'romaneio_emitido' AFTER 'nfe_emitida';

-- 2. Add romaneio fields to log_solicitacoes
ALTER TABLE log_solicitacoes
  ADD COLUMN IF NOT EXISTS romaneio_url text,
  ADD COLUMN IF NOT EXISTS doc_fiscal_tipo text DEFAULT 'nenhum'
    CHECK (doc_fiscal_tipo IN ('nenhum', 'romaneio', 'nf'));

-- 3. Add danfe_url to log_solicitacoes for sync-back
ALTER TABLE log_solicitacoes
  ADD COLUMN IF NOT EXISTS danfe_url text;

-- 4. Add destination UF columns to fis_solicitacoes_nf for richer data
ALTER TABLE fis_solicitacoes_nf
  ADD COLUMN IF NOT EXISTS destinatario_cnpj text,
  ADD COLUMN IF NOT EXISTS destinatario_nome text,
  ADD COLUMN IF NOT EXISTS destinatario_uf text,
  ADD COLUMN IF NOT EXISTS emitente_cnpj text,
  ADD COLUMN IF NOT EXISTS emitente_nome text,
  ADD COLUMN IF NOT EXISTS items jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS valor_frete numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_seguro numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icms_base numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icms_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS info_complementar text,
  ADD COLUMN IF NOT EXISTS obra_id uuid REFERENCES sys_obras(id),
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES sys_empresas(id);

-- 5. Trigger: when fis_solicitacoes_nf status -> 'emitida', sync back to log_solicitacoes
CREATE OR REPLACE FUNCTION fis_sync_nf_to_logistica()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'emitida' AND OLD.status != 'emitida' AND NEW.solicitacao_log_id IS NOT NULL THEN
    UPDATE log_solicitacoes
    SET
      status = 'nfe_emitida',
      danfe_url = NEW.danfe_url,
      doc_fiscal_tipo = 'nf',
      updated_at = NOW()
    WHERE id = NEW.solicitacao_log_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_fis_sync_to_logistica ON fis_solicitacoes_nf;
CREATE TRIGGER trg_fis_sync_to_logistica
  AFTER UPDATE ON fis_solicitacoes_nf
  FOR EACH ROW
  EXECUTE FUNCTION fis_sync_nf_to_logistica();

-- 6. RLS policy for new columns (inherits existing table policies)
-- No new policies needed; existing RLS covers all columns
```

Apply via Supabase MCP `apply_migration`.

**Step 2: Verify migration applied**

Query `information_schema.columns` for `log_solicitacoes` to confirm `romaneio_url`, `doc_fiscal_tipo`, `danfe_url` exist.
Query `information_schema.columns` for `fis_solicitacoes_nf` to confirm new columns.
Query `pg_trigger` for `trg_fis_sync_to_logistica`.

---

## Task 2: Install jsPDF + Update Types

**Files:**
- Modify: `frontend/package.json` (install jsPDF)
- Modify: `frontend/src/types/logistica.ts`
- Modify: `frontend/src/types/solicitacaoNF.ts`

**Step 1: Install jsPDF**

```bash
cd /c/teg-plus/frontend && npm install jspdf
```

**Step 2: Update logistica types**

Add to `frontend/src/types/logistica.ts`:

```typescript
// After StatusNFe type, add:
export type DocFiscalTipo = 'nenhum' | 'romaneio' | 'nf'

// Update LogSolicitacao interface to include new fields:
// (add these fields to the existing interface)
//   romaneio_url?: string
//   doc_fiscal_tipo?: DocFiscalTipo
//   danfe_url?: string
```

**Step 3: Update solicitacaoNF types**

Add new fields to `CriarSolicitacaoPayload` in `frontend/src/types/solicitacaoNF.ts`:

```typescript
// Add to CriarSolicitacaoPayload:
//   destinatario_cnpj?: string
//   destinatario_nome?: string
//   destinatario_uf?: string
//   emitente_cnpj?: string
//   emitente_nome?: string
//   items?: Array<{ descricao: string; quantidade: number; unidade: string; valor_unitario?: number }>
//   valor_frete?: number
//   valor_seguro?: number
//   valor_desconto?: number
//   icms_base?: number
//   icms_valor?: number
//   info_complementar?: string
//   obra_id?: string
//   empresa_id?: string
```

Add to `SolicitacaoNF` interface the same fields + `EmitirNFPayload` gets `danfe_url?` field.

---

## Task 3: New Hook — useEmitirRomaneio + useSolicitarNFFiscal

**Files:**
- Modify: `frontend/src/hooks/useLogistica.ts`

**Step 1: Add useEmitirRomaneio hook**

After `useEmitirNFe()`, add:

```typescript
export function useEmitirRomaneio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitacao_id: string
      romaneio_url: string  // blob URL or Supabase storage URL
    }) => {
      const { data, error } = await supabase
        .from('log_solicitacoes')
        .update({
          status: 'romaneio_emitido',
          romaneio_url: payload.romaneio_url,
          doc_fiscal_tipo: 'romaneio',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.solicitacao_id)
        .select()
        .single()
      if (error) throw error
      return data as LogSolicitacao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
    },
  })
}
```

**Step 2: Add useSolicitarNFFiscal hook**

```typescript
export function useSolicitarNFFiscal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      solicitacao_id: string
      fornecedor_cnpj?: string
      fornecedor_nome: string
      valor_total: number
      cfop?: string
      natureza_operacao?: string
      descricao?: string
      destinatario_cnpj?: string
      destinatario_nome?: string
      destinatario_uf?: string
      emitente_cnpj?: string
      emitente_nome?: string
      items?: any[]
      obra_id?: string
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { solicitacao_id, ...rest } = payload

      // 1. Create fiscal solicitation
      const { data, error } = await supabase
        .from('fis_solicitacoes_nf')
        .insert({
          ...rest,
          solicitacao_log_id: solicitacao_id,
          origem: 'logistica',
          status: 'pendente',
          solicitado_por: user?.id,
        })
        .select()
        .single()
      if (error) throw error

      // 2. Update log_solicitacoes to indicate NF was requested
      await supabase
        .from('log_solicitacoes')
        .update({
          doc_fiscal_tipo: 'nf',
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitacao_id)

      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['log_solicitacoes'] })
      qc.invalidateQueries({ queryKey: ['solicitacoes-nf'] })
    },
  })
}
```

---

## Task 4: Romaneio PDF Generator Utility

**Files:**
- Create: `frontend/src/utils/romaneio-pdf.ts`

**Step 1: Create the PDF generator**

Uses jsPDF to generate a simple cargo romaneio with:
- Header: company logo area, "ROMANEIO DE CARGA", sequential number
- Origin/Destination block
- Items table (descricao, qtd, unidade, peso)
- Driver/vehicle info
- Signature line
- Footer with date/time

```typescript
import jsPDF from 'jspdf'

interface RomaneioData {
  numero: string
  origem: string
  destino: string
  obra_nome?: string
  motorista_nome?: string
  veiculo_placa?: string
  itens: Array<{ descricao: string; quantidade: number; unidade: string; peso_kg?: number }>
  peso_total_kg?: number
  volumes_total?: number
  observacoes?: string
  data: string
}

export function gerarRomaneioPDF(data: RomaneioData): string {
  const doc = new jsPDF()
  // ... full implementation with professional layout
  // Returns blob URL
  return doc.output('bloburl').toString()
}
```

---

## Task 5: Redesign Logistica Expedicao Page

**Files:**
- Modify: `frontend/src/pages/logistica/Expedicao.tsx`

**Key changes:**
1. Remove the old "Emitir NF-e" modal entirely
2. Add UF detection logic (compare destino with 'MG' — all obras except SEDE are MG)
3. Show conditional buttons:
   - "Emitir Romaneio" (blue, scroll icon) when same-state
   - "Solicitar NF" (violet, file icon) when inter-state
4. Add Romaneio modal (simple: items preview, driver info, generate PDF)
5. Add Solicitar NF modal (pre-fills data from solicitacao, sends to fiscal)
6. Update status display: show `romaneio_emitido` as valid for dispatch
7. Update dispatch rule: allow dispatch when `romaneio_emitido` OR `nfe_emitida`
8. Show DANFE/Romaneio link when available (danfe_url or romaneio_url)

The UF detection is simple:
- Parse `s.destino` text to extract city/state
- If destino contains "MG" or matches known MG obras → same state → Romaneio
- Otherwise → Solicitar NF
- Always show both options with a smart default highlighted

---

## Task 6: Redesign Fiscal SolicitacaoNF Page

**Files:**
- Modify: `frontend/src/pages/fiscal/SolicitacaoNF.tsx`
- Modify: `frontend/src/hooks/useSolicitacoesNF.ts`

**Key changes to SolicitacaoNF.tsx:**
1. Expand the EmissionForm with complete field set:
   - Section 1: Emitente (CNPJ, Razao Social) — pre-filled from empresa config
   - Section 2: Destinatario (CNPJ, Razao Social, UF) — pre-filled from solicitation
   - Section 3: Items table (descricao, qtd, unidade, valor unitario, subtotal)
   - Section 4: Valores (total produtos, frete, seguro, desconto, ICMS base/valor, total NF)
   - Section 5: NF Data (numero, serie, chave acesso, data emissao, CFOP, natureza operacao)
   - Section 6: Info Complementar (textarea)
2. Progressive disclosure: sections collapse/expand, advanced fields hidden by default
3. Smart defaults: CFOP auto-suggested (5.949 intra-state, 6.949 inter-state)
4. Real-time total calculation
5. DANFE upload field (after emission)
6. Better card design matching world-class standards

**Key changes to useSolicitacoesNF.ts:**
1. Update `useEmitirNF` payload to include all new fields
2. Add `useUploadDANFE` hook for file upload after emission
3. Update SELECT_SOL to include new joined data (obra, empresa)

---

## Task 7: Build, Test & Deploy

**Step 1: Build**
```bash
cd /c/teg-plus/frontend && npm run build
```

**Step 2: Manual verification**
- Login to app
- Go to Logistica > Expedicao
- Verify Romaneio/Solicitar NF buttons appear correctly
- Test Romaneio PDF generation
- Test Solicitar NF flow → verify it appears in Fiscal
- Go to Fiscal > Solicitacao NF
- Verify expanded emission form with all fields
- Test complete emission flow
- Verify auto-sync back to Logistica

**Step 3: Commit & Push**
```bash
git add -A
git commit -m "feat(logistica+fiscal): romaneio/NF split + fiscal UI redesign + auto-sync"
git push origin main
```
