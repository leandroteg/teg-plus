---
tipo: tarefa
id: TASK-007
titulo: "Schema v2 — Migração de Nomenclatura"
status: backlog
prioridade: media
modulo: infra
responsavel: Leandro
milestone: MS-003
sprint: Sprint-3
estimativa: 5
gasto: 0
data_inicio: 2026-04-01
data_fim: 2026-04-15
tags: [tarefa, schema, supabase, migracao, sql]
---

# ⬜ TASK-007 — Schema v2 Migration

## Descrição
Migrar tabelas para convenção de prefixos v2: `sys_*`, `cmp_*`, `apr_*`, `cot_*`. Schema já documentado em `SCHEMA_v2.sql`.

## Entregas
- [ ] Script de migração `011_schema_v2_rename.sql`
- [ ] Atualizar todas as queries no frontend
- [ ] Atualizar hooks com novos nomes
- [ ] Atualizar n8n workflows
- [ ] Testes de regressão
- [ ] Deploy e validação

## Links
- [[07 - Schema Database]]
- [[08 - Migrações SQL]]
