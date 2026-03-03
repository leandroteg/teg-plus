---
tipo: requisito
id: REQ-009
titulo: "Aprovação de Pagamentos — Alçada Diretoria"
categoria: funcional
prioridade: critica
status: planejado
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
tags: [requisito, financeiro, aprovacao, alcada, documentos]
---

# 📋 REQ-009 — Aprovação de Pagamentos — Alçada Diretoria

## Descrição
Todo pagamento deve ser aprovado pelo Diretor Presidente (Laucídio) antes de ser executado. O sistema deve impedir execução sem aprovação e garantir que todos os documentos obrigatórios estejam anexados.

## Critérios de Aceite
- [ ] Fila de aprovação com visualização clara de pendências para o aprovador
- [ ] Sistema bloqueia execução do pagamento sem aprovação registrada
- [ ] Notificação automática ao aprovador (WhatsApp / e-mail) quando pagamento chega para aprovação
- [ ] Aprovador pode visualizar todos os documentos anexados antes de aprovar
- [ ] Histórico completo de aprovações (quem, quando, qual valor, qual fornecedor)
- [ ] Aprovação possível via mobile (tablet/celular) com boa usabilidade

## Documentos Obrigatórios (checklist automático)
| Documento | Obrigatório |
|---|---|
| Ordem de Compra / Contrato | ✅ Sim |
| Boleto / Fatura / Nota Fiscal | ✅ Sim |
| Recibo | ✅ Sim |
| Comprovante de pagamento | ✅ Sim (pós-pagamento) |
| Relatório de Pagamentos | ✅ Sim |
| Extrato Bancário | ✅ Sim |

## Exceções (fluxo alternativo)
- **Repasse de viagem** — fluxo simplificado com aprovação prévia de orçamento
- **Reembolso** — comprovante + aprovação de gestor direto + Diretoria
- **Pagamento de previsto** — aprovação da Diretoria obrigatória mesmo sem NF

## Tarefas Relacionadas
- [[TASK-013 - CP Workflow Aprovacao]]
