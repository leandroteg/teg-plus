---
tipo: requisito
id: REQ-012
titulo: "Contas a Receber e Recebimento de NF de Entrada"
categoria: funcional
prioridade: alta
status: planejado
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
tags: [requisito, financeiro, contas-a-receber, nfe-entrada, recebimento]
---

# 📋 REQ-012 — Contas a Receber e Recebimento de NF de Entrada

## Descrição
Dois fluxos distintos:
1. **Contas a Receber** — NF de Venda emitida gera automaticamente o título a receber e o concilia quando o pagamento chega
2. **NF de Entrada** — sistema recebe e processa NFs de fornecedores (XML), vinculando ao PO e ao lançamento de CP

## Critérios de Aceite

### Contas a Receber
- [ ] NF de Venda emitida → título a receber criado automaticamente no Omie
- [ ] Conciliação automática quando pagamento é identificado no extrato bancário
- [ ] Relatório de recebimentos previstos (diário, semanal, mensal)
- [ ] Recebimentos organizados por natureza e projeto

### NF de Entrada (recebimento de fornecedores)
- [ ] Importação automática de XML NF-e via e-mail ou portal SEFAZ
- [ ] Validação do XML contra o PO correspondente (valores, itens)
- [ ] Divergências sinalizadas ao comprador
- [ ] NF vinculada ao CP no Omie para conciliação
- [ ] Contabilidade consegue buscar histórico de NFs e conciliação

## Tarefas Relacionadas
- [[TASK-015 - Emissao Recebimento NFe]]
