---
title: Componentes
type: frontend
status: ativo
tags: [frontend, componentes, react, ui]
criado: 2026-03-02
atualizado: 2026-03-03
relacionado: ["[[02 - Frontend Stack]]", "[[03 - Páginas e Rotas]]"]
---

# Componentes — TEG+ ERP

## Mapa de Componentes

```
src/components/
│
├── ── Layouts de Módulo ──────────────────────────────────────────
│   ├── Layout.tsx               → Sidebar Compras (teal)
│   ├── FinanceiroLayout.tsx     → Sidebar Financeiro (emerald)
│   ├── EstoqueLayout.tsx        → Sidebar Estoque (blue)
│   ├── LogisticaLayout.tsx      → Sidebar Logística (orange)
│   ├── FrotasLayout.tsx         → Sidebar Frotas (rose)
│   └── RHLayout.tsx             → Sidebar RH (violet) [novo]
│
├── ── Auth & Navegação ───────────────────────────────────────────
│   └── PrivateRoute.tsx         → Guards (PrivateRoute + AdminRoute)
│
├── ── UI / Feature ───────────────────────────────────────────────
│   ├── BannerSlideshow.tsx      → Slideshow da tela inicial [novo]
│   ├── LogoTeg.tsx              → Logo animado TEG+
│   ├── CategoryCard.tsx         → Card de categoria (wizard)
│   ├── CotacaoComparativo.tsx   → Tabela comparativa de cotações
│   ├── FluxoTimeline.tsx        → Timeline do fluxo de requisição
│   ├── KpiCard.tsx              → Card de métrica KPI
│   └── StatusBadge.tsx          → Badge de status colorido
```

---

## Layouts de Módulo

Todos os layouts seguem o mesmo padrão arquitetural:

```
┌─────────────────────────────────────────────────────────────────┐
│  DESKTOP (md+)                                                  │
│  ┌──────────────┬──────────────────────────────────────────┐   │
│  │  Sidebar     │                                          │   │
│  │  [Badge mod] │           <Outlet />                     │   │
│  │  [Nav items] │        (conteúdo da página)              │   │
│  │  [Footer]    │                                          │   │
│  └──────────────┴──────────────────────────────────────────┘   │
│                                                                 │
│  MOBILE (< md)                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Header: ícone + nome + ≡ menu                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  [Drawer: nav items ao abrir ≡]                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                  <Outlet />                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

| Layout | Módulo | Accent | Nav items |
|--------|--------|--------|-----------|
| `Layout.tsx` | Compras | teal `#14B8A6` | Dashboard, Nova Req, Requisições, Cotações, Pedidos |
| `FinanceiroLayout.tsx` | Financeiro | emerald `#10B981` | Painel, CP, CR, Aprovações, Conciliação, Relatórios, Fornecedores, Config |
| `EstoqueLayout.tsx` | Estoque | blue `#3B82F6` | Painel, Itens, Movimentações, Inventário, Patrimonial |
| `LogisticaLayout.tsx` | Logística | orange `#EA580C` | Painel, Transportes, Recebimentos, Expedição, Solicitações, Transportadoras |
| `FrotasLayout.tsx` | Frotas | rose `#F43F5E` | Painel, Veículos, Ordens, Checklists, Abastecimentos, Telemetria |
| `RHLayout.tsx` | RH | violet `#8B5CF6` | Painel, Mural de Recados (admin only 🔐) |

---

## `BannerSlideshow.tsx` ⭐ (novo)

**Slideshow cinematográfico** exibido entre o hero e a grade de módulos na tela inicial.

```
┌────────────────────────────────────────────────────────────┐
│  [← prev]  [ imagem full-bleed · Ken Burns zoom ]  [next →] │
│                                       ┌─────────────────┐  │
│                                       │ 📌 Comunicado   │  │  ← badge tipo
│  TEG+ Comunicados ·                   └─────────────────┘  │
│  TÍTULO DO BANNER                                           │  ← eyebrow + título
│  Subtítulo descritivo...                                    │  ← subtítulo
│                                                             │
│  ●○○  2/3 ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░                    │  ← dots + progress
└────────────────────────────────────────────────────────────┘
  aspect-ratio: 21/8
```

**Funcionalidades:**
| Feature | Implementação |
|---------|--------------|
| Ken Burns | `@keyframes kenBurns` — scale 1→1.10, 10s infinite alternate |
| Crossfade | Stack de layers, `opacity` transition 700ms |
| Progress bar | `@keyframes slideProgress` width 0→100%, reinicia via `key` prop |
| Dot indicators | Pill ativo `w-5 h-1.5` + bolinhas `w-1.5 h-1.5` |
| Arrows | Glassmorphic, `opacity-0` → `opacity-100` no hover (desktop) |
| Touch/swipe | diff > 48px detecta direção |
| Teclado | `ArrowLeft` / `ArrowRight` globais |
| Pause on hover | Timer limpo + indicator "pausado" |
| Auto-advance | Intervalo 5.5s |
| Default slides | 3 banners padrão quando banco vazio |

**Hook:** `useBanners()` — carrega apenas banners ativos e vigentes. Ver [[25 - Mural de Recados]].

---

## `RHLayout.tsx` (novo)

Layout violet para o módulo RH. Comportamento: oculta o item "Mural de Recados" do nav quando `isAdmin === false`.

```tsx
const visibleNav = NAV.filter(n => !n.adminOnly || isAdmin)
```

---

## `PrivateRoute.tsx`

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

## `LogoTeg.tsx`

- Logo animado com efeito glow teal
- Variantes de tamanho (`size` prop em px)
- Props: `animated`, `glowing`

---

## `KpiCard.tsx`

```
┌──────────────────────────┐
│  📦  [Ícone]             │
│  142          [Título]   │
│  Total Requisições       │
│  ↑ 12% vs mês anterior   │
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

## `StatusBadge.tsx`

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

## `CategoryCard.tsx`

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

---

## `CotacaoComparativo.tsx`

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

---

## `FluxoTimeline.tsx`

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

---

## Padrões de Composição

```tsx
// Módulo com layout (ex. RH)
<RHLayout>          // ← sidebar violet
  <RHHome />        // → /rh
</RHLayout>

// Página com KPIs
<div className="p-6 space-y-6">
  <div className="grid grid-cols-4 gap-4">
    <KpiCard ... />
  </div>
  <FluxoTimeline ... />
  <StatusBadge status="aprovada" />
</div>
```

---

## Links Relacionados

- [[02 - Frontend Stack]] — Stack e dependências
- [[03 - Páginas e Rotas]] — Onde os componentes são usados
- [[05 - Hooks Customizados]] — Dados consumidos
- [[25 - Mural de Recados]] — BannerSlideshow e RHLayout
