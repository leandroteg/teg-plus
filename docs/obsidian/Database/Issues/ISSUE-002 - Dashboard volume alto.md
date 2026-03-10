---
tipo: issue
id: ISSUE-002
titulo: "RPC dashboard não testada com volume alto"
status: resolvida
severidade: media
modulo: compras
reportado_por: Leandro
data_report: 2026-03-02
data_resolucao: 2026-03-07
sprint: Sprint-2
tags: [issue, dashboard, performance, rpc, supabase, resolvida]
---

# ✅ ISSUE-002 — Performance RPC com volume alto (RESOLVIDA)

## Descrição
A função `get_dashboard_compras()` foi desenvolvida e testada com dados de seed (~20 requisições). Não foi validada com volume de produção (centenas/milhares de registros) nem com os 6 projetos simultâneos em operação plena.

## Impacto
- Dashboard pode ficar lento em produção
- Possível timeout (atual: sem timeout configurado)

## Solução Proposta
1. Adicionar `statement_timeout` na função SQL
2. Adicionar índices compostos nas colunas filtradas
3. Testar com dataset sintético de 500+ requisições
4. Adicionar `staleTime` mais agressivo no `useDashboard`

## Resolucao

Implementado em 2026-03-07 via commit `465aac0`:
- Adicionados indices compostos nas colunas filtradas pelo dashboard
- Configurado `statement_timeout` na funcao SQL `get_dashboard_compras()`
- Otimizacoes de performance aplicadas no Supabase

## Links
- [[06 - Supabase]]
- [[05 - Hooks Customizados]]
