---
tipo: tarefa
id: TASK-004
titulo: "Dashboard KPIs Realtime"
status: concluido
prioridade: alta
modulo: compras
responsavel: Leandro
milestone: MS-001
sprint: Sprint-1
estimativa: 8
gasto: 8
data_inicio: 2026-02-10
data_fim: 2026-02-28
tags: [tarefa, dashboard, kpi, realtime, supabase]
---

# ✅ TASK-004 — Dashboard KPIs Realtime

## Descrição
Dashboard com KPIs em tempo real: total de requisições, pendentes, aprovadas, valor total, pipeline por status e por obra.

## Entregas
- [x] RPC `get_dashboard_compras(periodo, obra_id)`
- [x] Hook `useDashboard` com TanStack Query
- [x] Realtime subscription (auto-atualiza)
- [x] KpiCard component
- [x] Gráfico por obra
- [x] Pipeline visual por status

## Links
- [[05 - Hooks Customizados]]
- [[06 - Supabase]]
