---
tipo: tarefa
id: TASK-014
titulo: "Conciliação Bancária Automática e Remessa em Lote"
status: em_andamento
prioridade: critica
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
estimativa: 13
gasto: 3
tags: [task, financeiro, conciliacao, remessa, banco, cnab]
---

# 📋 TASK-014 — Conciliação e Remessa Bancária

## Descrição
Integração bancária para dois fluxos críticos de produtividade:
1. Envio de remessa de pagamento em lote (CNAB)
2. Importação e conciliação automática de extrato bancário

## Subtarefas

### Remessa Bancária (Pagamento em Lote)
- [x] UI de geração de remessa CNAB 240/400 (Conciliacao.tsx — aba Remessa)
- [x] Seleção de CPs aprovados para incluir no lote (checkboxes)
- [ ] Validação campo a campo antes do envio
- [ ] Envio do arquivo ao banco e rastreio de status de retorno
- [ ] Baixa automática dos CPs ao confirmar retorno bancário
- [ ] Relatório do lote (enviados, rejeitados, aguardando)

### Conciliação Automática
- [x] UI de importação de extrato bancário (Conciliacao.tsx — aba Conciliação)
- [ ] Cruzamento automático débitos/créditos com lançamentos
- [ ] Itens não conciliados em lista de revisão manual
- [ ] Regra: data de vencimento **nunca** alterada automaticamente
- [ ] Relatório de conciliação pendente por período

## Requisitos Relacionados
- [[REQ-010 - Conciliacao e Remessa Bancaria]]

## Milestone
[[MS-004 - Modulo Financeiro]]
