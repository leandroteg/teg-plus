---
title: Componentes
type: frontend
status: ativo
tags: [frontend, componentes, react, ui]
criado: 2026-03-02
atualizado: 2026-04-08
relacionado: ["[[02 - Frontend Stack]]", "[[03 - Páginas e Rotas]]", "[[48 - Guia de Estilo UI]]", "[[36 - Guia de Contribuição]]"]
---

# Componentes — TEG+ ERP

## Mapa de Componentes

```
src/components/
│
├── ── Layouts de Módulo (18) ─────────────────────────────────────
│   ├── Layout.tsx               → Sidebar Compras (teal)
│   ├── ModuleLayout.tsx         → Layout genérico reutilizável (cor, nav, ícone via props)
│   ├── ApontamentosLayout.tsx   → Sidebar Apontamentos
│   ├── CadastrosLayout.tsx      → Sidebar Cadastros (slate)
│   ├── ContratosLayout.tsx      → Sidebar Contratos (cyan)
│   ├── ControladoriaLayout.tsx  → Sidebar Controladoria (amber)
│   ├── CulturaLayout.tsx        → Sidebar Cultura/Endomarketing
│   ├── EGPLayout.tsx            → Sidebar EGP/PMO (indigo)
│   ├── EstoqueLayout.tsx        → Sidebar Estoque (blue)
│   ├── FinanceiroLayout.tsx     → Sidebar Financeiro (emerald)
│   ├── FiscalLayout.tsx         → Sidebar Fiscal (pink)
│   ├── FrotasLayout.tsx         → Sidebar Frotas (rose)
│   ├── HeadcountLayout.tsx      → Sidebar HHt/Headcount
│   ├── LocacaoLayout.tsx        → Sidebar Locação
│   ├── LogisticaLayout.tsx      → Sidebar Logística (orange)
│   ├── ObrasLayout.tsx          → Sidebar Obras (yellow)
│   ├── PatrimonialLayout.tsx    → Sidebar Patrimonial (stone)
│   └── RHLayout.tsx             → Sidebar RH (violet)
│
├── ── Navegação / Header ────────────────────────────────────────
│   ├── NotificationBell.tsx     → Sino de notificações (badge count)
│   ├── ApprovalBadge.tsx        → Badge pulsante de aprovações pendentes
│   ├── LogoTeg.tsx              → Logo animado TEG+
│   └── ThemeToggle.tsx          → Alternância tema dark/light
│
├── ── Modals ────────────────────────────────────────────────────
│   ├── MagicModal.tsx           → Modal AI/Manual toggle (cadastros)
│   ├── SetPasswordModal.tsx     → Definição de senha (primeiro acesso)
│   ├── EmitirPedidoModal.tsx    → Emissão de pedido de compra
│   ├── FornecedorCadastroModal.tsx → Cadastro rápido de fornecedor
│   ├── ItemFormModal.tsx        → Formulário de item (estoque)
│   ├── RecebimentoModal.tsx     → Recebimento de materiais
│   └── UploadCotacao.tsx        → Upload e parse AI de cotações
│
├── ── Forms ─────────────────────────────────────────────────────
│   ├── AutoCodeField.tsx        → Campo com código auto-gerado
│   ├── ConfidenceField.tsx      → Campo com indicador de confiança AI (0-1)
│   ├── SmartTextField.tsx       → Campo inteligente com sugestões AI
│   ├── ItemAutocomplete.tsx     → Autocomplete de itens do catálogo
│   └── AiDropZone.tsx           → Zona de drop para upload + parse AI
│
├── ── Data Display ──────────────────────────────────────────────
│   ├── CardList.tsx             → Lista de cards genérica
│   ├── CategoryCard.tsx         → Card de categoria (wizard)
│   ├── FluxoTimeline.tsx        → Timeline do fluxo de requisição
│   ├── LocFluxoTimeline.tsx     → Timeline do fluxo de locação
│   ├── StatusBadge.tsx          → Badge de status colorido
│   ├── KpiCard.tsx              → Card de métrica KPI
│   ├── Pagination.tsx           → Paginação reutilizável
│   └── CotacaoComparativo.tsx   → Tabela comparativa + badges de recomendação
│
├── ── AI / Chat ─────────────────────────────────────────────────
│   ├── SuperTEGChat.tsx         → Chat AI flutuante (FAB inferior direito)
│   └── AiDropZone.tsx           → Drop zone para parse AI de documentos
│
├── ── Skeletons ─────────────────────────────────────────────────
│   ├── DashboardSkeleton.tsx    → Skeleton do dashboard (KPIs + gráficos)
│   ├── PageSkeleton.tsx         → Skeleton genérico de página
│   └── TableSkeleton.tsx        → Skeleton de tabela
│
├── ── Módulo Logística ──────────────────────────────────────────
│   ├── PlanejamentoRotaModal.tsx → Modal com mapa Leaflet + autocomplete
│   ├── RomaneioDocumentoCard.tsx  → Card de documento de romaneio
│   └── NovaSolicitacaoModal.tsx   → Nova solicitação de transporte
│
├── ── Módulo Frotas ─────────────────────────────────────────────
│   ├── VistoriaChecklist.tsx    → Checklist de vistoria veicular
│   └── VistoriaComparativo.tsx  → Comparação entre vistorias
│
└── ── Route Guards ──────────────────────────────────────────────
    ├── ModuleRoute.tsx          → Guard por módulo (hasModule check)
    ├── PrivateRoute.tsx         → Guard de autenticação
    └── AdminRoute.tsx           → Guard de admin (role === 'admin')
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

### Catálogo de Layouts

| Layout | Módulo | Accent | Nav Items Principais |
|--------|--------|--------|---------------------|
| `Layout.tsx` | Compras | teal `#14B8A6` | Dashboard, Nova Req, Requisições, Cotações, Pedidos |
| `ModuleLayout.tsx` | Genérico | via props | Configurável: cor, ícone, nav items |
| `ApontamentosLayout.tsx` | Apontamentos | — | Painel, Apontamentos |
| `CadastrosLayout.tsx` | Cadastros | slate | Fornecedores, Obras, Colaboradores, Classes, Centros Custo |
| `ContratosLayout.tsx` | Contratos | cyan | Painel, Contratos, Medições, Parcelas |
| `ControladoriaLayout.tsx` | Controladoria | amber | Painel, DRE, Orçamentos, KPIs, Cenários |
| `CulturaLayout.tsx` | Cultura | — | Endomarketing, Comunicação |
| `EGPLayout.tsx` | PMO/EGP | indigo | Portfólio, TAP, EAP, Cronograma, Status Reports |
| `EstoqueLayout.tsx` | Estoque | blue `#3B82F6` | Painel, Itens, Movimentações, Inventário |
| `FinanceiroLayout.tsx` | Financeiro | emerald `#10B981` | Painel, CP, CR, Aprovações, Conciliação, Tesouraria |
| `FiscalLayout.tsx` | Fiscal | pink | Painel, Pipeline NF, Histórico |
| `FrotasLayout.tsx` | Frotas | rose `#F43F5E` | Painel, Veículos, Ordens, Checklists, Abastecimentos |
| `HeadcountLayout.tsx` | HHt | — | Headcount, Alocação |
| `LocacaoLayout.tsx` | Locação | — | Painel, Acordos, Vistorias, Fluxo |
| `LogisticaLayout.tsx` | Logística | orange `#EA580C` | Painel, Transportes, Recebimentos, Expedição, Solicitações |
| `ObrasLayout.tsx` | Obras | yellow | Painel, Apontamentos, RDO, Adiantamentos |
| `PatrimonialLayout.tsx` | Patrimonial | stone | Painel, Imobilizados, Depreciação |
| `RHLayout.tsx` | RH | violet `#8B5CF6` | Painel, Mural de Recados (admin only) |

---

## Navegação / Header

### `NotificationBell.tsx`

Sino de notificações no header do `ModuleLayout`. Exibe badge com contagem de pré-cadastros pendentes e aprovações.

### `ApprovalBadge.tsx`

Badge que exibe contagem de aprovações pendentes com **animação pulse** quando `count > 0`. Usado em layouts para chamar atenção do aprovador.

```
┌──────────────────┐
│  ⏳ 3 pendentes  │  ← pulse animation quando > 0
└──────────────────┘
```

### `LogoTeg.tsx`

- Logo animado com efeito glow teal
- Variantes de tamanho (`size` prop em px)
- Props: `animated`, `glowing`

### `ThemeToggle.tsx`

Alterna entre tema `dark` e `light`. Persiste preferência no `localStorage` e no perfil do usuário.

---

## Modals

### `MagicModal.tsx`

Modal de cadastro com toggle **AI / Manual**. No modo AI, aceita texto livre, arquivo ou CNPJ e faz parse automático. No modo Manual, exibe formulário tradicional.

```
┌──────────────────────────────────────┐
│  [ AI ● ] [ Manual ○ ]              │
│  ┌──────────────────────────────────┐│
│  │  Cole texto, arquivo ou CNPJ    ││
│  │  [AiDropZone]                   ││
│  └──────────────────────────────────┘│
│  [Campos preenchidos com confiança] │
│  [Salvar]                [Cancelar] │
└──────────────────────────────────────┘
```

Usado em: [[28 - Módulo Cadastros AI]]

### `SetPasswordModal.tsx`

Exibido no primeiro acesso de usuários convidados via Magic Link. Solicita definição de senha. Controla o campo `senha_definida` no perfil.

### `EmitirPedidoModal.tsx`

Modal para emissão de Pedido de Compra (PO) a partir de uma cotação aprovada. Inclui: fornecedor selecionado, itens, condições de pagamento, parcelas.

### `RecebimentoModal.tsx`

Modal de recebimento de materiais. Permite registrar recebimento parcial ou total dos itens de um pedido. Integra com estoque (criação de movimentação).

### `UploadCotacao.tsx`

Drag & drop de arquivo (PDF, imagem) que envia para o [[10 - n8n Workflows|workflow AI Parse Cotação]]. Auto-preenche fornecedor, itens e preços.

---

## Forms

### `AutoCodeField.tsx`

Campo que gera código sequencial automático (ex: `FRN-0042`). Consulta o próximo número disponível no Supabase.

### `ConfidenceField.tsx`

Campo de formulário que exibe indicador visual de confiança do parse AI (0-1). Cores: verde (>0.8), amarelo (0.5-0.8), vermelho (<0.5).

### `SmartTextField.tsx`

Campo de texto com sugestões inteligentes baseadas em histórico e contexto.

### `ItemAutocomplete.tsx`

Autocomplete que busca itens do catálogo de estoque (`est_itens`). Suporta busca por nome, código ou descrição.

### `AiDropZone.tsx`

Zona de drop para upload de documentos com parse AI automático. Aceita PDF, imagens (JPG, PNG, WebP). Integra com n8n.

---

## Data Display

### `KpiCard.tsx`

```
┌──────────────────────────┐
│  [Ícone]                 │
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

### `StatusBadge.tsx`

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

### `CotacaoComparativo.tsx`

Tabela de comparação de fornecedores com **badges de recomendação** (scoring multi-critério).

```
┌──────────┬──────────┬──────────┬──────────┐
│ Item     │ Forn. A  │ Forn. B  │ Forn. C  │
├──────────┼──────────┼──────────┼──────────┤
│ Cabo ... │ R$150    │ R$140 ★  │ R$165    │
│ Conect.  │ R$ 45 ★  │ R$ 52    │ R$ 48    │
├──────────┼──────────┼──────────┼──────────┤
│ TOTAL    │ R$195    │ R$192 ★  │ R$213    │
│ RECOM.   │          │ Melhor   │          │
└──────────┴──────────┴──────────┴──────────┘
  ★ = cotacaoRecomendacao — scoring por preço, prazo, histórico
```

### `FluxoTimeline.tsx`

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

### `LocFluxoTimeline.tsx`

Timeline específica para o fluxo de locação de equipamentos. Etapas: solicitação → vistoria → acordo → devolução.

### `CategoryCard.tsx`

Card de seleção de categoria no wizard de nova requisição. Exibe apenas **ícone + nome** da categoria. Dados de comprador e aprovador foram removidos para simplificar o visual e reduzir o espaço ocupado (2026-04-08).

```
┌─────────────────────────────────┐
│  [ícone]  Nome da Categoria  ✓ │  ← check só quando selecionado
└─────────────────────────────────┘
```

**Props:** `categoria`, `selected`, `onClick`

### `Pagination.tsx`

Componente de paginação reutilizável. Props: `page`, `totalPages`, `onPageChange`. Usado em tabelas de listagem.

---

## AI / Chat

### `SuperTEGChat.tsx`

FAB flutuante no canto inferior direito. Abre painel de chat com o agente AI SuperTEG (via n8n).

**Funcionalidades:**
- Envio de mensagens de texto
- Botões de ação (navegação, pré-cadastro)
- Histórico de sessão
- Integração com [[10 - n8n Workflows|SuperTEG AI Agent]]

---

## Skeletons

| Skeleton | Uso |
|----------|-----|
| `DashboardSkeleton` | Loading state do dashboard (4 KPIs + gráfico + tabela) |
| `PageSkeleton` | Loading state genérico de página |
| `TableSkeleton` | Loading state de tabela com linhas animadas |

---

## Componentes Específicos de Módulo

### `PlanejamentoRotaModal.tsx` (Logística)

Modal com **mapa Leaflet** interativo para planejamento de rota de transporte. Inclui autocomplete de endereços e cálculo de distância.

### `RomaneioDocumentoCard.tsx` (Logística)

Card de visualização de documento de romaneio de carga.

### `NovaSolicitacaoModal.tsx` (Logística/Estoque)

Modal para criação de nova solicitação de transporte ou material.

### `VistoriaChecklist.tsx` (Frotas)

Checklist digital de vistoria veicular com itens configuráveis e fotos.

### `VistoriaComparativo.tsx` (Frotas)

Comparação lado a lado de duas vistorias do mesmo veículo (ex: entrega vs. devolução).

---

## Route Guards

### `ModuleRoute.tsx`

Guard de rota por módulo. Verifica se o usuário tem acesso ao módulo via `hasModule()`. Admin bypassa.

```tsx
<ModuleRoute moduleKey="financeiro">
  <FinanceiroLayout />
</ModuleRoute>
```

### `PrivateRoute.tsx`

Guard de autenticação. Redireciona para `/login` se não autenticado.

### `AdminRoute.tsx`

Guard de administrador. Redireciona para `/` se `role !== 'admin'`.

```tsx
// Composição em rotas
<PrivateRoute>
  <ModuleRoute moduleKey="compras">
    <Layout>
      <Dashboard />
    </Layout>
  </ModuleRoute>
</PrivateRoute>
```

---

## Padrões de Composição

```tsx
// Módulo com layout específico
<ModuleRoute moduleKey="rh">
  <RHLayout>
    <Outlet />
  </RHLayout>
</ModuleRoute>

// Página com KPIs + Timeline
<div className="p-6 space-y-6">
  <div className="grid grid-cols-4 gap-4">
    <KpiCard ... />
  </div>
  <FluxoTimeline ... />
  <StatusBadge status="aprovada" />
</div>

// Modal com MagicModal AI
<MagicModal entity="fornecedor" onSave={handleSave}>
  <AiDropZone onParse={handleParse} />
</MagicModal>
```

---

## Links Relacionados

- [[02 - Frontend Stack]] — Stack e dependências
- [[03 - Páginas e Rotas]] — Onde os componentes são usados
- [[05 - Hooks Customizados]] — Dados consumidos
- [[09 - Auth Sistema]] — ModuleRoute e RBAC
- [[10 - n8n Workflows]] — AI Parse e SuperTEG
- [[25 - Mural de Recados]] — BannerSlideshow e RHLayout
- [[28 - Módulo Cadastros AI]] — MagicModal e AiDropZone
