---
tipo: tarefa
id: TASK-022
titulo: "Frotas Core — Schema, Hooks e Páginas"
status: concluido
prioridade: alta
modulo: frotas
milestone: MS-007
sprint: Sprint-9
estimativa: 22
gasto: 22
data_inicio: 2026-03-03
data_fim: 2026-03-03
tags: [tarefa, frotas, manutencao, os, checklist, telemetria, abastecimento]
---

# TASK-020 — Frotas Core

## Descrição

Implementar o módulo completo de Manutenção e Uso de Frotas conforme especificação aprovada. Inclui cadastro de frota, OS com cotação e aprovação por alçada, checklist diário bloqueante, gestão de abastecimento com detecção de desvio e telemetria de compliance.

## Critérios de Aceite

- [x] Cadastro de veículos com alertas de documentos vencidos
- [x] OS com numeração automática `FRO-OS-YYYY-NNNN`
- [x] Bloqueio imediato de veículo em OS crítica
- [x] Fluxo de cotação com seleção de fornecedor
- [x] Aprovação por alçada automática (R$300/R$1.500/Diretoria)
- [x] Conclusão de OS libera veículo automaticamente
- [x] Checklist diário obrigatório com 7 itens
- [x] Liberação de veículo condicional ao checklist 100% OK
- [x] Registro de abastecimento com cálculo de km/L
- [x] Detecção automática de desvio de consumo (>15%)
- [x] Ocorrências de telemetria com fluxo de tratativa
- [x] Dashboard com KPIs: disponibilidade, OS críticas, custo mês
- [x] Módulo visível e acessível no ModuloSelector (rose/pink)

## Subtarefas

- [x] Migration SQL (10 tabelas, 3 triggers)
- [x] Types TypeScript (12 interfaces, 14 tipos)
- [x] 16 hooks React Query
- [x] Layout sidebar (rose/pink)
- [x] 6 páginas completas
- [x] Rotas App.tsx
- [x] ModuloSelector atualizado
- [x] Documentação Obsidian

## Resultado

Módulo entregue e funcional com todas as telas implementadas.
