---
tipo: requisito
id: REQ-001
titulo: "Notificações automáticas de aprovação"
categoria: funcional
prioridade: critica
status: entregue
modulo: compras
sprint: Sprint-2
milestone: MS-002
tags: [requisito, notificacao, whatsapp, email, aprovacao]
---

# 🔵 REQ-001 — Notificações Automáticas

## Descrição
O sistema deve enviar notificação automática ao aprovador assim que uma nova aprovação for criada, contendo o link direto para aprovação sem necessidade de login.

## Critérios de Aceite
- [x] Aprovador recebe mensagem WhatsApp em < 2 minutos após criação
- [x] Mensagem contém link funcional para `/aprovacao/:token`
- [x] Solicitante notificado quando aprovado/rejeitado
- [x] Notificação quando prazo estiver próximo de vencer (< 2h)
- [x] Fallback para email se WhatsApp falhar

> Entregue via n8n workflows (WhatsApp + email). Operacional desde Sprint-3.

## Tarefa Relacionada
[[TASK-005 - Notificacoes WhatsApp]]
