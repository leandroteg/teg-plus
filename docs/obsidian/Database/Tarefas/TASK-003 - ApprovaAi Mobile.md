---
tipo: tarefa
id: TASK-003
titulo: "AprovAi — Centro de Aprovações Multi-tipo"
status: concluido
prioridade: critica
modulo: sistema
responsavel: Leandro
milestone: MS-001
sprint: Sprint-1
estimativa: 5
gasto: 8
data_inicio: 2026-02-15
data_fim: 2026-03-10
updated: 2026-03-10
tags: [tarefa, mobile, aprovacao, ui, multi-tipo, contratos, financeiro, compras]
---

# ✅ TASK-003 — AprovAi — Centro de Aprovações

## Descrição
Centro unificado de aprovações para todos os módulos do TEG+. Interface mobile-first responsiva com suporte a 4 tipos de aprovação, executive summaries contextuais e ApprovalBadge global.

## Entregas — v1 (Sprint-1)
- [x] Rota `/aprovaai`
- [x] Layout mobile-first responsivo
- [x] Lista de aprovações pendentes (requisições de compra)
- [x] Botão aprovar/rejeitar + observação
- [x] Branding ApprovaAi

## Entregas — v2 Multi-tipo (Sprint-8, 2026-03-10)
- [x] 4 tipos de aprovação: requisicao_compra, cotacao, autorizacao_pagamento, minuta_contratual
- [x] GenericPendingCard com layout contextual por tipo
- [x] Cotação: resumo com fornecedor, valor, prazo, total cotados
- [x] Autorização pagamento: dados de CP vinculada
- [x] Minuta contratual: Executive Summary (contraparte, valor, objeto, tipo, AI score, PDF link)
- [x] ApprovalBadge no header global (ModuleLayout + ModuloSelector) — admin only
- [x] Badge com contagem de pendentes em tempo real
- [x] Enrichment de dados via Supabase joins (con_solicitacoes, con_minutas, fin_contas_pagar)
- [x] Suporte a admin como aprovador universal (ID de admin em apr_alcadas)

## Arquivos Chave
- `frontend/src/pages/AprovAi.tsx` — Tela principal + MinutaExecutiveSummary
- `frontend/src/hooks/useAprovacoes.ts` — Hook com enrichment multi-tipo
- `frontend/src/components/ApprovalBadge.tsx` — Badge global no header
- `frontend/src/types/index.ts` — AprovacaoPendente com minuta_resumo

## Links
- [[03 - Páginas e Rotas]]
- [[12 - Fluxo Aprovação]]
