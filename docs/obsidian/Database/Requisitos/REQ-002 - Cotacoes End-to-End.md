---
tipo: requisito
id: REQ-002
titulo: "Cotações end-to-end automatizadas"
categoria: funcional
prioridade: critica
status: entregue
modulo: compras
sprint: Sprint-2
milestone: MS-002
tags: [requisito, cotacao, comprador, fornecedor, po]
---

# 🔵 REQ-002 — Cotações End-to-End

## Descrição
Fluxo completo de cotação: comprador recebe fila, insere preços de fornecedores, sistema aplica regras (1/2/3 cotações), aprovação automática e geração do PO.

## Critérios de Aceite
- [x] Fila por comprador responsável pela categoria
- [x] Número de cotações obrigatórias aplicado automaticamente
- [x] CotacaoComparativo destaca menor preço por item
- [x] PO gerado automaticamente após aprovação
- [x] Número PO-YYYYMM-XXXX único e sequencial

> Entregue. Inclui recomendacao AI multi-criterio desde Abr 2026.

## Tarefa Relacionada
- [[Database/Tarefas/TASK-006 - Cotacoes End-to-End|TASK-006 — Cotações End-to-End]]
- [[Database/Milestones/MS-002 - Cotacoes e Notificacoes|MS-002 — Cotações e Notificações]]
- [[14 - Compradores e Categorias]]
- [[26 - Upload Inteligente Cotacao]]
