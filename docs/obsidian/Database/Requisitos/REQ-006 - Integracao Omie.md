---
tipo: requisito
id: REQ-006
titulo: "Integração financeira com Omie ERP"
categoria: funcional
prioridade: alta
status: em-andamento
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
tags: [requisito, omie, financeiro, nfe, contasapagar]
---

# 🔵 REQ-006 — Integração Omie ERP

## Descrição
POs aprovados no TEG+ devem gerar automaticamente lançamentos de Contas a Pagar no Omie ERP, com conciliação automática quando a NF-e chegar.

## Critérios de Aceite
- [x] Sync de fornecedores, CP e CR via n8n squads ✅
- [x] Credenciais configuráveis via UI admin ✅
- [x] Aprovação de pagamento escreve de volta no Omie ✅
- [ ] PO emitido → lançamento CP no Omie em < 5 min (via trigger direto)
- [ ] NF-e importada → conciliada com PO automaticamente
- [ ] Divergências de valor sinalizadas para comprador
- [ ] DRE por obra disponível no TEG+

## Tarefa Relacionada
[[TASK-009 - Integracao Omie]]
