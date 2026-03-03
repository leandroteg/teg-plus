---
tipo: tarefa
id: TASK-013
titulo: "Contas a Pagar — Workflow de Aprovação e Gestão de Documentos"
status: backlog
prioridade: critica
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
estimativa: 13
gasto: 0
tags: [task, financeiro, contas-a-pagar, aprovacao, documentos, omie]
---

# 📋 TASK-013 — Contas a Pagar — Workflow de Aprovação

## Descrição
Implementar o fluxo completo de Contas a Pagar integrado ao Omie:
- Criação automática de CP a partir de PO aprovado
- Checklist de documentos obrigatórios
- Fila de aprovação para o Diretor Presidente
- Exceções (reembolso, viagem, previsto)

## Subtarefas
- [ ] API Omie: endpoint de criação de CP a partir do PO (< 5 min após aprovação)
- [ ] Tela de CP com upload de documentos obrigatórios (OC, Boleto, NF, Recibo)
- [ ] Bloqueio de pagamento se documentos obrigatórios ausentes
- [ ] Fila de aprovação para Laucídio com visualização de docs
- [ ] Notificação (WhatsApp + e-mail) quando CP chega para aprovação
- [ ] Histórico de aprovações (auditable log)
- [ ] Fluxo de exceção: Repasse de Viagem
- [ ] Fluxo de exceção: Reembolso
- [ ] Fluxo de exceção: Pagamento de Previsto (aprovação especial + prazo regularização)
- [ ] Tela de status de CP para Suprimentos (somente leitura)

## Requisitos Relacionados
- [[REQ-008 - Contas a Pagar Fluxo Omie]]
- [[REQ-009 - Aprovacao Pagamentos Diretoria]]
- [[REQ-015 - Integracoes Internas Financeiro]]
- [[REQ-016 - Excecoes de Pagamento]]

## Milestone
[[MS-004 - Modulo Financeiro]]
