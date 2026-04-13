---
title: Guia de Estilo UI
type: dev-guide
status: ativo
tags: [ui, ux, design, tailwind, componentes, estilo]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[02 - Frontend Stack]]", "[[04 - Componentes]]", "[[36 - Guia de Contribuição]]"]
---

# 🎨 Guia de Estilo UI — TEG+ ERP

---

## Paleta de Cores

### Cores Primárias

| Cor | Tailwind | Hex | Uso |
|-----|----------|-----|-----|
| Indigo | `indigo-600` | `#4F46E5` | Ações primárias, links, header |
| Indigo Light | `indigo-100` | `#E0E7FF` | Backgrounds de destaque |
| Indigo Dark | `indigo-800` | `#3730A3` | Hover, active states |

### Cores de Status

| Status | Cor | Tailwind | Badge |
|--------|-----|----------|-------|
| Aprovado / Ativo | Verde | `green-100/700` | `bg-green-100 text-green-700` |
| Pendente / Aguardando | Amarelo | `yellow-100/700` | `bg-yellow-100 text-yellow-700` |
| Rejeitado / Erro | Vermelho | `red-100/700` | `bg-red-100 text-red-700` |
| Em andamento | Azul | `blue-100/700` | `bg-blue-100 text-blue-700` |
| Rascunho / Backlog | Cinza | `gray-100/600` | `bg-gray-100 text-gray-600` |
| Cancelado | Cinza escuro | `gray-200/500` | `bg-gray-200 text-gray-500` |

### Cores por Módulo (Sidebar)

| Módulo | Cor accent |
|--------|-----------|
| Compras | Indigo |
| Financeiro | Emerald |
| Contratos | Violet |
| Logística | Orange |
| Estoque | Teal |
| Frotas | Slate |
| RH | Pink |
| Obras | Amber |
| SSMA | Red |

---

## Tipografia

| Elemento | Classes Tailwind |
|----------|-----------------|
| H1 (título de página) | `text-2xl font-bold text-gray-900` |
| H2 (seção) | `text-xl font-semibold text-gray-800` |
| H3 (sub-seção) | `text-lg font-medium text-gray-700` |
| Body | `text-sm text-gray-600` |
| Label | `text-xs font-medium text-gray-500 uppercase` |
| Valor destaque | `text-2xl font-bold` |
| Código | `font-mono text-sm` |

---

## Espaçamento

| Contexto | Padrão |
|----------|--------|
| Padding de página | `p-6` |
| Gap entre cards | `gap-4` ou `gap-6` |
| Padding interno card | `p-4` |
| Margin entre seções | `mb-6` ou `space-y-6` |
| Padding de tabela | `px-4 py-3` |

---

## Componentes Padrão

### Card

```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
  <h3 className="text-lg font-semibold text-gray-800 mb-2">Título</h3>
  <p className="text-sm text-gray-600">Conteúdo</p>
</div>
```

### Botão Primário

```tsx
<button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
  Ação Principal
</button>
```

### Botão Secundário

```tsx
<button className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
  Ação Secundária
</button>
```

### Status Badge

```tsx
const statusColors = {
  aprovado: 'bg-green-100 text-green-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  rejeitado: 'bg-red-100 text-red-700',
  rascunho: 'bg-gray-100 text-gray-600',
}

<span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
  {status}
</span>
```

### Input / Form Field

```tsx
<label className="block text-xs font-medium text-gray-500 uppercase mb-1">
  Nome do Campo
</label>
<input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
```

### Tabela

```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-gray-200">
      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Coluna</th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-3">Valor</td>
    </tr>
  </tbody>
</table>
```

---

## KPI Card (Dashboard)

```tsx
<div className="bg-white rounded-xl border border-gray-200 p-4">
  <p className="text-xs font-medium text-gray-500 uppercase">Métrica</p>
  <p className="text-2xl font-bold text-gray-900 mt-1">R$ 1.234.567</p>
  <p className="text-xs text-green-600 mt-1">↑ 12% vs mês anterior</p>
</div>
```

---

## Ícones

- Biblioteca: **Lucide React** (`lucide-react`)
- Tamanho padrão: `size={18}` em botões, `size={20}` em headers
- Cor: herda do texto pai (`currentColor`)

---

## Responsividade

| Breakpoint | Tailwind | Comportamento |
|------------|----------|---------------|
| Mobile | `< sm` | 1 coluna, sidebar colapsada |
| Tablet | `sm` - `lg` | 2 colunas, sidebar mini |
| Desktop | `lg+` | Grid completo, sidebar expandida |

Padrão de grid:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

---

## Regras Gerais

- ✅ Usar Tailwind utility classes (não CSS customizado)
- ✅ `rounded-xl` para cards, `rounded-lg` para inputs/botões
- ✅ `shadow-sm` para elevação sutil
- ✅ Transições: `transition-colors` em botões/links
- ❌ Não usar cores hardcoded (hex direto)
- ❌ Não misturar padrões de border-radius
- ❌ Não usar `!important`

---

## Links

- [[04 - Componentes]] — Catálogo de componentes
- [[02 - Frontend Stack]] — Stack técnico
- [[36 - Guia de Contribuição]] — Padrões de código
