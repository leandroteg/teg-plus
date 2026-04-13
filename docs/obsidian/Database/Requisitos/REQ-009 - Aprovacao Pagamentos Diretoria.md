---
tipo: requisito
id: REQ-009
titulo: "Aprovação de Pagamentos — Alçada Diretoria"
categoria: funcional
prioridade: critica
status: entregue
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
updated: 2026-03-10
tags: [requisito, financeiro, aprovacao, alcada, documentos, aprovaai]
---

# 🟡 REQ-009 — Aprovação de Pagamentos — Alçada Diretoria

## Descrição
Todo pagamento deve ser aprovado pelo Diretor Presidente (Laucídio) antes de ser executado. O sistema deve impedir execução sem aprovação e garantir que todos os documentos obrigatórios estejam anexados.

## Implementação Atual (2026-03-10)
- [x] Fila de aprovação via AprovAi (tipo: autorizacao_pagamento)
- [x] Admin como aprovador universal com ApprovalBadge no header
- [x] Visualização de pendências em card contextual (GenericPendingCard)
- [x] Aprovação possível via mobile (AprovAi é mobile-first)
- [ ] Sistema bloqueia execução do pagamento sem aprovação registrada
- [ ] Notificação automática ao aprovador (WhatsApp / e-mail)
- [ ] Checklist de documentos obrigatórios antes de aprovar
- [ ] Histórico completo de aprovações com timeline visual

## Documentos Obrigatórios (checklist automático)
| Documento | Obrigatório |
|---|---|
| Ordem de Compra / Contrato | Sim |
| Boleto / Fatura / Nota Fiscal | Sim |
| Recibo | Sim |
| Comprovante de pagamento | Sim (pós-pagamento) |
| Relatório de Pagamentos | Sim |
| Extrato Bancário | Sim |

## Exceções (fluxo alternativo)
- **Repasse de viagem** — fluxo simplificado com aprovação prévia de orçamento
- **Reembolso** — comprovante + aprovação de gestor direto + Diretoria
- **Pagamento de previsto** — aprovação da Diretoria obrigatória mesmo sem NF

## Tarefas Relacionadas
- [[TASK-013 - CP Workflow Aprovacao]]
- [[TASK-017 - Acesso Alcadas Financeiro]]
