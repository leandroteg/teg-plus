---
tipo: tarefa
id: TASK-002
titulo: "Aprovações Multi-nível"
status: concluido
prioridade: critica
modulo: compras
responsavel: Leandro
milestone: MS-001
sprint: Sprint-1
estimativa: 13
gasto: 13
data_inicio: 2026-02-01
data_fim: 2026-02-20
tags: [tarefa, aprovacao, alcada, token]
---

# ✅ TASK-002 — Aprovações Multi-nível

## Descrição
Sistema de aprovação sequencial com 4 alçadas (Coordenador → Gerente → Diretor → CEO), baseado em token público sem necessidade de login.

## Entregas
- [x] 4 níveis de alçada configurados
- [x] Token UUID por aprovação
- [x] Página pública `/aprovacao/:token`
- [x] Fluxo n8n `POST /compras/aprovacao`
- [x] Expiração e rejeição automática
- [x] Log de atividades

## Links
- [[12 - Fluxo Aprovação]]
- [[13 - Alçadas]]
