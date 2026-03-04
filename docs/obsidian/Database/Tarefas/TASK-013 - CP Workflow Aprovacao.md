---
tipo: tarefa
id: TASK-013
titulo: Contas a Pagar — Workflow
status: em-andamento
prioridade: critica
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
estimativa: 13
gasto: 9
tags:
  - task
  - financeiro
  - contas-a-pagar
  - aprovacao
  - documentos
  - omie
---

# 🔵 TASK-013 — Contas a Pagar — Workflow

## Descrição
Implementar o fluxo completo de Contas a Pagar integrado ao Omie:
- Criação automática de CP a partir de PO aprovado
- Checklist de documentos obrigatórios
- Fila de aprovação para o Diretor Presidente
- Exceções (reembolso, viagem, previsto)

## Subtarefas
- [x] Tela de CP com lista, filtros, busca e badges de status (ContasPagar.tsx)
- [x] Tela de aprovação com fila pendentes/aprovadas/rejeitadas
- [x] Schema DB completo (fin_contas_pagar, fornecedores, cmp_pedidos_anexos)
- [x] Fila de aprovação para Laucídio com visualização e ação aprovar/rejeitar
- [x] Trigger: PO emitido → CP criado automaticamente (status: previsto)
- [x] Liberar para Pagamento: upload de NF/comprovante + trigger CP → aguardando_aprovacao
- [x] Registrar Pagamento (financeiro): upload comprovante + CP → pago + PO → pago
- [x] Comprovante de pagamento visível ao comprador na tela de Pedidos
- [x] Tabs de filtro por status de pagamento (Aguard. Pagamento / Pago)
- [ ] Bloqueio de pagamento se documentos obrigatórios ausentes
- [ ] Notificação (WhatsApp + e-mail) quando CP chega para aprovação
- [ ] Histórico de aprovações (auditable log)
- [ ] Fluxo de exceção: Repasse de Viagem
- [ ] Fluxo de exceção: Reembolso
- [ ] Fluxo de exceção: Pagamento de Previsto (aprovação especial + prazo regularização)

## Requisitos Relacionados
- [[REQ-008 - Contas a Pagar Fluxo Omie]]
- [[REQ-009 - Aprovacao Pagamentos Diretoria]]
- [[REQ-015 - Integracoes Internas Financeiro]]
- [[REQ-016 - Excecoes de Pagamento]]

## Milestone
[[MS-004 - Modulo Financeiro]]
