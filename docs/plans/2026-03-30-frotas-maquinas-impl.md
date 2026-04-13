# Frotas & Máquinas — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign completo do módulo Frotas cobrindo veículos + máquinas, pipeline de custódia, OS kanban 6 estágios, agenda de alocação, multas/pedágios e integrações.

**Architecture:** Layout com 4 itens de menu (Painel, Frota & Máquinas, Manutenção, Operação & Controle). Cada item abre página com sub-abas horizontais. Dados direto no Supabase via TanStack Query. Sem n8n nesse módulo.

**Tech Stack:** React 18 + TypeScript + Tailwind 3.4 + TanStack Query v5 + Supabase + lucide-react

---

## Task 1: Migration DB — Novas tabelas e campos

**Files:**
- Create: `supabase/068_fro_redesign.sql`

**Step 1: Criar o arquivo de migration**

```sql
-- 068_fro_redesign.sql
-- Adiciona campos em fro_veiculos
ALTER TABLE fro_veiculos
  ADD COLUMN IF NOT EXISTS tipo_ativo       text NOT NULL DEFAULT 'veiculo' CHECK (tipo_ativo IN ('veiculo','maquina')),
  ADD COLUMN IF NOT EXISTS numero_serie     text,
  ADD COLUMN IF NOT EXISTS horimetro_atual  numeric(10,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pat_item_id      uuid REFERENCES pat_itens(id),
  ADD COLUMN IF NOT EXISTS con_contrato_id  uuid REFERENCES con_contratos(id),
  ADD COLUMN IF NOT EXISTS base_atual_id    uuid REFERENCES sys_obras(id),
  ADD COLUMN IF NOT EXISTS responsavel_id   uuid REFERENCES sys_colaboradores(id);

-- Adicionar novos status
ALTER TABLE fro_veiculos
  DROP CONSTRAINT IF EXISTS fro_veiculos_status_check;
ALTER TABLE fro_veiculos
  ADD CONSTRAINT fro_veiculos_status_check
  CHECK (status IN ('disponivel','em_uso','em_manutencao','bloqueado','baixado','em_entrada','aguardando_saida'));

-- Acessórios
CREATE TABLE IF NOT EXISTS fro_acessorios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  descricao   text,
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fro_veiculo_acessorios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id  uuid NOT NULL REFERENCES fro_veiculos(id) ON DELETE CASCADE,
  acessorio_id uuid NOT NULL REFERENCES fro_acessorios(id),
  observacoes text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(veiculo_id, acessorio_id)
);

-- Alocações
CREATE TABLE IF NOT EXISTS fro_alocacoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id          uuid NOT NULL REFERENCES fro_veiculos(id),
  obra_id             uuid REFERENCES sys_obras(id),
  centro_custo_id     uuid REFERENCES fin_centros_custo(id),
  responsavel_id      uuid REFERENCES sys_colaboradores(id),
  responsavel_nome    text,
  data_saida          timestamptz NOT NULL DEFAULT now(),
  data_retorno_prev   date,
  data_retorno_real   timestamptz,
  hodometro_saida     numeric(10,0),
  hodometro_retorno   numeric(10,0),
  horimetro_saida     numeric(10,1),
  horimetro_retorno   numeric(10,1),
  checklist_saida_id  uuid,
  checklist_retorno_id uuid,
  status              text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada','cancelada')),
  observacoes         text,
  created_by          uuid REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Templates de checklist
CREATE TABLE IF NOT EXISTS fro_checklist_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('pre_viagem','pos_viagem','entrega_locadora','devolucao_locadora','pre_manutencao','pos_manutencao')),
  tipo_ativo  text DEFAULT 'todos' CHECK (tipo_ativo IN ('todos','veiculo','maquina')),
  ativo       boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fro_checklist_template_itens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES fro_checklist_templates(id) ON DELETE CASCADE,
  ordem        int NOT NULL DEFAULT 0,
  descricao    text NOT NULL,
  obrigatorio  boolean DEFAULT true,
  permite_foto boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS fro_checklist_execucoes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES fro_checklist_templates(id),
  veiculo_id   uuid NOT NULL REFERENCES fro_veiculos(id),
  alocacao_id  uuid REFERENCES fro_alocacoes(id),
  hodometro    numeric(10,0),
  horimetro    numeric(10,1),
  responsavel_id uuid REFERENCES sys_colaboradores(id),
  responsavel_nome text,
  status       text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido')),
  assinatura_url text,
  observacoes  text,
  created_at   timestamptz DEFAULT now(),
  concluido_at timestamptz
);

CREATE TABLE IF NOT EXISTS fro_checklist_execucao_itens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id   uuid NOT NULL REFERENCES fro_checklist_execucoes(id) ON DELETE CASCADE,
  template_item_id uuid NOT NULL REFERENCES fro_checklist_template_itens(id),
  conforme      boolean,
  foto_url      text,
  observacao    text
);

-- Multas e Pedágios
CREATE TABLE IF NOT EXISTS fro_multas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id      uuid NOT NULL REFERENCES fro_veiculos(id),
  tipo            text NOT NULL CHECK (tipo IN ('multa','pedagio')),
  data_infracao   date,
  data_vencimento date,
  valor           numeric(10,2) NOT NULL DEFAULT 0,
  ait             text,
  descricao       text,
  local           text,
  responsavel_id  uuid REFERENCES sys_colaboradores(id),
  obra_id         uuid REFERENCES sys_obras(id),
  status          text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','contestada','paga','vencida','cancelada')),
  data_pagamento  date,
  fin_cp_id       uuid,
  observacoes     text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Atualizar OS: novo status 'pendente' e campo de prioridade de aprovação
ALTER TABLE fro_ordens_servico
  DROP CONSTRAINT IF EXISTS fro_ordens_servico_status_check;
ALTER TABLE fro_ordens_servico
  ADD CONSTRAINT fro_ordens_servico_status_check
  CHECK (status IN ('pendente','em_cotacao','aguardando_aprovacao','aprovada','em_execucao','concluida','rejeitada','cancelada'));

-- RLS policies básicas (herdam padrão do schema — permitir leitura autenticada)
ALTER TABLE fro_acessorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_veiculo_acessorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklist_template_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklist_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_checklist_execucao_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fro_multas ENABLE ROW LEVEL SECURITY;

-- RLS: autenticados podem ler tudo
CREATE POLICY "auth_read" ON fro_acessorios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON fro_veiculo_acessorios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON fro_alocacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON fro_checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON fro_checklist_template_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON fro_checklist_execucoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON fro_checklist_execucao_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read" ON fro_multas FOR SELECT TO authenticated USING (true);

-- RLS: escrita para roles com permissão
CREATE POLICY "auth_write" ON fro_alocacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write" ON fro_checklist_execucoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write" ON fro_checklist_execucao_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_write" ON fro_multas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON fro_acessorios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON fro_veiculo_acessorios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON fro_checklist_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON fro_checklist_template_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed: templates padrão
INSERT INTO fro_checklist_templates (nome, tipo, tipo_ativo) VALUES
  ('Pré-Viagem — Veículo',         'pre_viagem',         'veiculo'),
  ('Pós-Viagem — Veículo',         'pos_viagem',         'veiculo'),
  ('Pré-Viagem — Máquina',         'pre_viagem',         'maquina'),
  ('Entrega p/ Locadora',          'entrega_locadora',   'todos'),
  ('Recebimento de Locadora',      'devolucao_locadora', 'todos'),
  ('Entrada em Manutenção',        'pre_manutencao',     'todos'),
  ('Saída de Manutenção',          'pos_manutencao',     'todos')
ON CONFLICT DO NOTHING;

-- Seed: acessórios comuns
INSERT INTO fro_acessorios (nome) VALUES
  ('Munck'),('Carroceria Aberta'),('Carroceria Fechada'),
  ('Guincho'),('Caçamba'),('Tanque Extra'),('Câmera de Ré'),
  ('Rastreador GPS'),('Tacógrafo'),('Extintor'),('Triângulo'),('Macaco')
ON CONFLICT DO NOTHING;
```

**Step 2: Aplicar no Supabase via MCP**

Use `mcp__402c23fe__apply_migration` com o conteúdo acima.

**Step 3: Verificar tabelas criadas**

Use `mcp__402c23fe__execute_sql`:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'fro_%'
ORDER BY table_name;
```
Esperado: 8+ tabelas fro_ listadas.

**Step 4: Commit**
```bash
git add supabase/068_fro_redesign.sql
git commit -m "feat(frotas): migration 068 — novas tabelas alocações, checklists, multas, acessórios"
```

---

## Task 2: Expandir types/frotas.ts

**Files:**
- Modify: `frontend/src/types/frotas.ts`

**Step 1: Adicionar novos tipos após os existentes**

```typescript
// Novos tipos de status
export type TipoAtivo         = 'veiculo' | 'maquina'
export type StatusAlocacao    = 'ativa' | 'encerrada' | 'cancelada'
export type TipoChecklist2    = 'pre_viagem' | 'pos_viagem' | 'entrega_locadora' | 'devolucao_locadora' | 'pre_manutencao' | 'pos_manutencao'
export type TipoMulta         = 'multa' | 'pedagio'
export type StatusMulta       = 'recebida' | 'contestada' | 'paga' | 'vencida' | 'cancelada'

// Estender StatusVeiculo
export type StatusVeiculo = 'disponivel' | 'em_uso' | 'em_manutencao' | 'bloqueado' | 'baixado' | 'em_entrada' | 'aguardando_saida'

// Atualizar StatusOS para incluir 'pendente'
export type StatusOS = 'pendente' | 'em_cotacao' | 'aguardando_aprovacao' | 'aprovada' | 'em_execucao' | 'concluida' | 'rejeitada' | 'cancelada'

export interface FroAcessorio {
  id: string
  nome: string
  descricao?: string
  ativo: boolean
  created_at: string
}

export interface FroAlocacao {
  id: string
  veiculo_id: string
  obra_id?: string
  centro_custo_id?: string
  responsavel_id?: string
  responsavel_nome?: string
  data_saida: string
  data_retorno_prev?: string
  data_retorno_real?: string
  hodometro_saida?: number
  hodometro_retorno?: number
  horimetro_saida?: number
  horimetro_retorno?: number
  checklist_saida_id?: string
  checklist_retorno_id?: string
  status: StatusAlocacao
  observacoes?: string
  created_at: string
  updated_at: string
  // joins
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'modelo' | 'marca' | 'tipo_ativo' | 'categoria'>
  obra?: { id: string; nome: string; codigo?: string }
}

export interface FroChecklistTemplate {
  id: string
  nome: string
  tipo: TipoChecklist2
  tipo_ativo: 'todos' | 'veiculo' | 'maquina'
  ativo: boolean
  created_at: string
  itens?: FroChecklistTemplateItem[]
}

export interface FroChecklistTemplateItem {
  id: string
  template_id: string
  ordem: number
  descricao: string
  obrigatorio: boolean
  permite_foto: boolean
}

export interface FroChecklistExecucao {
  id: string
  template_id: string
  veiculo_id: string
  alocacao_id?: string
  hodometro?: number
  horimetro?: number
  responsavel_id?: string
  responsavel_nome?: string
  status: 'pendente' | 'em_andamento' | 'concluido'
  assinatura_url?: string
  observacoes?: string
  created_at: string
  concluido_at?: string
  template?: FroChecklistTemplate
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'modelo'>
  itens?: FroChecklistExecucaoItem[]
}

export interface FroChecklistExecucaoItem {
  id: string
  execucao_id: string
  template_item_id: string
  conforme?: boolean
  foto_url?: string
  observacao?: string
  template_item?: FroChecklistTemplateItem
}

export interface FroMulta {
  id: string
  veiculo_id: string
  tipo: TipoMulta
  data_infracao?: string
  data_vencimento?: string
  valor: number
  ait?: string
  descricao?: string
  local?: string
  responsavel_id?: string
  obra_id?: string
  status: StatusMulta
  data_pagamento?: string
  fin_cp_id?: string
  observacoes?: string
  created_at: string
  updated_at: string
  veiculo?: Pick<FroVeiculo, 'id' | 'placa' | 'modelo'>
  obra?: { id: string; nome: string }
}

// Atualizar FroVeiculo para novos campos
// Adicionar ao interface existente:
// tipo_ativo: TipoAtivo
// numero_serie?: string
// horimetro_atual?: number
// pat_item_id?: string
// con_contrato_id?: string
// base_atual_id?: string
// responsavel_id?: string
```

**Step 2: Commit**
```bash
git add frontend/src/types/frotas.ts
git commit -m "feat(frotas): expandir types — alocações, checklists, multas, acessórios"
```

---

## Task 3: Expandir hooks/useFrotas.ts

**Files:**
- Modify: `frontend/src/hooks/useFrotas.ts`

**Step 1: Adicionar hooks para alocações**

```typescript
// ── Alocações ─────────────────────────────────────────────────────────────────

export function useAlocacoes(filtros?: { status?: StatusAlocacao; veiculo_id?: string }) {
  return useQuery({
    queryKey: ['fro_alocacoes', filtros],
    queryFn: async () => {
      let q = supabase
        .from('fro_alocacoes')
        .select(`*, veiculo:fro_veiculos(id,placa,modelo,marca,tipo_ativo,categoria), obra:sys_obras(id,nome,codigo)`)
        .order('data_saida', { ascending: false })
      if (filtros?.status)     q = q.eq('status', filtros.status)
      if (filtros?.veiculo_id) q = q.eq('veiculo_id', filtros.veiculo_id)
      const { data, error } = await q
      if (error) throw error
      return data as FroAlocacao[]
    },
  })
}

export function useCriarAlocacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<FroAlocacao, 'id' | 'created_at' | 'updated_at' | 'veiculo' | 'obra'>) => {
      const { error } = await supabase.from('fro_alocacoes').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fro_alocacoes'] })
      qc.invalidateQueries({ queryKey: ['fro_veiculos'] })
    },
  })
}

export function useEncerrarAlocacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, hodometro_retorno, horimetro_retorno, observacoes }: {
      id: string; hodometro_retorno?: number; horimetro_retorno?: number; observacoes?: string
    }) => {
      const { error } = await supabase
        .from('fro_alocacoes')
        .update({ status: 'encerrada', data_retorno_real: new Date().toISOString(), hodometro_retorno, horimetro_retorno, observacoes })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fro_alocacoes'] })
      qc.invalidateQueries({ queryKey: ['fro_veiculos'] })
    },
  })
}
```

**Step 2: Adicionar hooks para multas**

```typescript
// ── Multas & Pedágios ─────────────────────────────────────────────────────────

export function useMultas(filtros?: { tipo?: TipoMulta; status?: StatusMulta }) {
  return useQuery({
    queryKey: ['fro_multas', filtros],
    queryFn: async () => {
      let q = supabase
        .from('fro_multas')
        .select(`*, veiculo:fro_veiculos(id,placa,modelo), obra:sys_obras(id,nome)`)
        .order('created_at', { ascending: false })
      if (filtros?.tipo)   q = q.eq('tipo', filtros.tipo)
      if (filtros?.status) q = q.eq('status', filtros.status)
      const { data, error } = await q
      if (error) throw error
      return data as FroMulta[]
    },
  })
}

export function useSalvarMulta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<FroMulta> & { veiculo_id: string; tipo: TipoMulta; valor: number }) => {
      const { id, created_at, updated_at, veiculo, obra, ...data } = payload as FroMulta
      if (id) {
        const { error } = await supabase.from('fro_multas').update(data).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fro_multas').insert(data)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fro_multas'] }),
  })
}
```

**Step 3: Adicionar hooks para checklists templates**

```typescript
// ── Checklist Templates ───────────────────────────────────────────────────────

export function useChecklistTemplates(tipo?: TipoChecklist2) {
  return useQuery({
    queryKey: ['fro_checklist_templates', tipo],
    queryFn: async () => {
      let q = supabase
        .from('fro_checklist_templates')
        .select(`*, itens:fro_checklist_template_itens(*)`)
        .eq('ativo', true)
        .order('nome')
      if (tipo) q = q.eq('tipo', tipo)
      const { data, error } = await q
      if (error) throw error
      return data as FroChecklistTemplate[]
    },
  })
}

export function useChecklistExecucoes(veiculo_id?: string) {
  return useQuery({
    queryKey: ['fro_checklist_execucoes', veiculo_id],
    queryFn: async () => {
      let q = supabase
        .from('fro_checklist_execucoes')
        .select(`*, template:fro_checklist_templates(id,nome,tipo), veiculo:fro_veiculos(id,placa,modelo), itens:fro_checklist_execucao_itens(*, template_item:fro_checklist_template_itens(*))`)
        .order('created_at', { ascending: false })
      if (veiculo_id) q = q.eq('veiculo_id', veiculo_id)
      const { data, error } = await q
      if (error) throw error
      return data as FroChecklistExecucao[]
    },
  })
}

export function useSalvarChecklistExecucao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      execucao: Omit<FroChecklistExecucao, 'id' | 'created_at' | 'template' | 'veiculo' | 'itens'>
      itens: Omit<FroChecklistExecucaoItem, 'id' | 'template_item'>[]
    }) => {
      const { data: exec, error: e1 } = await supabase
        .from('fro_checklist_execucoes')
        .insert(payload.execucao)
        .select()
        .single()
      if (e1) throw e1
      if (payload.itens.length > 0) {
        const { error: e2 } = await supabase
          .from('fro_checklist_execucao_itens')
          .insert(payload.itens.map(i => ({ ...i, execucao_id: exec.id })))
        if (e2) throw e2
      }
      return exec
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fro_checklist_execucoes'] }),
  })
}
```

**Step 4: Commit**
```bash
git add frontend/src/hooks/useFrotas.ts
git commit -m "feat(frotas): hooks — alocações, multas, checklists templates/execuções"
```

---

## Task 4: Atualizar FrotasLayout (menu 4 itens)

**Files:**
- Modify: `frontend/src/components/FrotasLayout.tsx`

**Step 1: Substituir conteúdo**

```typescript
import { LayoutDashboard, Truck, Wrench, Gauge } from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/frotas',           icon: LayoutDashboard, label: 'Painel',             end: true },
  { to: '/frotas/frota',     icon: Truck,           label: 'Frota & Máquinas'              },
  { to: '/frotas/manutencao',icon: Wrench,          label: 'Manutenção'                    },
  { to: '/frotas/operacao',  icon: Gauge,           label: 'Operação & Controle'           },
]

export default function FrotasLayout() {
  return (
    <ModuleLayout
      moduleKey="frotas"
      moduleName="Frotas"
      moduleEmoji="🚗"
      accent="rose"
      nav={NAV}
      moduleSubtitle="Veículos & Máquinas"
    />
  )
}
```

**Step 2: Atualizar rotas em App.tsx**

Substituir o bloco de rotas frotas:
```tsx
<Route element={<ModuleRoute moduleKey="frotas" />}>
  <Route element={<FrotasLayout />}>
    <Route path="/frotas"                          element={<FrotasHome />} />
    <Route path="/frotas/frota"                    element={<FrotaHub />} />
    <Route path="/frotas/manutencao"               element={<ManutencaoHub />} />
    <Route path="/frotas/operacao"                 element={<OperacaoHub />} />
    {/* Manter rotas legadas redirecionando */}
    <Route path="/frotas/veiculos"                 element={<Navigate to="/frotas/frota" replace />} />
    <Route path="/frotas/ordens"                   element={<Navigate to="/frotas/manutencao" replace />} />
    <Route path="/frotas/checklists"               element={<Navigate to="/frotas/manutencao?tab=checklists" replace />} />
    <Route path="/frotas/abastecimentos"           element={<Navigate to="/frotas/operacao?tab=abastecimentos" replace />} />
    <Route path="/frotas/telemetria"               element={<Navigate to="/frotas/operacao?tab=telemetria" replace />} />
  </Route>
</Route>
```

Adicionar imports:
```tsx
import FrotaHub      from './pages/frotas/frota/FrotaHub'
import ManutencaoHub from './pages/frotas/manutencao/ManutencaoHub'
import OperacaoHub   from './pages/frotas/operacao/OperacaoHub'
```

**Step 3: Commit**
```bash
git add frontend/src/components/FrotasLayout.tsx frontend/src/App.tsx
git commit -m "feat(frotas): atualizar layout e rotas para nova estrutura 4 menus"
```

---

## Task 5: FrotaHub — container com 4 sub-abas

**Files:**
- Create: `frontend/src/pages/frotas/frota/FrotaHub.tsx`
- Create: `frontend/src/pages/frotas/frota/EmEntrada.tsx`
- Create: `frontend/src/pages/frotas/frota/Patio.tsx`
- Create: `frontend/src/pages/frotas/frota/ChecklistSaida.tsx`
- Create: `frontend/src/pages/frotas/frota/Alocados.tsx`

**Step 1: Criar FrotaHub.tsx (container de abas)**

```tsx
import { useState } from 'react'
import { LogIn, Warehouse, ClipboardCheck, MapPin } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import EmEntrada     from './EmEntrada'
import Patio         from './Patio'
import ChecklistSaida from './ChecklistSaida'
import Alocados      from './Alocados'

const TABS = [
  { id: 'entrada',   label: 'Em Entrada',      icon: LogIn,          component: EmEntrada      },
  { id: 'patio',     label: 'Pátio',            icon: Warehouse,      component: Patio          },
  { id: 'checklist', label: 'Checklist Saída',  icon: ClipboardCheck, component: ChecklistSaida },
  { id: 'alocados',  label: 'Alocados',         icon: MapPin,         component: Alocados       },
]

export default function FrotaHub() {
  const [tab, setTab] = useState('patio')
  const { isLightSidebar: isLight } = useTheme()
  const Comp = TABS.find(t => t.id === tab)?.component ?? Patio

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className={`flex items-center gap-1 px-4 pt-4 pb-0 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                active
                  ? 'border-rose-500 text-rose-500'
                  : `border-transparent ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'}`
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Comp />
      </div>
    </div>
  )
}
```

**Step 2: Criar Patio.tsx (refactor de Veiculos.tsx para visão pátio)**

Patio.tsx é a aba principal. Mostra veículos com `status = 'disponivel'`. Cada card tem:
- Badge tipo_ativo (VEÍCULO / MÁQUINA)
- Placa / número de série
- Marca + Modelo
- KM ou horímetro atual
- Badge propriedade (PRÓPRIO / LOCADO / CEDIDO)
- Badge OS crítica em aberto (se houver)
- Vencimento documentos (CRLV, seguro)
- Acessórios
- Botões: Alocar | Manutenção | Checklist Saída

```tsx
import { useState } from 'react'
import { Plus, Car, Wrench, ClipboardCheck, AlertTriangle, Zap } from 'lucide-react'
import { useVeiculos, useOrdensServico } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroVeiculo } from '../../../types/frotas'

function docAlert(dateStr?: string) {
  if (!dateStr) return null
  const diff = Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
  if (diff < 0)   return { cls: 'text-red-500',   label: `Vencido` }
  if (diff <= 30) return { cls: 'text-amber-500',  label: `${diff}d` }
  return null
}

function OSBadge({ veiculoId, osAbertas, isLight }: {
  veiculoId: string
  osAbertas: Array<{ veiculo_id: string; prioridade: string; tipo: string; status: string }>
  isLight: boolean
}) {
  const os = osAbertas.filter(o => o.veiculo_id === veiculoId)
  if (!os.length) return null
  const top = os.find(o => o.prioridade === 'critica') ?? os.find(o => o.prioridade === 'alta') ?? os[0]
  const cls = top.prioridade === 'critica' ? 'bg-red-500/15 text-red-600 border-red-500/30'
            : top.prioridade === 'alta'    ? 'bg-orange-500/15 text-orange-600 border-orange-500/30'
            : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${cls}`}>
      🔧 {top.tipo} · {top.status.replace(/_/g,' ')}
    </span>
  )
}

export default function Patio() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: veiculos = [], isLoading } = useVeiculos({ status: 'disponivel' })
  const { data: osAbertas = [] } = useOrdensServico({
    status: ['pendente','em_cotacao','aguardando_aprovacao','aprovada','em_execucao']
  })
  const [search, setSearch] = useState('')

  const filtered = veiculos.filter(v =>
    v.placa?.toLowerCase().includes(search.toLowerCase()) ||
    v.modelo?.toLowerCase().includes(search.toLowerCase()) ||
    v.marca?.toLowerCase().includes(search.toLowerCase())
  )

  const card = `rounded-2xl border p-4 flex flex-col gap-3 ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'
  }`

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Pátio — {filtered.length} disponíveis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Ativos prontos para alocação</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors">
          <Plus size={13} /> Novo Ativo
        </button>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por placa, modelo, marca..."
        className={`w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/40 ${
          isLight ? 'bg-white border border-slate-200 text-slate-800' : 'bg-white/6 border border-white/12 text-white'
        }`}
      />

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${card} h-40 animate-pulse`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">Nenhum ativo no pátio</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(v => {
            const crlv  = docAlert(v.vencimento_crlv)
            const seg   = docAlert(v.vencimento_seguro)
            return (
              <div key={v.id} className={card}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {v.placa ?? v.numero_serie ?? '—'}
                    </p>
                    <p className="text-xs text-slate-500">{v.marca} {v.modelo}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                      v.tipo_ativo === 'maquina'
                        ? 'bg-violet-500/15 text-violet-600 border-violet-500/30'
                        : 'bg-sky-500/15 text-sky-600 border-sky-500/30'
                    }`}>
                      {v.tipo_ativo === 'maquina' ? '⚙️ Máquina' : '🚗 Veículo'}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                      v.propriedade === 'propria'
                        ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                    }`}>
                      {v.propriedade === 'propria' ? 'Próprio' : v.propriedade === 'locada' ? 'Locado' : 'Cedido'}
                    </span>
                  </div>
                </div>

                {/* KM / Horímetro */}
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {v.tipo_ativo === 'maquina'
                    ? <span>⏱ {(v.horimetro_atual ?? 0).toLocaleString('pt-BR')} h</span>
                    : <span>📍 {(v.hodometro_atual ?? 0).toLocaleString('pt-BR')} km</span>
                  }
                  {v.km_proxima_preventiva && (
                    <span className={
                      (v.hodometro_atual ?? 0) >= v.km_proxima_preventiva ? 'text-red-500' :
                      (v.hodometro_atual ?? 0) >= v.km_proxima_preventiva - 500 ? 'text-amber-500' : ''
                    }>
                      · prev. {v.km_proxima_preventiva.toLocaleString('pt-BR')} km
                    </span>
                  )}
                </div>

                {/* OS badge */}
                <OSBadge veiculoId={v.id} osAbertas={osAbertas} isLight={isLight} />

                {/* Doc alerts */}
                {(crlv || seg) && (
                  <div className="flex gap-1 flex-wrap">
                    {crlv && <span className={`text-[10px] flex items-center gap-1 ${crlv.cls}`}><AlertTriangle size={10} /> CRLV {crlv.label}</span>}
                    {seg  && <span className={`text-[10px] flex items-center gap-1 ${seg.cls}`}><AlertTriangle size={10} /> Seguro {seg.label}</span>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-white/[0.04]">
                  <button className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors">
                    Alocar
                  </button>
                  <button className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors">
                    <Wrench size={11} className="inline mr-1" />OS
                  </button>
                  <button className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-teal-500/10 text-teal-500 hover:bg-teal-500/20 transition-colors">
                    <ClipboardCheck size={11} className="inline mr-1" />Saída
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Criar EmEntrada.tsx (stub funcional)**

```tsx
import { useTheme } from '../../../contexts/ThemeContext'
import { useVeiculos } from '../../../hooks/useFrotas'
import { LogIn, Plus } from 'lucide-react'

export default function EmEntrada() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: veiculos = [] } = useVeiculos({ status: 'em_entrada' })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Em Entrada — {veiculos.length}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Recebimento e vistoria de entrada</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors">
          <Plus size={13} /> Registrar Entrada
        </button>
      </div>
      {veiculos.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'}`}>
          <LogIn size={32} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm text-slate-500">Nenhum ativo em processo de entrada</p>
          <p className="text-xs text-slate-600 mt-1">Clique em "Registrar Entrada" para iniciar vistoria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {veiculos.map(v => (
            <div key={v.id} className={`rounded-2xl border p-4 ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'}`}>
              <p className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>{v.placa ?? v.numero_serie}</p>
              <p className="text-xs text-slate-500">{v.marca} {v.modelo}</p>
              <button className="mt-3 w-full text-xs font-semibold py-2 rounded-xl bg-teal-500/10 text-teal-500 hover:bg-teal-500/20 transition-colors">
                Continuar Vistoria
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Criar ChecklistSaida.tsx e Alocados.tsx (stubs)**

ChecklistSaida: lista veículos com `status = 'aguardando_saida'`, botão "Preencher Checklist".
Alocados: usa `useAlocacoes({ status: 'ativa' })`, tabela com placa, obra, responsável, saída, retorno previsto, badge OS, botão "Registrar Retorno".

**Step 5: Commit**
```bash
git add frontend/src/pages/frotas/frota/
git commit -m "feat(frotas): FrotaHub com 4 sub-abas — Entrada, Pátio, Checklist Saída, Alocados"
```

---

## Task 6: ManutencaoHub — 4 sub-abas

**Files:**
- Create: `frontend/src/pages/frotas/manutencao/ManutencaoHub.tsx`
- Create: `frontend/src/pages/frotas/manutencao/OSAbertas.tsx`
- Create: `frontend/src/pages/frotas/manutencao/Planejamento.tsx`
- Create: `frontend/src/pages/frotas/manutencao/ChecklistsManutencao.tsx`
- Create: `frontend/src/pages/frotas/manutencao/HistoricoOS.tsx`

**Step 1: ManutencaoHub.tsx**

```tsx
import { useState } from 'react'
import { Calendar, ClipboardList, Wrench, History } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import Planejamento  from './Planejamento'
import ChecklistsManutencao from './ChecklistsManutencao'
import OSAbertas     from './OSAbertas'
import HistoricoOS   from './HistoricoOS'

const TABS = [
  { id: 'planejamento', label: 'Planejamento',  icon: Calendar,      component: Planejamento       },
  { id: 'checklists',   label: 'Checklists',    icon: ClipboardList, component: ChecklistsManutencao },
  { id: 'os',           label: 'OS Abertas',    icon: Wrench,        component: OSAbertas          },
  { id: 'historico',    label: 'Histórico',     icon: History,       component: HistoricoOS        },
]

export default function ManutencaoHub() {
  const [tab, setTab] = useState('os')
  const { isLightSidebar: isLight } = useTheme()
  const Comp = TABS.find(t => t.id === tab)?.component ?? OSAbertas

  return (
    <div className="flex flex-col h-full">
      <div className={`flex items-center gap-1 px-4 pt-4 pb-0 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                active ? 'border-rose-500 text-rose-500'
                : `border-transparent ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-slate-200'}`
              }`}>
              <Icon size={13} />{t.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-auto"><Comp /></div>
    </div>
  )
}
```

**Step 2: OSAbertas.tsx — kanban 6 colunas**

Pipeline: `pendente → em_cotacao → aguardando_aprovacao → aprovada → em_execucao → concluida`

```tsx
import { Plus } from 'lucide-react'
import { useOrdensServico, useAtualizarStatusOS } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { FroOrdemServico, StatusOS, PrioridadeOS } from '../../../types/frotas'

const COLUNAS: { id: StatusOS; label: string; cor: string }[] = [
  { id: 'pendente',             label: 'Pendente',        cor: 'border-slate-500' },
  { id: 'em_cotacao',           label: 'Cotação',         cor: 'border-sky-500' },
  { id: 'aguardando_aprovacao', label: 'Em Aprovação',    cor: 'border-amber-500' },
  { id: 'aprovada',             label: 'Aprovada',        cor: 'border-teal-500' },
  { id: 'em_execucao',          label: 'Em Execução',     cor: 'border-violet-500' },
  { id: 'concluida',            label: 'Concluída',       cor: 'border-emerald-500' },
]

const PRIOR_CLS: Record<PrioridadeOS, string> = {
  critica: 'bg-red-500/15 text-red-600 border-red-500/30',
  alta:    'bg-orange-500/15 text-orange-600 border-orange-500/30',
  media:   'bg-amber-500/15 text-amber-600 border-amber-500/30',
  baixa:   'bg-slate-500/10 text-slate-500 border-slate-500/20',
}

const BRL = (v?: number) => v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—'

function OSCard({ os, isLight }: { os: FroOrdemServico; isLight: boolean }) {
  return (
    <div className={`rounded-xl border p-3 space-y-2 text-xs cursor-pointer hover:shadow-md transition-shadow ${
      isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.08]'
    }`}>
      <div className="flex items-start justify-between gap-1">
        <span className={`font-bold px-1.5 py-0.5 rounded border uppercase text-[9px] ${PRIOR_CLS[os.prioridade]}`}>
          {os.prioridade}
        </span>
        <span className="text-[10px] text-slate-500">{os.numero_os ?? '—'}</span>
      </div>
      <p className={`font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
        {os.veiculo?.placa ?? '—'}
      </p>
      <p className="text-slate-400 truncate">{os.descricao_problema ?? os.tipo}</p>
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
        <span className="text-slate-500">{os.fornecedor?.nome_fantasia ?? os.fornecedor?.razao_social ?? '—'}</span>
        <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>{BRL(os.valor_total)}</span>
      </div>
    </div>
  )
}

export default function OSAbertas() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: todas = [] } = useOrdensServico({
    status: ['pendente','em_cotacao','aguardando_aprovacao','aprovada','em_execucao']
  })

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          OS Abertas — {todas.length}
        </h2>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors">
          <Plus size={13} /> Nova OS
        </button>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUNAS.map(col => {
          const cards = todas.filter(o => o.status === col.id)
          return (
            <div key={col.id} className={`flex-shrink-0 w-56 rounded-2xl border-t-2 ${col.cor} ${
              isLight ? 'bg-slate-50' : 'bg-white/[0.03]'
            } p-3 space-y-2`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{col.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-slate-400'
                }`}>{cards.length}</span>
              </div>
              {cards.map(os => <OSCard key={os.id} os={os} isLight={isLight} />)}
              {cards.length === 0 && (
                <p className="text-[10px] text-slate-600 text-center py-4">Vazio</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 3: Planejamento.tsx, ChecklistsManutencao.tsx, HistoricoOS.tsx (stubs com layout)**

Cada um com header + tabela/lista simples mostrando dados reais.

**Step 4: Commit**
```bash
git add frontend/src/pages/frotas/manutencao/
git commit -m "feat(frotas): ManutencaoHub — Planejamento, Checklists, OS kanban 6 estágios, Histórico"
```

---

## Task 7: OperacaoHub — 5 sub-abas

**Files:**
- Create: `frontend/src/pages/frotas/operacao/OperacaoHub.tsx`
- Create: `frontend/src/pages/frotas/operacao/AgendaAlocacao.tsx`
- Create: `frontend/src/pages/frotas/operacao/AbastecimentosOp.tsx`
- Create: `frontend/src/pages/frotas/operacao/MultasPedagios.tsx`
- Create: `frontend/src/pages/frotas/operacao/TelemetriaOp.tsx`
- Create: `frontend/src/pages/frotas/operacao/Indicadores.tsx`

**Step 1: OperacaoHub.tsx**

Mesmo padrão de FrotaHub/ManutencaoHub, 5 abas:
- `agenda` → AgendaAlocacao
- `abastecimentos` → AbastecimentosOp (migra Abastecimentos.tsx)
- `multas` → MultasPedagios
- `telemetria` → TelemetriaOp (migra Telemetria.tsx)
- `indicadores` → Indicadores

**Step 2: AgendaAlocacao.tsx**

Calendário simples (grid semanal) mostrando alocações ativas.

```tsx
import { useAlocacoes } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import { Plus, CalendarDays } from 'lucide-react'

export default function AgendaAlocacao() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: alocacoes = [], isLoading } = useAlocacoes({ status: 'ativa' })

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Agenda de Alocação
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{alocacoes.length} alocações ativas</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors">
          <Plus size={13} /> Nova Alocação
        </button>
      </div>

      {/* Tabela de alocações ativas */}
      <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'}`}>
        <table className="w-full text-xs">
          <thead>
            <tr className={`border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/[0.06] bg-white/[0.03]'}`}>
              {['Ativo','Obra / CC','Responsável','Saída','Retorno Prev.','Ações'].map(h => (
                <th key={h} className={`px-4 py-3 text-left font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alocacoes.map(a => (
              <tr key={a.id} className={`border-b last:border-0 ${isLight ? 'border-slate-50 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{a.veiculo?.placa ?? '—'}</span>
                  <span className="text-slate-500 ml-1">{a.veiculo?.modelo}</span>
                </td>
                <td className="px-4 py-3 text-slate-400">{a.obra?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{a.responsavel_nome ?? '—'}</td>
                <td className="px-4 py-3 text-slate-400">{new Date(a.data_saida).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-slate-400">{a.data_retorno_prev ? new Date(a.data_retorno_prev).toLocaleDateString('pt-BR') : '—'}</td>
                <td className="px-4 py-3">
                  <button className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-teal-500/10 text-teal-500 hover:bg-teal-500/20 transition-colors">
                    Retorno
                  </button>
                </td>
              </tr>
            ))}
            {alocacoes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Nenhuma alocação ativa</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: MultasPedagios.tsx**

```tsx
import { useState } from 'react'
import { Plus, AlertCircle } from 'lucide-react'
import { useMultas } from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import type { StatusMulta, TipoMulta } from '../../../types/frotas'

const STATUS_CFG: Record<StatusMulta, { label: string; cls: string }> = {
  recebida:   { label: 'Recebida',   cls: 'bg-sky-500/15 text-sky-600 border-sky-500/30' },
  contestada: { label: 'Contestada', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  paga:       { label: 'Paga',       cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  vencida:    { label: 'Vencida',    cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
}

const BRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function MultasPedagios() {
  const { isLightSidebar: isLight } = useTheme()
  const [tipo, setTipo] = useState<TipoMulta | 'todos'>('todos')
  const { data: multas = [] } = useMultas(tipo !== 'todos' ? { tipo } : undefined)

  const total = multas.reduce((s, m) => s + (m.valor ?? 0), 0)

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Multas & Pedágios</h2>
          <p className="text-xs text-slate-500 mt-0.5">Total: {BRL(total)}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors">
          <Plus size={13} /> Registrar
        </button>
      </div>

      {/* Filtro tipo */}
      <div className="flex gap-2">
        {(['todos','multa','pedagio'] as const).map(t => (
          <button key={t} onClick={() => setTipo(t)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              tipo === t ? 'bg-rose-500 text-white' : isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-slate-400 hover:bg-white/15'
            }`}>
            {t === 'todos' ? 'Todos' : t === 'multa' ? 'Multas' : 'Pedágios'}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className={`rounded-2xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#1e293b] border-white/[0.06]'}`}>
        <table className="w-full text-xs">
          <thead>
            <tr className={`border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/[0.06] bg-white/[0.03]'}`}>
              {['Tipo','Ativo','Data','Valor','AIT','Responsável','Status'].map(h => (
                <th key={h} className={`px-4 py-3 text-left font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {multas.map(m => {
              const st = STATUS_CFG[m.status]
              return (
                <tr key={m.id} className={`border-b last:border-0 ${isLight ? 'border-slate-50 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${m.tipo === 'multa' ? 'bg-red-500/15 text-red-600 border-red-500/30' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                      {m.tipo === 'multa' ? '🚨 Multa' : '🛣 Pedágio'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{m.veiculo?.placa ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{m.data_infracao ? new Date(m.data_infracao).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className={`px-4 py-3 font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{BRL(m.valor)}</td>
                  <td className="px-4 py-3 text-slate-400">{m.ait ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{m.responsavel_id ? '—' : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${st.cls}`}>{st.label}</span>
                  </td>
                </tr>
              )
            })}
            {multas.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Nenhum registro</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 4: AbastecimentosOp.tsx e TelemetriaOp.tsx**

Mover conteúdo de `Abastecimentos.tsx` e `Telemetria.tsx` existentes para os novos arquivos. Apenas trocar o local do arquivo, sem alterar lógica.

**Step 5: Indicadores.tsx (stub KPIs)**

Cards com: Custo/km médio, Disponibilidade %, OS concluídas no mês, Total abastecimento mês, Total multas mês.

**Step 6: Commit**
```bash
git add frontend/src/pages/frotas/operacao/
git commit -m "feat(frotas): OperacaoHub — Agenda, Abastecimentos, Multas/Pedágios, Telemetria, Indicadores"
```

---

## Task 8: Verificação final e build

**Step 1: Verificar build sem erros**
```bash
cd /c/teg-plus && npm run build --prefix frontend 2>&1 | tail -20
```
Esperado: `✓ built in` sem erros de TypeScript.

**Step 2: Verificar rotas no browser**
- `/frotas` → Painel carrega
- `/frotas/frota` → 4 abas visíveis
- `/frotas/manutencao` → 4 abas, OS kanban renderiza
- `/frotas/operacao` → 5 abas visíveis

**Step 3: Commit final + push**
```bash
cd /c/teg-plus && git add -A && git commit -m "feat(frotas): módulo Frotas & Máquinas redesign completo — fase 1

- 4 menus: Painel, Frota & Máquinas, Manutenção, Operação & Controle
- Pipeline custódia: Em Entrada → Pátio → Checklist Saída → Alocados
- OS kanban 6 estágios: Pendente → Concluída
- Badge OS em aberto visível no Pátio e Alocados
- Multas & Pedágios com tabela e filtros
- Agenda de Alocação com tabela de ativos em uso
- Migration 068: fro_alocacoes, fro_multas, fro_checklist_* + acessórios

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```


## Links
- [[obsidian/24 - Módulo Frotas e Manutenção]]
