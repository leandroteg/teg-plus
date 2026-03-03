---
tipo: tarefa
id: TASK-017
titulo: "Controle de Acesso por Alçadas — Módulo Financeiro"
status: backlog
prioridade: alta
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
estimativa: 5
gasto: 0
tags: [task, financeiro, acesso, alcadas, permissoes, rbac]
---

# 📋 TASK-017 — Controle de Acesso por Alçadas

## Descrição
Configurar RBAC (controle baseado em perfis) para o módulo financeiro, garantindo que cada área veja e faça somente o que tem permissão.

## Subtarefas
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
