---
tipo: milestone
id: MS-006
titulo: "Módulo Estoque e Patrimonial"
progresso: 60
status: em_andamento
sprint: Sprint-5
data_inicio: 2026-03-03
data_fim_prevista: 2026-04-15
tags: [milestone, estoque, patrimonial, almoxarifado]
---

# 🏁 MS-006 — Módulo Estoque e Patrimonial

## Objetivo
Lançar o módulo completo de gestão de almoxarifado e patrimônio fixo, com rastreabilidade de movimentações, inventário cíclico e depreciação automática.

## Progresso: 60%

## Tarefas

| Tarefa | Status | Sprint |
|--------|--------|--------|
| [[TASK-019 - Estoque Core]] | ✅ concluído | Sprint-5 |
| TASK-020 - Inventário Avançado | ⬜ backlog | Sprint-6 |
| TASK-021 - Termos Responsabilidade PDF | ⬜ backlog | Sprint-6 |
| TASK-022 - Relatórios Estoque | ⬜ backlog | Sprint-7 |

## Entregas

### Sprint-5 (✅ Concluído)
- [x] Migration 015 — schema completo (13 tabelas, triggers, RLS)
- [x] Types TypeScript para estoque e patrimonial
- [x] Hooks React Query (useEstoque, usePatrimonial)
- [x] EstoqueLayout (sidebar azul/índigo)
- [x] EstoqueHome — dashboard com KPIs
- [x] Itens — catálogo com curva ABC, filtros, cadastro
- [x] Movimentacoes — histórico e registro de entrada/saída/transferência
- [x] Inventario — abertura, contagem, conclusão com acurácia
- [x] Patrimonial — imobilizados, depreciação, baixa, termos
- [x] App.tsx — rotas `/estoque/*` com EstoqueLayout
- [x] ModuloSelector — estoque `active: true`

### Sprint-6 (Planejado)
- [ ] Geração de PDF para termos de responsabilidade
- [ ] QR Code por imobilizado
- [ ] Solicitações de material com workflow aprovação
- [ ] Relatório de inventário com divergências

### Sprint-7 (Planejado)
- [ ] Dashboard avançado com gráficos de curva ABC
- [ ] Integração TOTVS para exportação de depreciações
- [ ] Remessa automática de reposição
