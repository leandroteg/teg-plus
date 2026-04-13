# EGP Ciclo de Vida — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganizar o módulo EGP de 11 itens flat em 6 visões do ciclo de vida (Painel, Iniciação, Planejamento, Execução, Controle, Encerramento), cada uma com sub-abas em fluxo.

**Architecture:** Cada visão é um componente page com tabs internas renderizadas via state (não rotas). Usa `EGPPortfolioHub` existente como seletor de OSC. O Painel é um dashboard consolidado no padrão do `Dashboard.tsx` (Compras). Novas tabelas Supabase com RLS. Hooks TanStack Query existentes estendidos.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS), TanStack Query v5, lucide-react icons.

**Design doc:** `docs/plans/2026-04-06-egp-ciclo-vida-design.md`

---

## Fase 0: Infra — Novas Tabelas + Nav Atualizado

### Task 0.1: Migration SQL — 11 novas tabelas

**Files:**
- Create: `supabase/047_egp_ciclo_vida_tables.sql`

**Step 1: Write the migration**

```sql
-- ══════════════════════════════════════════════════════
-- 047 — EGP Ciclo de Vida: novas tabelas
-- ══════════════════════════════════════════════════════

-- ── INICIAÇÃO ──

CREATE TABLE IF NOT EXISTS pmo_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  papel TEXT,
  organizacao TEXT,
  influencia TEXT CHECK (influencia IN ('baixa','media','alta')),
  estrategia TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_stakeholders_portfolio ON pmo_stakeholders(portfolio_id);

CREATE TABLE IF NOT EXISTS pmo_comunicacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  destinatario TEXT,
  frequencia TEXT,
  canal TEXT,
  responsavel TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_comunicacao_portfolio ON pmo_comunicacao(portfolio_id);

-- ── PLANEJAMENTO ──

CREATE TABLE IF NOT EXISTS pmo_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  disciplina TEXT NOT NULL,
  insumo TEXT,
  fase TEXT,
  valor_previsto NUMERIC(14,2) DEFAULT 0,
  valor_realizado NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_orcamento_portfolio ON pmo_orcamento(portfolio_id);

-- ── EXECUÇÃO ──

CREATE TABLE IF NOT EXISTS pmo_riscos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria TEXT,
  probabilidade TEXT CHECK (probabilidade IN ('baixa','media','alta','muito_alta')),
  impacto TEXT CHECK (impacto IN ('baixo','medio','alto','muito_alto')),
  criticidade TEXT GENERATED ALWAYS AS (
    CASE
      WHEN probabilidade IN ('alta','muito_alta') AND impacto IN ('alto','muito_alto') THEN 'critico'
      WHEN probabilidade IN ('alta','muito_alta') OR impacto IN ('alto','muito_alto') THEN 'alto'
      WHEN probabilidade = 'media' OR impacto = 'medio' THEN 'medio'
      ELSE 'baixo'
    END
  ) STORED,
  resposta TEXT,
  responsavel TEXT,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto','mitigando','fechado','aceito')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_riscos_portfolio ON pmo_riscos(portfolio_id);

CREATE TABLE IF NOT EXISTS pmo_plano_acao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  tipo_desvio TEXT,
  responsavel TEXT,
  prazo DATE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  evidencia_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_plano_acao_portfolio ON pmo_plano_acao(portfolio_id);

CREATE TABLE IF NOT EXISTS pmo_entregaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  eap_id UUID REFERENCES pmo_eap(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  responsavel TEXT,
  pct_conclusao NUMERIC(5,2) DEFAULT 0,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido','atrasado')),
  data_prevista DATE,
  data_real DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_entregaveis_portfolio ON pmo_entregaveis(portfolio_id);

CREATE TABLE IF NOT EXISTS pmo_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT,
  data_emissao DATE,
  data_vencimento DATE,
  status TEXT DEFAULT 'vigente' CHECK (status IN ('vigente','a_vencer','vencido','renovado','na')),
  arquivo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_documentos_portfolio ON pmo_documentos(portfolio_id);

CREATE TABLE IF NOT EXISTS pmo_avanco_fisico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  semana INT,
  mes TEXT,
  pct_planejado NUMERIC(5,2) DEFAULT 0,
  pct_executado NUMERIC(5,2) DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_avanco_portfolio ON pmo_avanco_fisico(portfolio_id);

-- ── ENCERRAMENTO ──

CREATE TABLE IF NOT EXISTS pmo_licoes_aprendidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  fase TEXT,
  descricao TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('positivo','negativo')),
  recomendacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_licoes_portfolio ON pmo_licoes_aprendidas(portfolio_id);

CREATE TABLE IF NOT EXISTS pmo_aceite (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES con_contratos(id),
  data_aceite DATE,
  assinatura_url TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','assinado','rejeitado')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_aceite_portfolio ON pmo_aceite(portfolio_id);

CREATE TABLE IF NOT EXISTS pmo_desmobilizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES pmo_portfolio(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  categoria TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido')),
  responsavel TEXT,
  data_prevista DATE,
  data_real DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_desmobilizacao_portfolio ON pmo_desmobilizacao(portfolio_id);

-- ── RLS ──
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'pmo_stakeholders','pmo_comunicacao','pmo_orcamento','pmo_riscos',
    'pmo_plano_acao','pmo_entregaveis','pmo_documentos','pmo_avanco_fisico',
    'pmo_licoes_aprendidas','pmo_aceite','pmo_desmobilizacao'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I_sel ON %I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY %I_ins ON %I FOR INSERT TO authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY %I_upd ON %I FOR UPDATE TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY %I_del ON %I FOR DELETE TO authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- ── Triggers updated_at ──
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'pmo_orcamento','pmo_riscos','pmo_plano_acao','pmo_entregaveis',
    'pmo_documentos','pmo_aceite','pmo_desmobilizacao'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()', t, t
    );
  END LOOP;
END $$;
```

**Step 2: Apply migration via Supabase MCP**

Run: `mcp__402c23fe-4707-49e1-a558-76f47f37d917__apply_migration` with name `egp_ciclo_vida_tables`

**Step 3: Commit**

```bash
git add supabase/047_egp_ciclo_vida_tables.sql
git commit -m "feat(egp): add 11 new tables for lifecycle views"
```

---

### Task 0.2: Update EGPLayout nav

**Files:**
- Modify: `frontend/src/components/EGPLayout.tsx`

**Step 1: Replace the NAV array**

```typescript
import {
  LayoutDashboard, Rocket, Compass, Zap, BarChart3, CheckCircle2,
} from 'lucide-react'
import ModuleLayout from './ModuleLayout'

const NAV = [
  { to: '/egp',              icon: LayoutDashboard, label: 'Painel',        end: true },
  { to: '/egp/iniciacao',    icon: Rocket,          label: 'Iniciação' },
  { to: '/egp/planejamento', icon: Compass,         label: 'Planejamento' },
  { to: '/egp/execucao',     icon: Zap,             label: 'Execução' },
  { to: '/egp/controle',     icon: BarChart3,       label: 'Controle' },
  { to: '/egp/encerramento', icon: CheckCircle2,    label: 'Encerramento' },
]

export default function EGPLayout() {
  return (
    <ModuleLayout
      moduleKey="egp"
      moduleName="EGP"
      moduleEmoji="📊"
      accent="blue"
      nav={NAV}
      moduleSubtitle="Escritório de Gestão de Projetos"
      bottomNavMaxItems={6}
    />
  )
}
```

**Step 2: Update App.tsx routes**

Replace EGP route block — keep old routes as redirects to new ones:

```typescript
// New lifecycle routes
<Route path="/egp/iniciacao" element={<EGPIniciacaoHub />} />
<Route path="/egp/iniciacao/:portfolioId" element={<EGPIniciacao />} />
<Route path="/egp/planejamento" element={<EGPPlanejamentoHub />} />
<Route path="/egp/planejamento/:portfolioId" element={<EGPPlanejamento />} />
<Route path="/egp/execucao" element={<EGPExecucaoHub />} />
<Route path="/egp/execucao/:portfolioId" element={<EGPExecucao />} />
<Route path="/egp/controle" element={<EGPControleHub />} />
<Route path="/egp/controle/:portfolioId" element={<EGPControle />} />
<Route path="/egp/encerramento" element={<EGPEncerramentoHub />} />
<Route path="/egp/encerramento/:portfolioId" element={<EGPEncerramento />} />

// Legacy redirects
<Route path="/egp/tap" element={<Navigate to="/egp/iniciacao" replace />} />
<Route path="/egp/tap/:id" element={<Navigate to={`/egp/iniciacao/${id}`} replace />} />
<Route path="/egp/eap" element={<Navigate to="/egp/planejamento" replace />} />
<Route path="/egp/cronograma" element={<Navigate to="/egp/execucao" replace />} />
<Route path="/egp/medicoes" element={<Navigate to="/egp/controle" replace />} />
<Route path="/egp/custos" element={<Navigate to="/egp/execucao" replace />} />
<Route path="/egp/histograma" element={<Navigate to="/egp/execucao" replace />} />
<Route path="/egp/fluxo-os" element={<Navigate to="/egp/execucao" replace />} />
<Route path="/egp/reunioes" element={<Navigate to="/egp/controle" replace />} />
<Route path="/egp/indicadores" element={<Navigate to="/egp/controle" replace />} />
```

**Step 3: Commit**

```bash
git add frontend/src/components/EGPLayout.tsx frontend/src/App.tsx
git commit -m "feat(egp): update nav to 6 lifecycle views + legacy redirects"
```

---

### Task 0.3: Hooks — new CRUD hooks for 11 tables

**Files:**
- Modify: `frontend/src/hooks/usePMO.ts`

**Step 1: Add hooks for each new table**

For each new table, add the standard pattern (example for `pmo_riscos`):

```typescript
// ── Riscos ──
export function useRiscos(portfolioId?: string) {
  return useQuery({
    queryKey: ['pmo_riscos', portfolioId],
    queryFn: async () => {
      let q = supabase.from('pmo_riscos').select('*').order('created_at', { ascending: false })
      if (portfolioId) q = q.eq('portfolio_id', portfolioId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!portfolioId,
  })
}

export function useCriarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (risco: Partial<PMORisco>) => {
      const { data, error } = await supabase.from('pmo_riscos').insert(risco).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['pmo_riscos', v.portfolio_id] }),
  })
}

export function useAtualizarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...rest }: Partial<PMORisco> & { id: string }) => {
      const { data, error } = await supabase.from('pmo_riscos').update(rest).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ['pmo_riscos', d.portfolio_id] }),
  })
}

export function useDeletarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_riscos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['pmo_riscos', v.portfolio_id] }),
  })
}
```

Repeat this pattern for: `pmo_stakeholders`, `pmo_comunicacao`, `pmo_orcamento`, `pmo_riscos`, `pmo_plano_acao`, `pmo_entregaveis`, `pmo_documentos`, `pmo_avanco_fisico`, `pmo_licoes_aprendidas`, `pmo_aceite`, `pmo_desmobilizacao`.

**Step 2: Add types to `frontend/src/types/pmo.ts`**

Add interfaces for each new table matching the SQL schema.

**Step 3: Commit**

```bash
git add frontend/src/hooks/usePMO.ts frontend/src/types/pmo.ts
git commit -m "feat(egp): add CRUD hooks + types for 11 new lifecycle tables"
```

---

### Task 0.4: Shared sub-tab component

**Files:**
- Create: `frontend/src/components/EGPSubTabs.tsx`

**Step 1: Create reusable sub-tab component**

A horizontal pill-tab row used inside each lifecycle view to switch between sub-abas. Same visual language as financeiro pipeline stages.

```typescript
import { useTheme } from '../contexts/ThemeContext'

interface Tab {
  key: string
  label: string
  icon?: React.ElementType
  count?: number
}

interface EGPSubTabsProps {
  tabs: Tab[]
  active: string
  onChange: (key: string) => void
  accent?: string // tailwind color name
}

export default function EGPSubTabs({ tabs, active, onChange, accent = 'blue' }: EGPSubTabsProps) {
  const { isDark } = useTheme()
  // Render horizontal pill tabs with flow arrows between them
  // Active tab gets accent bg, others get subtle bg
  // Show count badge if provided
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/EGPSubTabs.tsx
git commit -m "feat(egp): add EGPSubTabs shared component"
```

---

## Fase 1: Painel (Dashboard Consolidado)

### Task 1.1: EGP Painel page

**Files:**
- Create: `frontend/src/pages/pmo/EGPPainel.tsx`
- Modify: `frontend/src/App.tsx` (replace PMOHome import)

**Step 1: Build the dashboard**

Follow `Dashboard.tsx` (Compras) pattern exactly:
- `toneClasses()` helper (copy from Dashboard.tsx)
- `SpotlightMetric` component: Avanço Físico (teal), Prazo (amber/emerald), Custo Real (sky)
- `MiniInfoCard` component: Riscos Críticos, Recursos Críticos, Ações Críticas, Multas Ativas
- `HorizontalStatusBar`: distribuição por status das OSCs
- OSCs Críticas: 2 cards (Atrasadas red, SPI < 0.85 amber)
- Por Polo: barras horizontais com valor total
- Recentes: últimas 8 atualizações

**Data sources:**
- `usePortfolios()` — lista de OSCs
- `pmo_indicadores_snapshot` — KPIs calculados
- `pmo_riscos` WHERE criticidade = 'critico' — riscos críticos
- `pmo_plano_acao` WHERE status = 'pendente' AND prazo < now() — ações críticas
- `pmo_multas` WHERE status IN ('notificada','contestada','confirmada') — multas
- `pmo_histograma` WHERE quantidade_real < quantidade_planejada * 0.7 — recursos críticos

**Step 2: Wire route in App.tsx**

Replace `<Route path="/egp" element={<PMOHome />} />` with `<Route path="/egp" element={<EGPPainel />} />`

**Step 3: Commit**

```bash
git add frontend/src/pages/pmo/EGPPainel.tsx frontend/src/App.tsx
git commit -m "feat(egp): painel dashboard with KPIs, criticals, pipeline bar"
```

---

## Fase 2: Iniciação

### Task 2.1: Hub + Tabbed page

**Files:**
- Create: `frontend/src/pages/pmo/EGPIniciacaoHub.tsx`
- Create: `frontend/src/pages/pmo/EGPIniciacao.tsx`

**Step 1: Hub page**

Reuse `EGPPortfolioHub` with `screen="iniciacao"`.

```typescript
import EGPPortfolioHub from './EGPPortfolioHub'
import { Rocket } from 'lucide-react'

export default function EGPIniciacaoHub() {
  return <EGPPortfolioHub screen="iniciacao" title="Iniciação" icon={Rocket} accent="amber" description="TAP, Stakeholders e Comunicação" />
}
```

**Step 2: Tabbed page**

```typescript
// 3 sub-tabs: TAP → Stakeholders → Comunicação
// Reuse existing TapPage content for TAP tab
// New inline tables for Stakeholders and Comunicação
```

Each sub-tab is a panel rendered conditionally by `activeTab` state, using `EGPSubTabs` component.

**Step 3: Wire routes in App.tsx**

**Step 4: Commit**

```bash
git add frontend/src/pages/pmo/EGPIniciacaoHub.tsx frontend/src/pages/pmo/EGPIniciacao.tsx
git commit -m "feat(egp): iniciacao view with TAP + stakeholders + comunicacao tabs"
```

---

## Fase 3: Planejamento

### Task 3.1: Hub + Tabbed page

**Files:**
- Create: `frontend/src/pages/pmo/EGPPlanejamentoHub.tsx`
- Create: `frontend/src/pages/pmo/EGPPlanejamento.tsx`

**Step 1: Hub** — same pattern, `screen="planejamento"`, icon=Compass, accent="blue"

**Step 2: Tabbed page — 5 sub-tabs:**

```
[EAP] → [Cronograma] → [Histograma] → [Orçamento] → [Riscos]
```

- **EAP tab**: Embed existing `EAP.tsx` content (extract into `EAPContent` component if needed)
- **Cronograma tab**: Embed existing `Cronograma.tsx` content
- **Histograma tab**: Embed existing `Histograma.tsx` content
- **Orçamento tab**: New editable table using `pmo_orcamento` (disciplina, insumo, fase, valor_previsto)
- **Riscos tab**: New editable table using `pmo_riscos` (initial mapping — read-only matrix view + add/edit)

**Step 3: Commit**

```bash
git add frontend/src/pages/pmo/EGPPlanejamentoHub.tsx frontend/src/pages/pmo/EGPPlanejamento.tsx
git commit -m "feat(egp): planejamento view with EAP + cronograma + histograma + orcamento + riscos"
```

---

## Fase 4: Execução

### Task 4.1: Hub + Tabbed page

**Files:**
- Create: `frontend/src/pages/pmo/EGPExecucaoHub.tsx`
- Create: `frontend/src/pages/pmo/EGPExecucao.tsx`

**Step 1: Hub** — `screen="execucao"`, icon=Zap, accent="violet"

**Step 2: Tabbed page — 5 sub-tabs:**

```
[Cronograma] → [Histograma] → [Custos] → [Riscos] → [Plano de Ação]
```

- **Cronograma tab**: Gestão do Cronograma (foco em datas reais, % avanço, previsão). Reusa `pmo_tarefas` com campos `data_inicio_real`, `data_termino_real`, `percentual_concluido`. Ações de 1 clique:
  - "Solicitar Compra" → `navigate('/compras/requisicoes/nova?obra_id=X&cc=Y')`
  - "Solicitar Transporte" → `navigate('/logistica/solicitacoes?nova=1&obra_id=X')`
  - "Solicitar Contratação" → `navigate('/contratos/solicitacoes?nova=1&obra_id=X')`
- **Histograma tab**: Gestão de Recursos — atualização mensal real vs planejado
- **Custos tab**: Embed `ControleCustos.tsx` content + integração com `fin_contas_pagar`
- **Riscos tab**: Revisão mensal — reusa `pmo_riscos` com focus em edição
- **Plano de Ação tab**: Tabela CRUD `pmo_plano_acao`

**Step 3: Commit**

```bash
git add frontend/src/pages/pmo/EGPExecucaoHub.tsx frontend/src/pages/pmo/EGPExecucao.tsx
git commit -m "feat(egp): execucao view with cronograma + histograma + custos + riscos + plano acao"
```

---

## Fase 5: Controle

### Task 5.1: Hub + Tabbed page

**Files:**
- Create: `frontend/src/pages/pmo/EGPControleHub.tsx`
- Create: `frontend/src/pages/pmo/EGPControle.tsx`

**Step 1: Hub** — `screen="controle"`, icon=BarChart3, accent="emerald"

**Step 2: Tabbed page — 4 sub-tabs:**

```
[Medições] → [Eventos] → [Status Report] → [Indicadores]
```

- **Medições tab**: Embed `Medicoes.tsx` content + botão "Solicitar Faturamento"
- **Eventos tab**: 3 seções colapsáveis — Mudanças (`pmo_mudancas`), Multas (`pmo_multas`), Pleitos (extension)
- **Status Report tab**: Embed `StatusReportList.tsx` content (filtrado por portfolioId)
- **Indicadores tab**: KPI dashboard com SPI/CPI/IDC/IDP + gráfico de evolução temporal

**Step 3: Commit**

```bash
git add frontend/src/pages/pmo/EGPControleHub.tsx frontend/src/pages/pmo/EGPControle.tsx
git commit -m "feat(egp): controle view with medicoes + eventos + status report + indicadores"
```

---

## Fase 6: Encerramento

### Task 6.1: Hub + Tabbed page

**Files:**
- Create: `frontend/src/pages/pmo/EGPEncerramentoHub.tsx`
- Create: `frontend/src/pages/pmo/EGPEncerramento.tsx`

**Step 1: Hub** — `screen="encerramento"`, icon=CheckCircle2, accent="teal"

**Step 2: Tabbed page — 4 sub-tabs:**

```
[Status Report] → [Lições Aprendidas] → [Aceite] → [Desmobilização]
```

- **Status Report tab**: Relatório final (reusa pmo_status_report)
- **Lições tab**: Tabela CRUD `pmo_licoes_aprendidas` (fase, descrição, tipo +/-, recomendação)
- **Aceite tab**: Formulário `pmo_aceite` com upload de assinatura (Certisign integration)
- **Desmobilização tab**: Checklist CRUD `pmo_desmobilizacao` com categorias e status

**Step 3: Commit**

```bash
git add frontend/src/pages/pmo/EGPEncerramentoHub.tsx frontend/src/pages/pmo/EGPEncerramento.tsx
git commit -m "feat(egp): encerramento view with licoes + aceite + desmobilizacao"
```

---

## Fase 7: Integrações

### Task 7.1: Contratos → EGP (Iniciação com IA)

**Files:**
- Modify: `frontend/src/pages/pmo/EGPIniciacao.tsx` (TAP tab)

Add "Novo contrato disponível" banner when `con_contratos` has a contract with `status = 'assinado'` that has no linked `pmo_portfolio`. Button "Iniciar OSC a partir do contrato" creates portfolio + triggers AI TAP generation.

### Task 7.2: EGP → Obras (atividades planejadas no RDO)

**Files:**
- Modify: `frontend/src/pages/pmo/EGPExecucao.tsx` (Cronograma tab)

Add "Publicar no RDO" action on tasks — inserts planned activities visible in Obras module.

### Task 7.3: Obras → EGP (apontamentos atualizam cronograma)

**Files:**
- Modify: `frontend/src/hooks/usePMO.ts`

Add hook `useAvancoFromObras(portfolioId)` that queries `obr_apontamentos WHERE obra_id` and computes % real + previsão.

### Task 7.4: EGP → Compras/Logística/Contratos (1 clique)

**Files:**
- Modify: `frontend/src/pages/pmo/EGPExecucao.tsx` (Cronograma tab)

Add action buttons that navigate with query params:
- `navigate('/compras/requisicoes/nova?obra_id=X&descricao=Y')`
- `navigate('/logistica/solicitacoes?nova=1&obra_id=X')`
- `navigate('/contratos/solicitacoes?nova=1&obra_id=X')`

### Task 7.5: Obras → EGP (medições)

**Files:**
- Modify: `frontend/src/pages/pmo/EGPControle.tsx` (Medições tab)

Add "Solicitar Faturamento" button → creates `fis_solicitacoes_nf` record.

---

## Fase 8: Cleanup + Deploy

### Task 8.1: Remove old standalone pages that are now embedded

Old files to remove (functionality moved into lifecycle views):
- `frontend/src/pages/pmo/TapHub.tsx` → embedded in EGPIniciacao
- `frontend/src/pages/pmo/EAPHub.tsx` → embedded in EGPPlanejamento
- `frontend/src/pages/pmo/CronogramaHub.tsx` → embedded in EGPPlanejamento/EGPExecucao
- `frontend/src/pages/pmo/MedicoesHub.tsx` → embedded in EGPControle
- `frontend/src/pages/pmo/HistogramaHub.tsx` → embedded in EGPPlanejamento/EGPExecucao
- `frontend/src/pages/pmo/CustosHub.tsx` → embedded in EGPExecucao

Keep the actual content pages (TapPage, EAP, Cronograma, etc.) — they're reused as embedded content.

### Task 8.2: Build + test + deploy

```bash
cd frontend && npx vite build
git add -A && git commit -m "feat(egp): complete lifecycle redesign"
git push origin feat/egp-lifecycle
gh pr create --title "feat(egp): redesign ciclo de vida 6 visões" --body "..."
```

---

## Execution Order Summary

| Fase | Tasks | Deliverable |
|------|-------|-------------|
| 0 | 0.1-0.4 | Infra: DB + Nav + Hooks + SubTabs component |
| 1 | 1.1 | Painel dashboard (same pattern as Compras) |
| 2 | 2.1 | Iniciação: TAP + Stakeholders + Comunicação |
| 3 | 3.1 | Planejamento: EAP + Cronograma + Histograma + Orçamento + Riscos |
| 4 | 4.1 | Execução: Cronograma + Histograma + Custos + Riscos + Plano Ação |
| 5 | 5.1 | Controle: Medições + Eventos + Status Report + Indicadores |
| 6 | 6.1 | Encerramento: Status Report + Lições + Aceite + Desmobilização |
| 7 | 7.1-7.5 | Integrações cross-módulo |
| 8 | 8.1-8.2 | Cleanup + Deploy |

**Cada fase pode ser commitada e deployada independentemente.**


## Links
- [[obsidian/31 - Módulo PMO-EGP]]
