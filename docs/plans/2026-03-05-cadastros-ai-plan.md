# Cadastros AI-Powered Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified, AI-powered master data management module (Cadastros) accessible from all TEG+ ERP modules via a gear icon.

**Architecture:** New `/cadastros` route group with CadastrosLayout (violet theme). Reusable MagicModal component with AI/Manual toggle using n8n webhooks for document parsing and CNPJ/CPF lookup. Gear icon added to all 7 existing module layouts. 3 new DB tables + CRUD for 6 entities.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3.4, TanStack Query v5, Supabase (PostgreSQL + RLS), n8n webhooks, Lucide icons.

**Design Doc:** `docs/plans/2026-03-05-cadastros-ai-design.md`

---

## Phase 1: Foundation (DB + Types + Hooks)

### Task 1: Database Migration — New Master Tables

**Files:**
- Create: `supabase/025_cadastros_master.sql`

**Step 1: Write the migration SQL**

Create `supabase/025_cadastros_master.sql` with:

```sql
-- 025 — Cadastros Master Tables
-- TEG+ ERP — 2026-03-05

-- 1. fin_classes_financeiras
CREATE TABLE IF NOT EXISTS fin_classes_financeiras (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  descricao   text NOT NULL,
  tipo        text CHECK (tipo IN ('receita', 'despesa', 'ambos')) DEFAULT 'ambos',
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fin_classes_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_classes_all" ON fin_classes_financeiras
  FOR ALL USING (auth.role() = 'authenticated');

-- 2. sys_centros_custo
CREATE TABLE IF NOT EXISTS sys_centros_custo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  descricao   text NOT NULL,
  obra_id     uuid REFERENCES sys_obras(id),
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sys_centros_custo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sys_centros_custo_all" ON sys_centros_custo
  FOR ALL USING (auth.role() = 'authenticated');

-- 3. rh_colaboradores
CREATE TABLE IF NOT EXISTS rh_colaboradores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  cpf             text UNIQUE,
  cargo           text,
  departamento    text,
  obra_id         uuid REFERENCES sys_obras(id),
  email           text,
  telefone        text,
  data_admissao   date,
  ativo           boolean NOT NULL DEFAULT true,
  foto_url        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rh_colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rh_colaboradores_all" ON rh_colaboradores
  FOR ALL USING (auth.role() = 'authenticated');

-- Triggers updated_at
CREATE OR REPLACE FUNCTION cad_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fin_classes_updated BEFORE UPDATE ON fin_classes_financeiras
  FOR EACH ROW EXECUTE FUNCTION cad_set_updated_at();
CREATE TRIGGER trg_sys_centros_custo_updated BEFORE UPDATE ON sys_centros_custo
  FOR EACH ROW EXECUTE FUNCTION cad_set_updated_at();
CREATE TRIGGER trg_rh_colaboradores_updated BEFORE UPDATE ON rh_colaboradores
  FOR EACH ROW EXECUTE FUNCTION cad_set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fin_classes_tipo ON fin_classes_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_sys_cc_obra ON sys_centros_custo(obra_id);
CREATE INDEX IF NOT EXISTS idx_rh_colab_obra ON rh_colaboradores(obra_id);
CREATE INDEX IF NOT EXISTS idx_rh_colab_depto ON rh_colaboradores(departamento);
```

**Step 2: Apply migration to Supabase**

Use MCP tool `apply_migration` with project_id `uzfjfucrinokeuwpbeie`, name `025_cadastros_master`, and the SQL above.

**Step 3: Verify tables created**

Run SQL: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('fin_classes_financeiras', 'sys_centros_custo', 'rh_colaboradores');`
Expected: 3 rows returned.

**Step 4: Save migration file locally and commit**

```bash
git add supabase/025_cadastros_master.sql
git commit -m "feat(db): add master tables for cadastros module"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `frontend/src/types/cadastros.ts`

**Step 1: Create types file**

```typescript
// ── Cadastros Types ────────────────────────────────────────────────────────

// Re-export existing types used in cadastros
export type { Fornecedor } from './financeiro'
export type { EstItem } from './estoque'

// ── Classes Financeiras ────────────────────────────────────────────────────
export interface ClasseFinanceira {
  id: string
  codigo: string
  descricao: string
  tipo: 'receita' | 'despesa' | 'ambos'
  ativo: boolean
  created_at: string
  updated_at: string
}

// ── Centros de Custo ───────────────────────────────────────────────────────
export interface CentroCusto {
  id: string
  codigo: string
  descricao: string
  obra_id?: string
  ativo: boolean
  created_at: string
  updated_at: string
  // Joins
  obra?: { id: string; codigo: string; nome: string }
}

// ── Obras (extends existing sys_obras) ─────────────────────────────────────
export interface Obra {
  id: string
  codigo: string
  nome: string
  municipio?: string
  uf?: string
  status?: string
  responsavel_nome?: string
  responsavel_email?: string
  created_at: string
  updated_at: string
}

// ── Colaboradores ──────────────────────────────────────────────────────────
export interface Colaborador {
  id: string
  nome: string
  cpf?: string
  cargo?: string
  departamento?: string
  obra_id?: string
  email?: string
  telefone?: string
  data_admissao?: string
  ativo: boolean
  foto_url?: string
  created_at: string
  updated_at: string
  // Joins
  obra?: { id: string; codigo: string; nome: string }
}

// ── AI Parse Result (cadastros-specific) ───────────────────────────────────
export interface AiCadastroField {
  value: any
  confidence: number  // 0-1
}

export interface AiCadastroResult {
  fields: Record<string, AiCadastroField>
  detected_entity?: string
}

// ── Dashboard Stats ────────────────────────────────────────────────────────
export interface CadastroStats {
  entity: string
  label: string
  icon: string
  count: number
  route: string
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add frontend/src/types/cadastros.ts
git commit -m "feat(types): add cadastros module type definitions"
```

---

### Task 3: Hooks — useCadastros

**Files:**
- Create: `frontend/src/hooks/useCadastros.ts`

**Step 1: Create the hooks file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { Fornecedor } from '../types/financeiro'
import type {
  ClasseFinanceira, CentroCusto, Obra, Colaborador, AiCadastroResult,
} from '../types/cadastros'

// ── Fornecedores ────────────────────────────────────────────────────────────
export function useCadFornecedores(filtros?: { ativo?: boolean }) {
  return useQuery<Fornecedor[]>({
    queryKey: ['cad-fornecedores', filtros],
    queryFn: async () => {
      let q = supabase.from('cmp_fornecedores').select('*').order('razao_social')
      if (filtros?.ativo !== undefined) q = q.eq('ativo', filtros.ativo)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as Fornecedor[]
    },
  })
}

export function useSalvarFornecedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Fornecedor> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('cmp_fornecedores').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cmp_fornecedores').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cad-fornecedores'] })
      qc.invalidateQueries({ queryKey: ['fornecedores'] }) // legacy key from useFinanceiro
    },
  })
}

// ── Classes Financeiras ─────────────────────────────────────────────────────
export function useCadClasses(filtros?: { tipo?: string }) {
  return useQuery<ClasseFinanceira[]>({
    queryKey: ['cad-classes', filtros],
    queryFn: async () => {
      let q = supabase.from('fin_classes_financeiras').select('*').order('codigo')
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ClasseFinanceira[]
    },
  })
}

export function useSalvarClasse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ClasseFinanceira> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('fin_classes_financeiras').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fin_classes_financeiras').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cad-classes'] }),
  })
}

// ── Centros de Custo ────────────────────────────────────────────────────────
export function useCadCentrosCusto() {
  return useQuery<CentroCusto[]>({
    queryKey: ['cad-centros-custo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_centros_custo')
        .select('*, obra:sys_obras!obra_id(id, codigo, nome)')
        .order('codigo')
      if (error) return []
      return (data ?? []) as CentroCusto[]
    },
  })
}

export function useSalvarCentroCusto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<CentroCusto> & { id?: string }) => {
      const { id, obra, ...rest } = payload as any
      if (id) {
        const { error } = await supabase.from('sys_centros_custo').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sys_centros_custo').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cad-centros-custo'] }),
  })
}

// ── Obras ───────────────────────────────────────────────────────────────────
export function useCadObras() {
  return useQuery<Obra[]>({
    queryKey: ['cad-obras'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sys_obras').select('*').order('nome')
      if (error) return []
      return (data ?? []) as Obra[]
    },
  })
}

export function useSalvarObra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Obra> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('sys_obras').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sys_obras').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cad-obras'] })
      qc.invalidateQueries({ queryKey: ['obras'] }) // legacy key
    },
  })
}

// ── Colaboradores ───────────────────────────────────────────────────────────
export function useCadColaboradores(filtros?: { obra_id?: string; departamento?: string }) {
  return useQuery<Colaborador[]>({
    queryKey: ['cad-colaboradores', filtros],
    queryFn: async () => {
      let q = supabase
        .from('rh_colaboradores')
        .select('*, obra:sys_obras!obra_id(id, codigo, nome)')
        .order('nome')
      if (filtros?.obra_id) q = q.eq('obra_id', filtros.obra_id)
      if (filtros?.departamento) q = q.eq('departamento', filtros.departamento)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as Colaborador[]
    },
  })
}

export function useSalvarColaborador() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Colaborador> & { id?: string }) => {
      const { id, obra, ...rest } = payload as any
      if (id) {
        const { error } = await supabase.from('rh_colaboradores').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('rh_colaboradores').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cad-colaboradores'] }),
  })
}

// ── AI Cadastro Parse ───────────────────────────────────────────────────────
export function useAiCadastroParse() {
  return useMutation({
    mutationFn: async (vars: {
      entity_type: string
      input_type: 'cnpj' | 'cpf' | 'file' | 'text'
      content: string
      base64?: string
      filename?: string
    }): Promise<AiCadastroResult> => {
      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

      // CNPJ lookup — direct API (no n8n needed)
      if (vars.input_type === 'cnpj') {
        const clean = vars.content.replace(/\D/g, '')
        if (clean.length !== 14) throw new Error('CNPJ deve ter 14 digitos')
        try {
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`)
          if (!res.ok) throw new Error('CNPJ nao encontrado')
          const d = await res.json()
          return {
            fields: {
              razao_social:       { value: d.razao_social, confidence: 0.99 },
              nome_fantasia:      { value: d.nome_fantasia || '', confidence: d.nome_fantasia ? 0.99 : 0.3 },
              cnpj:               { value: clean, confidence: 1 },
              endereco:           { value: `${d.logradouro}, ${d.numero} ${d.complemento || ''}`.trim(), confidence: 0.95 },
              cidade:             { value: d.municipio, confidence: 0.99 },
              uf:                 { value: d.uf, confidence: 0.99 },
              cep:                { value: d.cep?.replace(/\D/g, '') || '', confidence: 0.95 },
              telefone:           { value: d.ddd_telefone_1 || '', confidence: d.ddd_telefone_1 ? 0.9 : 0.2 },
              email:              { value: d.email || '', confidence: d.email ? 0.85 : 0.1 },
            },
          }
        } catch {
          throw new Error('Nao foi possivel consultar o CNPJ. Verifique e tente novamente.')
        }
      }

      // n8n webhook for files and complex AI parsing
      if (n8nUrl && (vars.input_type === 'file' || vars.input_type === 'text')) {
        try {
          const res = await fetch(`${n8nUrl}/cadastros/ai-parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vars),
          })
          if (!res.ok) throw new Error('AI parse failed')
          return await res.json() as AiCadastroResult
        } catch {
          if (vars.input_type === 'file') {
            throw new Error('Processamento de arquivos requer o servico de IA. Tente digitar manualmente.')
          }
          // Fallback for text — basic regex
        }
      }

      // Fallback: basic regex extraction
      return extractBasicFields(vars.content)
    },
  })
}

function extractBasicFields(text: string): AiCadastroResult {
  const fields: Record<string, { value: string; confidence: number }> = {}
  const cnpjMatch = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
  if (cnpjMatch) fields.cnpj = { value: cnpjMatch[0].replace(/\D/g, ''), confidence: 0.9 }
  const cpfMatch = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)
  if (cpfMatch) fields.cpf = { value: cpfMatch[0].replace(/\D/g, ''), confidence: 0.9 }
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/)
  if (emailMatch) fields.email = { value: emailMatch[0], confidence: 0.85 }
  const phoneMatch = text.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/)
  if (phoneMatch) fields.telefone = { value: phoneMatch[0], confidence: 0.8 }
  return { fields }
}
```

**Step 2: Verify TypeScript**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add frontend/src/hooks/useCadastros.ts
git commit -m "feat(hooks): add useCadastros with CRUD + AI parse for all entities"
```

---

## Phase 2: Shared Components

### Task 4: ConfidenceField Component

**Files:**
- Create: `frontend/src/components/ConfidenceField.tsx`

**Step 1: Create component**

A form input wrapper that shows AI confidence level via left border color and optional badge.

```typescript
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'

interface ConfidenceFieldProps {
  label: string
  value: string | number
  onChange: (v: string) => void
  confidence?: number        // 0-1, undefined = no AI (normal field)
  type?: 'text' | 'number' | 'date' | 'email' | 'tel'
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

export default function ConfidenceField({
  label, value, onChange, confidence, type = 'text',
  placeholder, required, disabled,
}: ConfidenceFieldProps) {
  const hasConfidence = confidence !== undefined

  const borderColor = !hasConfidence ? 'border-l-transparent'
    : confidence >= 0.9 ? 'border-l-emerald-400'
    : confidence >= 0.7 ? 'border-l-amber-400'
    : 'border-l-rose-400'

  const bgColor = !hasConfidence ? ''
    : confidence >= 0.9 ? ''
    : confidence >= 0.7 ? 'bg-amber-50/50'
    : 'bg-rose-50/50'

  const ConfIcon = !hasConfidence ? null
    : confidence >= 0.9 ? CheckCircle2
    : confidence >= 0.7 ? AlertTriangle
    : AlertCircle

  const confColor = !hasConfidence ? ''
    : confidence >= 0.9 ? 'text-emerald-500'
    : confidence >= 0.7 ? 'text-amber-500'
    : 'text-rose-500'

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs font-bold text-slate-600">
          {label}{required && ' *'}
        </label>
        {hasConfidence && ConfIcon && (
          <span className={`flex items-center gap-0.5 text-[9px] font-semibold ${confColor}`}>
            <ConfIcon size={10} />
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-base border-l-4 ${borderColor} ${bgColor} transition-all`}
      />
    </div>
  )
}
```

**Step 2: Verify compiles**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add frontend/src/components/ConfidenceField.tsx
git commit -m "feat(ui): add ConfidenceField component with AI confidence indicators"
```

---

### Task 5: AiDropZone Component

**Files:**
- Create: `frontend/src/components/AiDropZone.tsx`

**Step 1: Create component**

Drop zone that accepts files, pasted text/CNPJ, and triggers AI parsing.

```typescript
import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Search, Loader2, Sparkles } from 'lucide-react'

interface AiDropZoneProps {
  onParse: (input: { type: 'cnpj' | 'cpf' | 'file' | 'text'; content: string; base64?: string; filename?: string }) => void
  parsing: boolean
  entityLabel: string       // "Fornecedor", "Item", etc.
  showCnpjField?: boolean   // show CNPJ input (fornecedores)
  showCpfField?: boolean    // show CPF input (colaboradores)
}

export default function AiDropZone({
  onParse, parsing, entityLabel, showCnpjField, showCpfField,
}: AiDropZoneProps) {
  const [dragOver, setDragOver] = useState(false)
  const [docInput, setDocInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    onParse({ type: 'file', content: file.name, base64, filename: file.name })
  }, [onParse])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const base64 = await fileToBase64(file)
    onParse({ type: 'file', content: file.name, base64, filename: file.name })
  }, [onParse])

  function handleDocSubmit() {
    const clean = docInput.replace(/\D/g, '')
    if (showCnpjField && clean.length === 14) {
      onParse({ type: 'cnpj', content: clean })
    } else if (showCpfField && clean.length === 11) {
      onParse({ type: 'cpf', content: clean })
    } else if (docInput.trim().length > 3) {
      onParse({ type: 'text', content: docInput.trim() })
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all duration-200 group
          ${dragOver
            ? 'border-violet-400 bg-violet-50 scale-[1.02]'
            : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'
          }
          ${parsing ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx,.xls,.txt"
          onChange={handleFileSelect} />

        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
              <Loader2 size={22} className="text-white animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Processando com IA...</p>
              <p className="text-xs text-slate-400 mt-0.5">Analisando documento</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500
              flex items-center justify-center shadow-lg shadow-violet-500/20
              group-hover:shadow-violet-500/30 transition-shadow">
              <Upload size={22} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">
                Arraste um documento aqui
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                PDF, imagem, planilha ou clique para selecionar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] font-bold text-slate-400 uppercase">ou</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Document input (CNPJ/CPF/text) */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400" />
          <input
            value={docInput}
            onChange={e => setDocInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDocSubmit()}
            placeholder={
              showCnpjField ? 'Cole um CNPJ ou digite informacoes...'
                : showCpfField ? 'Cole um CPF ou digite informacoes...'
                : `Informacoes do ${entityLabel}...`
            }
            className="input-base pl-9"
            disabled={parsing}
          />
        </div>
        <button
          onClick={handleDocSubmit}
          disabled={parsing || docInput.trim().length < 3}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm
            font-semibold transition-colors disabled:opacity-40 shadow-sm flex items-center gap-1.5"
        >
          <Search size={14} />
          Buscar
        </button>
      </div>
    </div>
  )
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

**Step 2: Verify compiles, commit**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
git add frontend/src/components/AiDropZone.tsx
git commit -m "feat(ui): add AiDropZone component with drag-drop, paste, file select"
```

---

### Task 6: MagicModal Component

**Files:**
- Create: `frontend/src/components/MagicModal.tsx`

**Step 1: Create component**

The central Magic Modal with AI/Manual toggle. This is a wrapper that child pages use by passing their specific form fields.

```typescript
import { useState, useEffect } from 'react'
import { X, Save, Loader2, Sparkles, Pencil } from 'lucide-react'
import AiDropZone from './AiDropZone'
import type { AiCadastroResult } from '../types/cadastros'

type Mode = 'ai' | 'manual'

interface MagicModalProps {
  title: string
  isNew: boolean
  aiEnabled?: boolean
  showCnpjField?: boolean
  showCpfField?: boolean
  entityLabel: string
  onClose: () => void
  onSave: () => void
  saving: boolean
  onAiParse: (input: { type: string; content: string; base64?: string; filename?: string }) => void
  aiParsing: boolean
  children: React.ReactNode  // the actual form fields
}

export default function MagicModal({
  title, isNew, aiEnabled = true, showCnpjField, showCpfField,
  entityLabel, onClose, onSave, saving,
  onAiParse, aiParsing, children,
}: MagicModalProps) {
  const [mode, setMode] = useState<Mode>(isNew && aiEnabled ? 'ai' : 'manual')

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
            {aiEnabled && (
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setMode('ai')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    mode === 'ai'
                      ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Sparkles size={12} /> AI
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                    mode === 'manual'
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Pencil size={12} /> Manual
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {mode === 'ai' && aiEnabled ? (
            <AiDropZone
              onParse={onAiParse}
              parsing={aiParsing}
              entityLabel={entityLabel}
              showCnpjField={showCnpjField}
              showCpfField={showCpfField}
            />
          ) : null}

          {/* Form fields are always rendered (visible in manual mode, below AI result in AI mode) */}
          <div className={mode === 'ai' && !aiParsing ? 'mt-0' : 'mt-0'}>
            {(mode === 'manual' || aiParsing === false) && (
              <div className={mode === 'ai' ? 'mt-6 pt-6 border-t border-slate-100' : ''}>
                {children}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify and commit**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
git add frontend/src/components/MagicModal.tsx
git commit -m "feat(ui): add MagicModal with AI/Manual toggle for cadastros"
```

---

## Phase 3: Layout & Routing

### Task 7: CadastrosLayout

**Files:**
- Create: `frontend/src/components/CadastrosLayout.tsx`

**Step 1: Create layout**

Follow exact pattern from FinanceiroLayout.tsx but with violet color scheme and a "Voltar" button instead of module badge.

NAV items:
```typescript
const NAV = [
  { to: '/cadastros',               icon: LayoutDashboard,  label: 'Painel',       end: true  },
  { to: '/cadastros/fornecedores',  icon: Building2,        label: 'Fornecedores', end: false },
  { to: '/cadastros/itens',         icon: Package2,         label: 'Itens',        end: false },
  { to: '/cadastros/classes',       icon: Tag,              label: 'Classes Fin.', end: false },
  { to: '/cadastros/centros-custo', icon: Target,           label: 'C. Custo',     end: false },
  { to: '/cadastros/obras',         icon: HardHat,          label: 'Obras',        end: false },
  { to: '/cadastros/colaboradores', icon: Users,            label: 'Colaboradores',end: false },
]
```

Color substitutions from FinanceiroLayout (emerald -> violet):
- `bg-emerald-50` -> `bg-violet-50`
- `text-emerald-700` -> `text-violet-700`
- `border-emerald-200` -> `border-violet-200`
- `bg-emerald-500/15` -> `bg-violet-500/15`
- `text-emerald-300` -> `text-violet-300`
- `border-emerald-500/25` -> `border-violet-500/25`

Module badge: emoji `⚙️`, text "Cadastros", subtitle "Configuracoes".

The header "Voltar" button uses `navigate(-1)` to go back to the module that opened Cadastros.

Icons to import: `LayoutDashboard, Building2, Package2, Tag, Target, HardHat, Users, LogOut, LayoutGrid, ArrowLeft`

**Step 2: Copy FinanceiroLayout.tsx as base, apply all substitutions**

Follow the exact same structure: desktop sidebar, mobile header, mobile bottom nav, avatar section, theme toggle.

**Step 3: Verify and commit**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
git add frontend/src/components/CadastrosLayout.tsx
git commit -m "feat(layout): add CadastrosLayout with violet theme"
```

---

### Task 8: Routes in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Add imports**

Add at the top of App.tsx after existing imports:

```typescript
// Modulo Cadastros
import CadastrosLayout from './components/CadastrosLayout'
import CadastrosHome from './pages/cadastros/CadastrosHome'
import FornecedoresCad from './pages/cadastros/FornecedoresCad'
import ItensCad from './pages/cadastros/ItensCad'
import ClassesFinanceiras from './pages/cadastros/ClassesFinanceiras'
import CentrosCusto from './pages/cadastros/CentrosCusto'
import ObrasCad from './pages/cadastros/ObrasCad'
import ColaboradoresCad from './pages/cadastros/ColaboradoresCad'
```

**Step 2: Add routes**

Inside the `<Route element={<PrivateRoute />}>` block, add after the Contratos routes (after line 150):

```tsx
{/* Modulo Cadastros: usa CadastrosLayout */}
<Route element={<CadastrosLayout />}>
  <Route path="/cadastros"               element={<CadastrosHome />} />
  <Route path="/cadastros/fornecedores"  element={<FornecedoresCad />} />
  <Route path="/cadastros/itens"         element={<ItensCad />} />
  <Route path="/cadastros/classes"       element={<ClassesFinanceiras />} />
  <Route path="/cadastros/centros-custo" element={<CentrosCusto />} />
  <Route path="/cadastros/obras"         element={<ObrasCad />} />
  <Route path="/cadastros/colaboradores" element={<ColaboradoresCad />} />
</Route>
```

**Step 3: Verify and commit**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
git add frontend/src/App.tsx
git commit -m "feat(routes): add /cadastros/* routes"
```

---

### Task 9: Add Gear Icon to ALL Module Layouts

**Files to modify (7 files):**
- `frontend/src/components/FinanceiroLayout.tsx` — NAV line 19 area
- `frontend/src/components/EstoqueLayout.tsx` — NAV line 17 area
- `frontend/src/components/LogisticaLayout.tsx` — NAV line 18 area
- `frontend/src/components/FrotasLayout.tsx` — NAV line 17 area
- `frontend/src/components/RHLayout.tsx` — NAV line 19 area
- `frontend/src/components/ContratosLayout.tsx` — NAV line 16 area
- `frontend/src/components/Layout.tsx` (Compras) — NAV line 18 area

**Step 1: For each layout file, add `Settings` to lucide imports and add a Cadastros entry at the end of the NAV array**

Pattern — add as last NAV item (BEFORE the `]`):

```typescript
{ to: '/cadastros', icon: Settings, label: 'Cadastros', end: false },
```

Make sure `Settings` is imported from `lucide-react`. FinanceiroLayout already imports it (line 5). For others, add it.

**Step 2: Verify all imports are correct across all 7 files**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
```

**Step 3: Commit all layout changes together**

```bash
git add frontend/src/components/FinanceiroLayout.tsx \
  frontend/src/components/EstoqueLayout.tsx \
  frontend/src/components/LogisticaLayout.tsx \
  frontend/src/components/FrotasLayout.tsx \
  frontend/src/components/RHLayout.tsx \
  frontend/src/components/ContratosLayout.tsx \
  frontend/src/components/Layout.tsx
git commit -m "feat(nav): add Cadastros gear icon to all module sidebars"
```

---

## Phase 4: Pages

### Task 10: CadastrosHome — Dashboard

**Files:**
- Create: `frontend/src/pages/cadastros/CadastrosHome.tsx`

**Step 1: Create dashboard page**

Entity overview cards with counts + "Novo" buttons. Uses:
- `useCadFornecedores` for count
- `useCadClasses` for count
- `useCadCentrosCusto` for count
- `useCadObras` for count
- `useCadColaboradores` for count

Pattern: grid of cards (3 cols desktop, 2 mobile), each card has icon, count, label, "Novo" button.
Color: violet accents.

Entity cards data:
```typescript
const ENTITIES = [
  { key: 'fornecedores', label: 'Fornecedores', icon: Building2, route: '/cadastros/fornecedores', color: 'emerald' },
  { key: 'itens',        label: 'Itens',        icon: Package2,  route: '/cadastros/itens',        color: 'blue' },
  { key: 'classes',      label: 'Classes Fin.',  icon: Tag,       route: '/cadastros/classes',       color: 'amber' },
  { key: 'centros',      label: 'Centros Custo', icon: Target,    route: '/cadastros/centros-custo', color: 'cyan' },
  { key: 'obras',        label: 'Obras',         icon: HardHat,   route: '/cadastros/obras',         color: 'indigo' },
  { key: 'colaboradores',label: 'Colaboradores', icon: Users,     route: '/cadastros/colaboradores', color: 'rose' },
]
```

Each card: `bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-all cursor-pointer group`

**Step 2: Verify and commit**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
git add frontend/src/pages/cadastros/CadastrosHome.tsx
git commit -m "feat(cadastros): add CadastrosHome dashboard with entity cards"
```

---

### Task 11: FornecedoresCad — CRUD with AI

**Files:**
- Create: `frontend/src/pages/cadastros/FornecedoresCad.tsx`

**Step 1: Create page**

Follows Itens.tsx pattern but uses:
- `useCadFornecedores()` for list
- `useSalvarFornecedor()` for save
- `useAiCadastroParse()` for AI
- `MagicModal` with `aiEnabled`, `showCnpjField`
- `ConfidenceField` for form fields when AI result exists
- Card-based list (from Fornecedores.tsx pattern, NOT table)

EMPTY_FORM:
```typescript
const EMPTY: Partial<Fornecedor> = {
  razao_social: '', nome_fantasia: '', cnpj: '', inscricao_estadual: '',
  endereco: '', cidade: '', uf: '', cep: '',
  telefone: '', email: '', contato_nome: '',
  banco_nome: '', agencia: '', conta: '', pix_chave: '', pix_tipo: '',
  ativo: true,
}
```

Form layout inside MagicModal:
- Group 1: Razao Social, Nome Fantasia (2 cols)
- Group 2: CNPJ, IE (2 cols)
- Group 3: Endereco (full width)
- Group 4: Cidade, UF, CEP (3 cols)
- Group 5: Telefone, Email (2 cols)
- Group 6: Contato (full width)
- Separator: "Dados Bancarios"
- Group 7: Banco, Agencia, Conta (3 cols)
- Group 8: PIX Chave, PIX Tipo (2 cols)

AI flow: when `onAiParse` fires, call `useAiCadastroParse.mutateAsync()`, then apply `result.fields` to `editItem` with confidence tracking in separate state `Record<string, number>`.

**Step 2: Verify and commit**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
git add frontend/src/pages/cadastros/FornecedoresCad.tsx
git commit -m "feat(cadastros): add FornecedoresCad with AI-powered CRUD"
```

---

### Task 12: ClassesFinanceiras — Simple CRUD

**Files:**
- Create: `frontend/src/pages/cadastros/ClassesFinanceiras.tsx`

**Step 1: Create page**

Simple CRUD, NO AI mode. Uses standard modal (MagicModal with `aiEnabled={false}`).
4 fields: codigo, descricao, tipo (select: receita/despesa/ambos), ativo (checkbox).

Table-based list (Itens.tsx pattern) with columns: Codigo, Descricao, Tipo, Status, Acoes.

**Step 2: Verify and commit**

---

### Task 13: CentrosCusto — Simple CRUD

**Files:**
- Create: `frontend/src/pages/cadastros/CentrosCusto.tsx`

Same pattern as ClassesFinanceiras but with fields: codigo, descricao, obra_id (select from useCadObras), ativo.

**Step 1: Create, verify, commit**

---

### Task 14: ObrasCad — CRUD with AI

**Files:**
- Create: `frontend/src/pages/cadastros/ObrasCad.tsx`

Card-based list. MagicModal with AI enabled.
Fields: codigo, nome, municipio, uf, status (select: ativo/pausado/concluido), responsavel_nome, responsavel_email.

**Step 1: Create, verify, commit**

---

### Task 15: ColaboradoresCad — CRUD with AI

**Files:**
- Create: `frontend/src/pages/cadastros/ColaboradoresCad.tsx`

Card-based list. MagicModal with AI enabled, `showCpfField`.
Fields: nome, cpf, cargo, departamento, obra_id (select), email, telefone, data_admissao, ativo.

**Step 1: Create, verify, commit**

---

### Task 16: ItensCad — Cadastros Version

**Files:**
- Create: `frontend/src/pages/cadastros/ItensCad.tsx`

This wraps the existing Itens CRUD from estoque but in Cadastros context. Can be a simple re-export or a copy with violet styling.

Simplest approach: import and re-use the existing hooks (`useEstoqueItens`, `useSalvarItem`) but render in Cadastros style. The existing `/estoque/itens` page stays unchanged.

**Step 1: Create, verify, commit**

---

## Phase 5: Polish & Integration

### Task 17: Update Financeiro Hooks

**Files:**
- Modify: `frontend/src/hooks/useFinanceiro.ts`

Update `useDistinctCentroCusto()` and `useDistinctClasseFinanceira()` to query from the new master tables instead of doing DISTINCT on existing records. This way the dropdowns in Contas a Pagar/Receber use the master data.

Keep backward compatibility — if master table is empty, fall back to distinct values.

**Step 1: Update hooks, verify, commit**

---

### Task 18: Final Verification & Commit

**Step 1: Run full TypeScript check**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit
```

**Step 2: Start dev server and visually verify**

```bash
cd /c/teg-plus/frontend && npm run dev
```

Navigate to: `/cadastros`, `/cadastros/fornecedores`, try creating a fornecedor via CNPJ.

**Step 3: Final commit and push**

```bash
git push origin main
```

---

## Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1. Foundation | DB + Types + Hooks | 15 min |
| 2. Components | ConfidenceField + AiDropZone + MagicModal | 20 min |
| 3. Layout & Routes | CadastrosLayout + App.tsx + Gear icons | 15 min |
| 4. Pages | 7 entity pages | 40 min |
| 5. Polish | Financeiro hooks + verification | 10 min |
| **Total** | **18 tasks** | **~100 min** |


## Links
- [[obsidian/28 - Módulo Cadastros AI]]
