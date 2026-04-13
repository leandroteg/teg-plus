# Tesouraria TEG+ — Design Document

**Data:** 2026-03-12
**Status:** Aprovado
**Escopo:** Modulo novo de Tesouraria no Financeiro

---

## Contexto

- 1-3 contas bancarias (operacao enxuta)
- Foco principal: **controle de caixa** (saber quanto tem, prever entradas/saidas)
- Alimentacao: manual + **import OFX/CSV** de extratos bancarios
- CP/CR pagos alimentam movimentacoes automaticamente via triggers

## Abordagem Escolhida

**Cockpit Single-Page** — uma unica pagina rica com KPIs, grafico de fluxo de caixa, contas na lateral, movimentacoes embaixo. Tudo em uma tela, sem navegacao extra.

## Novas Tabelas

### fin_contas_bancarias
- id (uuid PK)
- nome (text NOT NULL) — ex: "Itau PJ"
- banco_codigo (text) — ex: "341"
- banco_nome (text) — ex: "Itau Unibanco"
- agencia (text)
- conta (text)
- tipo (text) — corrente | poupanca | investimento
- saldo_atual (numeric DEFAULT 0)
- saldo_atualizado_em (timestamptz)
- cor (text) — hex para UI, ex: "#FF6B00"
- ativo (boolean DEFAULT true)
- criado_em, atualizado_em (timestamptz)

### fin_movimentacoes_tesouraria
- id (uuid PK)
- conta_id (uuid FK → fin_contas_bancarias)
- tipo (text) — entrada | saida | transferencia
- valor (numeric NOT NULL)
- data_movimentacao (date NOT NULL)
- data_competencia (date)
- descricao (text)
- categoria (text) — pagamento_fornecedor | recebimento_cliente | transferencia | taxa_bancaria | rendimento | imposto | folha | outros
- cp_id (uuid FK → fin_contas_pagar, nullable)
- cr_id (uuid FK → fin_contas_receber, nullable)
- conciliado (boolean DEFAULT false)
- conciliado_em (timestamptz)
- origem (text) — manual | import_ofx | import_csv | auto_cp | auto_cr
- hash_import (text UNIQUE) — deduplicacao de imports
- criado_em, criado_por

### fin_extratos_import
- id (uuid PK)
- conta_id (uuid FK → fin_contas_bancarias)
- arquivo_url (text)
- nome_arquivo (text)
- formato (text) — ofx | csv
- periodo_inicio, periodo_fim (date)
- total_registros, importados, duplicados (int)
- status (text) — processando | concluido | erro
- importado_em, importado_por

## Layout do Cockpit

```
+-----------------------------------------------------------+
| Tesouraria                              [Periodo v]       |
+--------+--------+--------+--------+----------------------+
| Saldo  |Entradas| Saidas |Previsao|  Contas Bancarias    |
| Total  | Mes    | Mes    | 30d    |  - Itau    R$ XX     |
|R$ XXX  |R$ XXX  |R$ XXX  |R$ XXX  |  - BB      R$ XX     |
|        | ^ 12%  | v 8%   |        |  - Caixa   R$ XX     |
+--------+--------+--------+--------+                      |
| === FLUXO DE CAIXA ===============|  [+ Nova Conta]      |
| Grafico area: entradas (verde)    |  [^ Import OFX]      |
|    vs saidas (vermelho)           |                      |
|    + linha saldo acumulado        |----------------------|
|    Previsto (pontilhado) vs Real  |  AGING               |
|    Horizonte: 7d/30d/60d/90d      |  A Pagar  | A Receb  |
+-----------------------------------|  Hoje  XX | Hoje XX  |
| === MOVIMENTACOES RECENTES =======|  7d    XX | 7d   XX  |
| [Filtro] [Busca] [+ Manual]      |  30d   XX | 30d  XX  |
| Data  | Desc | Valor | Conta | *  |  60d+  XX | 60d+ XX  |
| ...   | ...  | ...   | ...   | o  |           |          |
+-----------------------------------+----------------------+
```

## Fluxos Automaticos

1. **CP pago** → trigger insere movimentacao tipo `saida`, origem `auto_cp`, vincula cp_id
2. **CR recebido** → trigger insere movimentacao tipo `entrada`, origem `auto_cr`, vincula cr_id
3. **Import OFX** → parse via n8n, insere movimentacoes com origem `import_ofx`, dedup via hash_import
4. **Saldo recalculado** → RPC que recalcula saldo_atual = saldo_inicial + SUM(entradas) - SUM(saidas)

## Estetica

- Cards com glassmorphism sutil (backdrop-blur) no dark mode
- Grafico com Recharts — area chart com gradientes
- Cores por conta bancaria (customizaveis)
- Micro-animacoes nos KPIs (contadores animados)
- Badges de tendencia (^v) com verde/vermelho
- Padrao existente: rounded-2xl, shadows suaves, paleta teal/violet/slate

## Stack

- Frontend: React + TypeScript + Tailwind + Recharts (ja no projeto)
- Backend: Supabase (novas tabelas + triggers + RPC)
- Parse OFX: n8n webhook + parser
- Padrao de hooks: TanStack Query v5

## Rota

- `/financeiro/tesouraria` → TesourariaCockpit (nova pagina)
- Adicionado como item na nav do FinanceiroLayout


## Links
- [[obsidian/20 - Módulo Financeiro]]
