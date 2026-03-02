---
tipo: requisito
id: REQ-006
titulo: "Integração financeira com Omie ERP"
categoria: funcional
prioridade: alta
status: planejado
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
tags: [requisito, omie, financeiro, nfe, contasapagar]
---

# 📋 REQ-006 — Integração Omie ERP

## Descrição
POs aprovados no TEG+ devem gerar automaticamente lançamentos de Contas a Pagar no Omie ERP, com conciliação automática quando a NF-e chegar.

## Critérios de Aceite
- [ ] PO emitido → lançamento CP no Omie em < 5 min
- [ ] NF-e importada → conciliada com PO automaticamente
- [ ] Divergências de valor sinalizadas para comprador
- [ ] DRE por obra disponível no TEG+

## Tarefa Relacionada
[[TASK-009 - Integracao Omie]]
