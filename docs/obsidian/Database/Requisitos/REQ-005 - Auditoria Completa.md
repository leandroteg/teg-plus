---
tipo: requisito
id: REQ-005
titulo: "Trilha de auditoria completa"
categoria: nao-funcional
prioridade: alta
status: planejado
modulo: geral
sprint: Sprint-3
milestone: MS-003
tags: [requisito, auditoria, log, compliance, rastreabilidade]
---

# 📋 REQ-005 — Auditoria Completa

## Descrição
Toda ação relevante no sistema deve ser registrada com: quem fez, quando, de onde e o que mudou. Dados devem ser imutáveis e consultáveis.

## Critérios de Aceite
- [x] Tabela `sys_log_atividades` ativa
- [ ] Log de login/logout
- [ ] Log de mudança de perfil/alçada (admin)
- [ ] Relatório de auditoria filtrável por usuário/período
- [ ] Retenção mínima de 2 anos
- [ ] Exportação CSV/Excel

## Links
- [[07 - Schema Database]]
- [[09 - Auth Sistema]]
- [[06 - Supabase]]
