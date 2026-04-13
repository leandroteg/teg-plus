---
tipo: tarefa
id: TASK-019
titulo: "Logística Core — Schema, Hooks e Páginas"
status: concluido
prioridade: alta
modulo: logistica
milestone: MS-006b
sprint: Sprint-8
estimativa: 20
gasto: 20
data_inicio: 2026-03-03
data_fim: 2026-03-03
tags: [tarefa, logistica, transportes, nfe, expedicao, recebimento]
---

# TASK-019 — Logística Core

## Descrição

Implementar o módulo completo de Logística e Transportes conforme especificação aprovada. Inclui fluxo de 9 etapas desde a solicitação até a conclusão, integração NF-e, expedição com checklist bloqueante, rastreamento com ocorrências e avaliação de transportadoras.

## Critérios de Aceite

- [x] Solicitação criada com número automático `LOG-YYYY-NNNN`
- [x] Validação → Planejamento → Alçada automática por custo
- [x] Checklist de expedição bloqueante (7 itens)
- [x] NF-e obrigatória antes do despacho
- [x] Rastreamento com registro de ocorrências
- [x] Confirmação de recebimento com SLA 4h
- [x] Avaliação de transportadoras (prazo, qualidade, comunicação)
- [x] Dashboard com KPIs em tempo real
- [x] Módulo visível e acessível no ModuloSelector

## Subtarefas

- [x] Migration SQL (10 tabelas)
- [x] Types TypeScript
- [x] 18 hooks React Query
- [x] Layout sidebar
- [x] 6 páginas completas
- [x] Rotas App.tsx
- [x] Documentação

## Resultado

Módulo entregue e funcional com todas as telas implementadas.

## Links
- [[23 - Módulo Logística e Transportes]]
- [[Database/Milestones/MS-006 - Modulo Logistica Transportes|MS-006b — Logística]]
- [[07 - Schema Database]]
