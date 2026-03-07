---
tipo: issue
id: ISSUE-006
titulo: "Filtro de datas no dashboard financeiro nao reseta ao trocar de obra"
status: aberto
severidade: media
modulo: financeiro
reportado_por: SuperTEG AI Agent
data_report: 2026-03-07
sprint: Sprint-3
github_issue: 13
github_url: "https://github.com/leandroteg/teg-plus/issues/13"
origem: superteg-agent
tags: [issue, bug, financeiro, dashboard, filtro, github]
---

# 🟡 ISSUE-006 — Filtro de datas no dashboard financeiro nao reseta

> **GitHub Issue:** [#13](https://github.com/leandroteg/teg-plus/issues/13) | **Origem:** SuperTEG AI Agent

## Descricao
O filtro de datas no dashboard financeiro nao reseta quando troca de obra, fica mantendo o filtro anterior. Isso causa confusao ao usuario que espera ver os dados da nova obra sem filtros aplicados.

## Impacto
- Usuario ve dados filtrados da obra anterior ao trocar
- Pode levar a decisoes baseadas em dados parciais
- UX confusa — usuario nao percebe que o filtro ainda esta ativo

## Solucao Proposta
1. Detectar mudanca de obra no componente `DashboardFinanceiro`
2. Resetar state dos filtros de data quando `obra` muda
3. Usar `useEffect` com dependency na obra selecionada
4. Limpar params de data no TanStack Query key

## Arquivos Afetados
- `frontend/src/pages/financeiro/DashboardFinanceiro.tsx`
- `frontend/src/hooks/useFinanceiro.ts`

## Links
- [[08 - Modulo Financeiro]]
- [[TASK-008 - Dashboard financeiro basico]]
