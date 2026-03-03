---
tipo: tarefa
id: TASK-019
titulo: "Módulo Estoque Core — Schema, Hooks e Páginas"
status: concluido
prioridade: critica
modulo: estoque
milestone: MS-006
sprint: Sprint-5
estimativa: 16
gasto: 16
data_inicio: 2026-03-03
data_fim: 2026-03-03
tags: [tarefa, estoque, patrimonial, frontend, backend, migration]
---

# ✅ TASK-019 — Módulo Estoque Core

## Descrição
Implementar o módulo completo de Estoque e Patrimonial: migration do banco, tipos TypeScript, hooks React Query, layout e todas as páginas do módulo.

## Entregáveis

### Backend
- [x] `supabase/015_estoque_patrimonial.sql`
  - [x] Enums: `est_curva_abc`, `est_unidade`, `est_tipo_mov`, `est_status_solicitacao`, `est_tipo_inventario`, `pat_status_imob`
  - [x] Tabela `est_bases` — almoxarifados
  - [x] Tabela `est_localizacoes` — endereçamento físico
  - [x] Tabela `est_itens` — catálogo com curva ABC, min/max, lead time
  - [x] Tabela `est_saldos` — saldo por item+base
  - [x] Tabela `est_movimentacoes` — todas as movimentações
  - [x] Tabelas `est_solicitacoes` + `est_solicitacao_itens`
  - [x] Tabelas `est_inventarios` + `est_inventario_itens`
  - [x] Tabela `pat_imobilizados` — ativo fixo
  - [x] Tabela `pat_movimentacoes` — transferências/manutenção
  - [x] Tabela `pat_termos_responsabilidade` — termos digitais
  - [x] Tabela `pat_depreciacoes` — depreciação mensal
  - [x] Trigger `fn_atualiza_saldo_estoque()` — UPSERT automático em est_saldos
  - [x] Trigger numeração automática solicitações e inventários
  - [x] RLS policies para todas as tabelas
  - [x] Índices de performance
  - [x] Seed data (5 bases, 8 itens exemplo)

### Frontend — Types & Hooks
- [x] `frontend/src/types/estoque.ts` — interfaces completas
- [x] `frontend/src/hooks/useEstoque.ts` — hooks almoxarifado
- [x] `frontend/src/hooks/usePatrimonial.ts` — hooks patrimônio

### Frontend — Layout e Páginas
- [x] `EstoqueLayout.tsx` — sidebar azul/índigo
- [x] `EstoqueHome.tsx` — dashboard com KPIs e alertas
- [x] `Itens.tsx` — catálogo com filtro curva ABC e modal de cadastro
- [x] `Movimentacoes.tsx` — histórico com modal de nova movimentação
- [x] `Inventario.tsx` — abertura, contagem inline, conclusão com acurácia
- [x] `Patrimonial.tsx` — imobilizados com depreciação, baixa, termos

### Frontend — Configuração
- [x] `App.tsx` — rotas `/estoque/*` com EstoqueLayout, removido stub
- [x] `ModuloSelector.tsx` — `active: true`, descrição atualizada
- [x] `index.css` — classe `.input-base` adicionada

### Documentação Obsidian
- [x] `22 - Módulo Estoque e Patrimonial.md`
- [x] `MS-006 - Modulo Estoque Patrimonial.md`
- [x] `TASK-019 - Estoque Core.md` (este arquivo)
- [x] `00 - TEG+ INDEX.md` — links 22 adicionados

## Notas Técnicas

### Trigger de Saldo
O trigger `fn_atualiza_saldo_estoque()` calcula o delta correto por tipo:
- Positivo: entrada, devolucao, transferencia_in, ajuste_positivo
- Negativo: saida, transferencia_out, ajuste_negativo, baixa

Usa `GREATEST(0, saldo + delta)` para evitar saldo negativo.

### Depreciação
`useCalcularDepreciacao(competencia)` processa todos os imobilizados ativos em lote, usando `upsert` com conflito em `(imobilizado_id, competencia)` para idempotência.

### Inventário
`useAbrirInventario()` cria a sessão e auto-popula os itens a partir do saldo atual em `est_saldos`, para que o contador saiba o valor de referência do sistema.
