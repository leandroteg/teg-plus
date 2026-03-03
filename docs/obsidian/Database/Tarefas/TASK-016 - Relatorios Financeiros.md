---
tipo: tarefa
id: TASK-016
titulo: "Relatórios Financeiros — Operacional, DRE, DFC, BP e Fluxo de Caixa"
status: em-andamento
prioridade: alta
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
estimativa: 8
gasto: 3
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
- [x] DRE consolidado (Relatorios.tsx — aba DRE)
- [x] Fluxo de Caixa Previsto com breakdown semanal (Relatorios.tsx — aba Fluxo)
- [x] Gastos por Centro de Custo com barras (Relatorios.tsx — aba CC)
- [x] Aging por faixa de vencimento (Relatorios.tsx — aba Aging)
- [ ] DFC — Demonstração do Fluxo de Caixa (método direto) — dados reais
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
