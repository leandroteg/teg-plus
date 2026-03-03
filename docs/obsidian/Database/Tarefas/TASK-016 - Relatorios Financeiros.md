---
tipo: tarefa
id: TASK-016
titulo: "Relatórios Financeiros — Operacional, DRE, DFC, BP e Fluxo de Caixa"
status: backlog
prioridade: alta
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
estimativa: 8
gasto: 0
tags: [task, financeiro, relatorios, dre, dfc, fluxo-caixa, bi]
---

# 📋 TASK-016 — Relatórios Financeiros

## Descrição
Implementar os relatórios críticos do módulo financeiro, cobrindo nível operacional (diário/semanal), tático (mensal/por CC) e estratégico (DRE, DFC, BP).

## Subtarefas

### Operacional / Tático
- [ ] Pagamentos previstos — filtro por dia / semana / mês
- [ ] Recebimentos previstos — filtro por dia / semana / mês
- [ ] Pagamentos realizados por natureza financeira, classe, CC, projeto
- [ ] Recebimentos realizados por natureza e projeto
- [ ] Orçamento previsto × realizado por CC e projeto

### Estratégico
- [ ] DRE consolidado e por CC/projeto com comparativo YTD
- [ ] DFC — Demonstração do Fluxo de Caixa (método direto)
- [ ] Fluxo de Caixa Previsto com projeção e alerta de saldo negativo
- [ ] BP — Balanço Patrimonial integrado com contabilidade

### Exportação e Acesso
- [ ] Exportação Excel e PDF
- [ ] Relatórios acessíveis para Controladoria sem TI
- [ ] Integração com relatório previsto × realizado de Obras
- [ ] BD acessível para dashboards customizados (API ou view de leitura)

## Requisitos Relacionados
- [[REQ-013 - Relatorios Operacionais Caixa]]
- [[REQ-014 - Relatorios Estrategicos DRE DFC BP]]

## Milestone
[[MS-004 - Modulo Financeiro]]
