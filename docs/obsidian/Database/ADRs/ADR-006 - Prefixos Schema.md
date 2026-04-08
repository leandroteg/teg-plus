---
tipo: adr
id: ADR-006
titulo: "Prefixos por módulo no schema do banco"
status: aceito
data: 2026-03-01
autor: Time DEV
tags: [adr, schema, database, prefixos, convencoes]
---

# ADR-006 — Prefixos por Módulo no Schema

## Status
✅ Aceito

## Contexto
Com 80+ tabelas crescendo, precisávamos de uma convenção clara para identificar rapidamente a qual módulo cada tabela pertence.

## Decisão
Prefixar todas as tabelas com abreviação do módulo: `sys_`, `cmp_`, `apr_`, `fin_`, `con_`, `est_`, `log_`, `fro_`, `pat_`, `fis_`, `rh_`, `mural_`.

## Alternativas Consideradas
1. **Schemas separados** (`compras.requisicoes`) — Complicaria RLS e queries cross-módulo
2. **Sem prefixo** — Nomes genéricos (`requisicoes`) ambíguos com 80+ tabelas
3. **Sufixo** (`requisicoes_cmp`) — Menos legível

## Consequências
### Positivas
- Visível instantaneamente a qual módulo pertence
- Autocomplete agrupa por módulo no SQL Editor
- Foreign keys claras: `con_contratos.id` referenciado como `contrato_id`

### Negativas
- Nomes de tabela mais longos
- Precisa manter lista de prefixos atualizada

## Links
- [[07 - Schema Database]]
- [[39 - Modelo de Dados ERD]]
- [[40 - ADRs Index]]
