---
tipo: milestone
id: MS-007
titulo: "Módulo Frotas e Manutenção"
status: concluido
fase: Q1-2026
data_alvo: 2026-03-03
progresso: 100
modulo: frotas
tags: [milestone, frotas, manutencao, telemetria, checklist]
---

# MS-007 — Módulo Frotas e Manutenção

## Objetivo

Implementar o módulo completo de Manutenção e Uso de Frotas com fluxo de OS em 7 etapas, checklist diário bloqueante, gestão de abastecimento com desvio automático, telemetria e compliance.

## Escopo

- [x] Migration `017_frotas_manutencao.sql` (10 tabelas, 3 triggers, seed de fornecedores)
- [x] Types TypeScript `frotas.ts` (12 interfaces, 14 tipos, 3 payloads, KPIs)
- [x] Hooks `useFrotas.ts` (16 hooks React Query)
- [x] Layout `FrotasLayout.tsx` (sidebar rose/pink, mobile nav)
- [x] Página `FrotasHome.tsx` (KPIs, status frota, OS críticas, telemetria)
- [x] Página `Veiculos.tsx` (CRUD + alertas de documentos + status)
- [x] Página `Ordens.tsx` (fluxo OS + cotações + alçadas + conclusão)
- [x] Página `Checklists.tsx` (checklist diário + liberação de veículo)
- [x] Página `Abastecimentos.tsx` (registro + desvio km/L + KPIs)
- [x] Página `Telemetria.tsx` (ocorrências + tratativa + comunicação RH)
- [x] `App.tsx` — 6 rotas frotas registradas + 6 rotas logística
- [x] `ModuloSelector.tsx` — Frotas e Logística ativos
- [x] Documentação Obsidian (doc 24)

## Entregas

| Arquivo | Status |
|---------|--------|
| `supabase/017_frotas_manutencao.sql` | ✅ |
| `frontend/src/types/frotas.ts` | ✅ |
| `frontend/src/hooks/useFrotas.ts` | ✅ |
| `frontend/src/components/FrotasLayout.tsx` | ✅ |
| `frontend/src/pages/frotas/*` (6 páginas) | ✅ |
| `docs/obsidian/24 - Módulo Frotas e Manutenção.md` | ✅ |

## Notas Técnicas

- Bloqueio automático de veículo ao abrir OS crítica (status `bloqueado`)
- Liberação automática de veículo ao concluir OS (status `disponivel`)
- Checklist pré-viagem libera veículo para `em_uso` apenas se todos os 7 itens OK
- Desvio de abastecimento: km/L < 85% da média histórica → alerta
- Cotação: mínimo 1 fornecedor para selecionar, mas spec recomenda 3+
- Numeração automática: `FRO-OS-YYYY-NNNN` via trigger PostgreSQL
