# Filtros por Grupo + Acompanhamento Top Tier — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar filtro por grupo de contrato em SolicitacoesLista e GestaoContratos, e criar seção de acompanhamento top tier na aba Contratos da Gestão.

**Architecture:** Migration primeiro (grupo_contrato em con_contratos), depois frontend aditivo — sem alterar funcionalidades existentes.

**Tech Stack:** Supabase (migration), React + TypeScript + Tailwind CSS, TanStack Query

---

### Task 1: Migration — grupo_contrato em con_contratos

**Files:**
- Create: `supabase/047_con_contratos_grupo.sql`

**Step 1: Criar e aplicar migration**

```sql
ALTER TABLE con_contratos ADD COLUMN IF NOT EXISTS grupo_contrato TEXT DEFAULT 'outro';

UPDATE con_contratos SET grupo_contrato = CASE
  WHEN tipo_categoria IN ('locacao','locacao_imovel_alojamento','locacao_imovel_canteiro','locacao_imovel_deposito') THEN 'locacao_imovel'
  WHEN tipo_categoria = 'locacao_veiculos' THEN 'locacao_veiculos'
  WHEN tipo_categoria IN ('locacao_equipamentos','locacao_ferramental') THEN 'locacao_equipamentos'
  WHEN tipo_categoria = 'pj_pessoa_fisica' THEN 'equipe_pj'
  WHEN tipo_categoria = 'prestacao_servico' THEN 'prestacao_servicos'
  WHEN tipo_categoria IN ('vigilancia_monitoramento','software_ti','contabilidade','internet_telefonia','servicos_medicos') THEN 'servico_recorrente'
  WHEN tipo_categoria IN ('fornecimento','aquisicao_equipamentos','aquisicao_ferramental','aquisicao_imovel','aquisicao_veiculos') THEN 'aquisicao'
  WHEN tipo_categoria IN ('subcontratacao','empreitada') THEN 'subcontratacao_empreitada'
  WHEN tipo_categoria IN ('consultoria','juridico_advocacia') THEN 'consultoria_juridico'
  WHEN tipo_categoria IN ('alimentacao_restaurante','hospedagem','frete_transportes') THEN 'apoio_operacional'
  WHEN tipo_categoria = 'seguros' THEN 'seguros'
  ELSE 'outro'
END
WHERE grupo_contrato IS NULL OR grupo_contrato = 'outro';

-- Herdar da solicitação quando disponível
UPDATE con_contratos c SET grupo_contrato = s.grupo_contrato
FROM con_solicitacoes s WHERE c.solicitacao_id = s.id AND c.grupo_contrato = 'outro';

CREATE INDEX IF NOT EXISTS idx_con_contratos_grupo ON con_contratos(grupo_contrato);
```

**Step 2: Atualizar Contrato interface em types**

Adicionar `grupo_contrato?: string` na interface `Contrato` em `frontend/src/types/contratos.ts`.

**Step 3: Commit**

---

### Task 2: SolicitacoesLista — filtro por grupo

**Files:**
- Modify: `frontend/src/pages/contratos/SolicitacoesLista.tsx`

**Step 1: Adicionar imports**

```typescript
import { GRUPO_CONTRATO_OPTIONS } from '../../constants/contratos'
import type { GrupoContrato } from '../../types/contratos'
```

**Step 2: Adicionar state**

```typescript
const [filtroGrupo, setFiltroGrupo] = useState<string>('')
```

**Step 3: Adicionar filtro no useMemo `filtered`**

Depois do filtro de busca, antes do sort:
```typescript
if (filtroGrupo) {
  items = items.filter(s => s.grupo_contrato === filtroGrupo)
}
```

**Step 4: Adicionar select na barra de filtros**

Ao lado da barra de busca existente, adicionar:
```tsx
<select
  value={filtroGrupo}
  onChange={e => setFiltroGrupo(e.target.value)}
  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
>
  <option value="">Todos os Grupos</option>
  {GRUPO_CONTRATO_OPTIONS.map(o => (
    <option key={o.value} value={o.value}>{o.label}</option>
  ))}
</select>
```

**Step 5: Commit**

---

### Task 3: GestaoContratos — filtro por grupo na aba Contratos

**Files:**
- Modify: `frontend/src/pages/contratos/GestaoContratos.tsx`

**Step 1: Adicionar imports**

```typescript
import { GRUPO_CONTRATO_OPTIONS, GRUPO_CONTRATO_LABEL } from '../../constants/contratos'
import type { GrupoContrato } from '../../types/contratos'
```

**Step 2: Adicionar state**

```typescript
const [filtroGrupo, setFiltroGrupo] = useState<string>('')
```

**Step 3: Aplicar filtro na lista de contratos**

No filtro existente da aba Contratos (onde filtra por status e tipo), adicionar:
```typescript
if (filtroGrupo) {
  filtered = filtered.filter(c => c.grupo_contrato === filtroGrupo)
}
```

**Step 4: Adicionar select dropdown**

Abaixo dos botões de status/tipo existentes:
```tsx
<select
  value={filtroGrupo}
  onChange={e => setFiltroGrupo(e.target.value)}
  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
>
  <option value="">Todos os Grupos</option>
  {GRUPO_CONTRATO_OPTIONS.map(o => (
    <option key={o.value} value={o.value}>{o.label}</option>
  ))}
</select>
```

**Step 5: Commit**

---

### Task 4: GestaoContratos — Acompanhamento Top Tier

**Files:**
- Modify: `frontend/src/pages/contratos/GestaoContratos.tsx`

Adicionar seção ENTRE os KPIs existentes e a lista de contratos na aba Contratos. **Não alterar nenhum código existente** — apenas inserir JSX novo.

**Step 1: Barra de status (stacked bar)**

Calcular contagem por status dos contratos filtrados. Renderizar barra horizontal com segmentos coloridos e legendas:

```tsx
{/* Barra de distribuição por status */}
<div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Distribuição por Status</h3>
  {/* stacked bar + legenda */}
</div>
```

Cores: em_negociacao=yellow, assinado=blue, vigente=emerald, suspenso=orange, encerrado=slate, rescindido=red.

**Step 2: Timeline de vencimentos próximos**

Filtrar contratos vigentes, ordenar por `data_fim_previsto` ASC, pegar top 5.
Calcular dias restantes. Badges: vermelho (<30d), amarelo (<90d), verde (>90d).

```tsx
<div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Próximos Vencimentos</h3>
  {/* lista de 5 contratos com countdown */}
</div>
```

**Step 3: Alertas ativos**

Cards compactos mostrando:
- Contratos suspensos (count, laranja)
- Parcelas atrasadas (count, vermelho) — usar `useParcelas` já importado
- Aditivos pendentes (count, âmbar) — usar `useAditivos` já importado
- Vencimentos <30 dias (count, vermelho)

```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  {/* 4 cards de alerta */}
</div>
```

**Step 4: Distribuição por grupo**

Barras horizontais mostrando quantidade de contratos por grupo. Ordenado por volume decrescente. Usa `GRUPO_CONTRATO_LABEL`.

```tsx
<div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Por Tipo de Contrato</h3>
  {/* barras horizontais */}
</div>
```

**Step 5: Layout — grid 2 colunas**

Organizar os 4 componentes em grid responsivo:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
  {/* Barra de status | Vencimentos */}
  {/* Alertas (full width) */}
  {/* Distribuição por grupo (full width) */}
</div>
```

**Step 6: Commit**

---

### Task 5: Verificar build + Push

**Step 1:** `cd frontend && npx tsc --noEmit`
**Step 2:** Verificar via preview que as telas renderizam sem erro
**Step 3:** `git push origin main`
