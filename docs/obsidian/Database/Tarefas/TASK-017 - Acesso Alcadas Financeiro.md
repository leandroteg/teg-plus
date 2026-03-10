---
tipo: tarefa
id: TASK-017
titulo: "Controle de Acesso por Alçadas — Módulo Financeiro"
status: em-andamento
prioridade: alta
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
estimativa: 5
gasto: 2
updated: 2026-03-10
tags: [task, financeiro, acesso, alcadas, permissoes, rbac, aprovaai]
---

# 🟡 TASK-017 — Controle de Acesso por Alçadas

## Descrição
Configurar RBAC (controle baseado em perfis) para o módulo financeiro, garantindo que cada área veja e faça somente o que tem permissão.

## Implementado (2026-03-10)
- [x] AprovAi como centro de aprovações multi-tipo (4 tipos)
- [x] Admin como aprovador universal (admin IDs em apr_alcadas)
- [x] Autorização de pagamento via AprovAi (tipo: autorizacao_pagamento)
- [x] ApprovalBadge global para admin users
- [x] Rota admin-only: /admin/usuarios, /admin/desenvolvimento

## Subtarefas Pendentes
- [ ] Definir e criar perfis: Financeiro, Diretor, Suprimentos, Controladoria, Diretoria, RH, Contabilidade
- [ ] Restringir menus e telas por perfil (RBAC no frontend)
- [ ] Restringir endpoints por perfil (RBAC no backend / API)
- [ ] Suprimentos: ver somente comprovantes e status de seus próprios POs
- [ ] Controladoria/Diretoria: relatórios e dashboards (somente leitura + exportar)
- [ ] Contabilidade: NFs e conciliação (somente leitura + exportar)
- [ ] RH: submeter remessa de folha
- [ ] Log de auditoria de todas as ações por usuário
- [ ] Testes de penetração básico para verificar isolamento entre perfis

## Requisitos Relacionados
- [[REQ-018 - Controle de Acesso Alcadas]]

## Milestone
[[MS-004 - Modulo Financeiro]]
