---
title: "22 - Módulo Estoque e Patrimonial"
type: módulo
status: ativo
tags: [estoque, patrimonial, almoxarifado, inventario, depreciacao, imobilizados, frotas, heatmap]
criado: 2026-03-03
atualizado: 2026-06-26
relacionado:
  - "[[PILAR - Suprimentos]]"
  - "[[00 - TEG+ INDEX]]"
  - "[[07 - Schema Database]]"
  - "[[24 - Módulo Frotas e Manutenção]]"
---

# 📦 Módulo Estoque e Patrimonial

## Visão Geral

Módulo de controle de almoxarifado (estoque físico) e gestão de imobilizados (patrimônio fixo). O **painel patrimonial** (`/patrimonial`) consolida patrimônio + frota própria numa visão única por categoria e base.

---

## Estrutura de Rotas

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/estoque` | `EstoqueHome` | Dashboard com KPIs de almoxarifado |
| `/estoque/itens` | `Itens` | Catálogo de itens com curva ABC |
| `/estoque/movimentacoes` | `Movimentacoes` | Entradas, saídas, transferências |
| `/estoque/inventario` | `Inventario` | Sessões de inventário e contagem |
| `/estoque/patrimonial` | `Patrimonial` | CRUD de imobilizados e depreciação |
| `/patrimonial` | `PatrimonialHome` | **Painel consolidado** patrimônio + frota |

---

## Banco de Dados

### Estoque

```
est_bases               → almoxarifados / bases físicas (compartilhado com módulo Bases)
est_localizacoes        → endereçamento (corredor/prateleira/posição)
est_itens               → catálogo com curva ABC, mín/máx, lead time
est_saldos              → saldo por item + base (atualizado por trigger fn_atualiza_saldo_estoque)
est_movimentacoes       → todos os movimentos (entrada/saída/transferência/ajuste)
est_solicitacoes        → solicitações de material para obras
est_solicitacao_itens   → itens de cada solicitação
est_inventarios         → sessões de inventário
est_inventario_itens    → contagem por item na sessão
```

### Patrimonial

```
pat_imobilizados        → ativo fixo (623 itens reimportados em 26/06/2026)
pat_movimentacoes       → transferência, cessão, manutenção, retorno
pat_termos_responsabilidade → termos digitais por imobilizado
pat_depreciacoes        → registro mensal de depreciação por competência
```

**Colunas-chave de `pat_imobilizados`:**

| Coluna | Tipo | Obs |
|--------|------|-----|
| `numero_patrimonio` | text UNIQUE NOT NULL | Código (ex: PAT-001, S/TAG-NNN para sem etiqueta) |
| `descricao` | text NOT NULL | Nome do item |
| `categoria` | text NOT NULL | Ver categorias abaixo |
| `valor_aquisicao` | numeric default 0 | Valor oficial ou estimado |
| `status` | enum `pat_status_imob` | ativo / em_manutencao / cedido / baixado / em_transferencia / pendente_registro |
| `base_id` | uuid FK → est_bases | Base de alocação |

### View de integração: `pat_view_frotas`

View `security_invoker=true` que faz **UNION** entre `pat_imobilizados` e `fro_veiculos`:

- Frotas aparecem como categoria `'Frotas'`
- Exclui frota locada (`propriedade != 'locada'`)
- Exclui itens já linkados via `fro_veiculos.pat_item_id` (evita duplicação)
- Usada pelo hook `useImobilizadosComFrota()` e pelo `PatrimonialHome`

---

## Categorias de Patrimônio (vigentes Jun/2026)

| Categoria | Conteúdo |
|-----------|---------|
| Mobília e Eletrodomésticos | Móveis, eletrodomésticos, ar-condicionado |
| Informática e Comunicação | TI, comunicação, telefonia |
| Equipamentos | Ferramentas, máquinas de campo, equipamentos gerais |
| Utensílios | Utensílios de canteiro (caixas térmicas, etc.) |
| Frotas | Veículos/máquinas de `fro_veiculos` via pat_view_frotas |

> Categoria "Outros" foi eliminada. ACs → Mobília. Caixas térmicas → Utensílios. Móveis e Mobília unificados. Informática + Comunicação + Telefonia unificados.

---

## Painel Patrimonial (`PatrimonialHome.tsx`) — `/patrimonial`

### KPI Cards

| Card | Fonte |
|------|-------|
| Total Ativos | `pat_view_frotas.length` |
| Valor Total | soma de `valor_aquisicao` (patrimônio + frota própria); nota "patrimônio + frota" |
| Depreciação | calculada por KPIs de `pat_imobilizados` |
| Veículos (Equipamentos Críticos) | contagem de `fro_veiculos` |
| Notebooks (Equipamentos Críticos) | filtro por descrição em `pat_imobilizados` |

### Gráficos

- **Valor por Base** (barras horizontais): soma de `valor_aquisicao` agrupado por `base_id → nome` via `est_bases`; coluna "Sem base" sempre primeiro
- **Valor por Categoria** (barras horizontais): soma por categoria

### Heatmap — Itens por Categoria × Base

Matriz com:
- **Linhas** = categorias (ordenadas por total decrescente)
- **Colunas** = bases (ordenadas por total decrescente; "Sem base" primeira)
- **Células** = quantidade de itens; coloração em escala violeta relativa ao máximo
- **Ao lado direito** (1/3 da largura): **Top Equipamentos** — top 8 da categoria `'Equipamentos'` por `valor_aquisicao`

---

## Estado dos Dados (Jun/2026)

- **623 itens** reimportados do Excel "Controle geral PAT 250626.xlsx" em 26/06/2026
  - Valores oficiais aplicados (~460 itens via PATRIMONIO.xlsx)
  - Valores estimados por similaridade: ~163 itens
  - Sem TAG: código provisório `S/TAG-NNN`
- **61 veículos/máquinas próprios** lidos do `fro_veiculos` (23 locados excluídos)
- **Total consolidado:** 684 itens / ~R$ 19,9 mi (patrimônio ~R$ 2,06 mi + frota ~R$ 17,9 mi)
- **18 veículos** sem `base_id` em `fro_veiculos` (lacuna a corrigir no módulo Frotas)
- Integração via `fro_veiculos.pat_item_id` (soft ref, sem FK): ~80 itens ainda não linkados

---

## Depreciação Patrimonial

- **Cálculo:** `taxa_depreciacao_anual / 100 / 12 × valor_aquisicao`
- **Mínimo:** `MAX(valor_residual, valor_atual - depreciacao_mensal)`
- **Upsert** por `(imobilizado_id, competencia)` em `pat_depreciacoes`
- **Disparo:** botão "Depreciar" na tela `Patrimonial.tsx`

---

## Hooks

| Hook | Responsabilidade |
|------|-----------------|
| `useImobilizados()` | Lista `pat_imobilizados` |
| `useImobilizadosComFrota()` | Lê `pat_view_frotas` (patrimônio + frota própria) |
| `usePatrimonialKPIs()` | KPIs consolidados |
| `useCriarImobilizado()` | Mutation — novo item |
| `useAtualizarImobilizado()` | Mutation — editar item |
| `useCalcularDepreciacao()` | Mutation — depreciar por competência |

---

## Integração com Outros Módulos

| Módulo | Integração |
|--------|-----------|
| **Frotas** | `pat_view_frotas` lê `fro_veiculos`; `fro_veiculos.pat_item_id` aponta para `pat_imobilizados` |
| **Bases** | `base_id` FK → `est_bases`; nomes canônicos vêm daí |
| **Painéis** | `PatrimonialHome` registrado no hub `/paineis` |

> **Regra:** frota **locada** (`propriedade = 'locada'`) **não entra no patrimônio**.

---

## Arquivos Chave

```
frontend/src/
├── types/estoque.ts
├── hooks/usePatrimonial.ts          # inclui useImobilizadosComFrota
├── pages/estoque/Patrimonial.tsx    # CRUD imobilizados
└── pages/patrimonial/
    └── PatrimonialHome.tsx          # Painel consolidado
```

---

## Links Relacionados

- [[24 - Módulo Frotas e Manutenção]] — Frota própria integrada via pat_view_frotas
- [[07 - Schema Database]] — Tabelas pat_* e est_*
