---
tipo: milestone
id: MS-006b
titulo: "Módulo Logística e Transportes"
status: concluido
fase: Q1-2026
data_alvo: 2026-03-03
progresso: 100
modulo: logistica
tags: [milestone, logistica, transportes, nfe]
---

# MS-006 — Módulo Logística e Transportes

## Objetivo

Implementar o módulo completo de Logística e Transportes com fluxo de 9 etapas, NF-e integrada, checklist de expedição/recebimento, rastreamento de ocorrências e avaliação de transportadoras.

## Escopo

- [x] Migration `016_logistica_transportes.sql` (10 tabelas, 3 triggers, seed de rotas e transportadoras)
- [x] Types TypeScript `logistica.ts` (8 interfaces, 5 tipos, 3 payloads, KPIs)
- [x] Hooks `useLogistica.ts` (18 hooks React Query)
- [x] Layout `LogisticaLayout.tsx` (sidebar orange, mobile nav)
- [x] Página `LogisticaHome.tsx` (KPIs, Em Trânsito, Urgentes)
- [x] Página `Solicitacoes.tsx` (fluxo completo + alçadas + planejamento)
- [x] Página `Expedicao.tsx` (checklist bloqueante + NF-e + despacho)
- [x] Página `Transportes.tsx` (rastreamento + ocorrências)
- [x] Página `Recebimentos.tsx` (confirmação + SLA + avaliação 3 critérios)
- [x] Página `Transportadoras.tsx` (CRUD + modalidades + rating)
- [x] `App.tsx` — 6 rotas logística registradas
- [x] `ModuloSelector.tsx` — Logística ativo (orange/amber)
- [x] `index.css` — `.input-base` adicionado
- [x] Documentação Obsidian (doc 23)

## Entregas

| Arquivo | Status |
|---------|--------|
| `supabase/016_logistica_transportes.sql` | ✅ |
| `frontend/src/types/logistica.ts` | ✅ |
| `frontend/src/hooks/useLogistica.ts` | ✅ |
| `frontend/src/components/LogisticaLayout.tsx` | ✅ |
| `frontend/src/pages/logistica/*` (6 páginas) | ✅ |
| `docs/obsidian/23 - Módulo Logística e Transportes.md` | ✅ |

## Notas Técnicas

- NF-e simulada no frontend (produção → n8n/Edge Function SEFAZ)
- Alçada detectada automaticamente por `custo_estimado`
- Despacho bloqueado enquanto checklist incompleto ou sem NF-e autorizada
- SLA de 4h para confirmação de recebimento
- Assinatura digital gerada como `CONF-{timestamp.toString(36)}`

## Links
- [[23 - Módulo Logística e Transportes]]
- [[Database/Tarefas/TASK-019 - Logistica Core|TASK-019 — Logística Core]]
- [[07 - Schema Database]]
- [[20 - Módulo Financeiro]]
