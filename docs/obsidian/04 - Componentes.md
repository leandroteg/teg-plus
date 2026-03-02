---
title: Componentes
type: frontend
status: ativo
tags: [frontend, componentes, react, ui]
criado: 2026-03-02
relacionado: ["[[02 - Frontend Stack]]", "[[03 - Páginas e Rotas]]"]
---

# Componentes — TEG+ ERP

## Mapa de Componentes

```
src/components/
├── Layout.tsx           → Wrapper com sidebar e navegação
├── PrivateRoute.tsx     → Guards de autenticação
├── LogoTeg.tsx          → Logo animado TEG+
├── CategoryCard.tsx     → Card de seleção de categoria
├── CotacaoComparativo.tsx → Tabela comparativa de cotações
├── FluxoTimeline.tsx    → Timeline visual do fluxo
├── KpiCard.tsx          → Card de métrica KPI
└── StatusBadge.tsx      → Badge de status colorido
```

---

## Componentes de Layout

### `Layout.tsx`
**Wrapper principal** do módulo Compras.

```
┌─────────────────────────────────┐
│  [Logo TEG+]  Sidebar Nav       │
│  ─────────────────────────────  │
│  • Dashboard                    │
│  • Nova Requisição              │
│  • Requisições                  │
│  • Cotações                     │
│  • Pedidos                      │
│  ─────────────────────────────  │
│  [Perfil]  [Sair]               │
│─────────────────────────────────│
│                                 │
│     <Outlet /> (página)         │
│                                 │
└─────────────────────────────────┘
```

Props: `children: ReactNode`
Theme: Dark navy background, teal accent

---

### `PrivateRoute.tsx`
Dois tipos de guards:

```tsx
// Bloqueia não-autenticados → /login
<PrivateRoute>
  <ComponenteProtegido />
</PrivateRoute>

// Bloqueia não-admins → /compras
<AdminRoute>
  <AdminUsuarios />
</AdminRoute>
```

Usa: `AuthContext` → verifica `user` e `perfil.role`

---

### `LogoTeg.tsx`
- Logo animado com efeito **glow teal**
- Usa `animate-pulse-glow` (Tailwind custom)
- Variantes de tamanho: `sm`, `md`, `lg`

---

## Componentes de Feature

### `KpiCard.tsx`
Card de métrica do dashboard.

```
┌──────────────────────────┐
│  📦  [Ícone]             │
│                          │
│  142          [Título]   │
│  Total Requisições       │
│  ↑ 12% vs mês anterior  │
└──────────────────────────┘
```

**Props:**
```ts
{
  title: string
  value: string | number
  icon: LucideIcon
  subtitle?: string
  trend?: { value: number; positive: boolean }
  color?: 'primary' | 'success' | 'warning' | 'danger'
}
```

---

### `StatusBadge.tsx`
Badge colorido para status de requisições.

| Status | Cor | Label |
|--------|-----|-------|
| `rascunho` | Gray | Rascunho |
| `pendente` | Amber | Pendente |
| `em_aprovacao` | Blue | Em Aprovação |
| `aprovada` | Green | Aprovada |
| `rejeitada` | Red | Rejeitada |
| `cotacao_enviada` | Purple | Em Cotação |
| `cotacao_aprovada` | Teal | Cotação Aprovada |
| `pedido_emitido` | Indigo | Pedido Emitido |
| `entregue` | Green-dark | Entregue |
| `cancelada` | Gray-dark | Cancelada |

---

### `CategoryCard.tsx`
Card de seleção de categoria no wizard.

```
┌─────────────────────────┐
│  🔧  Ferramental        │
│  Comprador: Lauany      │
│  1 cotação até R$1k     │
│  2 cotações até R$5k    │
│  3 cotações > R$5k      │
└─────────────────────────┘
```

**Props:**
```ts
{
  categoria: Categoria
  selected: boolean
  onClick: () => void
}
```

---

### `CotacaoComparativo.tsx`
Tabela de comparação de fornecedores.

```
┌──────────┬──────────┬──────────┬──────────┐
│ Item     │ Forn. A  │ Forn. B  │ Forn. C  │
├──────────┼──────────┼──────────┼──────────┤
│ Cabo ... │ R$150    │ R$140 ✓  │ R$165    │
│ Conect.  │ R$ 45 ✓  │ R$ 52    │ R$ 48    │
├──────────┼──────────┼──────────┼──────────┤
│ TOTAL    │ R$195    │ R$192 ✓  │ R$213    │
└──────────┴──────────┴──────────┴──────────┘
```

Destaca o menor preço por item em verde.

---

### `FluxoTimeline.tsx`
Timeline visual do fluxo de uma requisição.

```
● Criada          2026-02-01 10:00
│
● Em Aprovação    2026-02-01 10:05
│  └ Coordenador: Aprovado
│
● Em Cotação      2026-02-02 09:00
│
○ Pedido Emitido  (pendente)
│
○ Entregue        (pendente)
```

**Props:**
```ts
{
  requisicao: Requisicao
  aprovacoes: Aprovacao[]
  atividades: AtividadeLog[]
}
```

---

## Padrões de Composição

```tsx
// Página típica do módulo Compras
<Layout>
  <div className="p-6 space-y-6">
    <div className="grid grid-cols-4 gap-4">
      <KpiCard ... />
      <KpiCard ... />
    </div>
    <FluxoTimeline ... />
    <StatusBadge status="aprovada" />
  </div>
</Layout>
```

---

## Links Relacionados

- [[02 - Frontend Stack]] — Stack e dependências
- [[03 - Páginas e Rotas]] — Onde os componentes são usados
- [[05 - Hooks Customizados]] — Dados consumidos pelos componentes
- [[14 - Compradores e Categorias]] — Dados do CategoryCard
