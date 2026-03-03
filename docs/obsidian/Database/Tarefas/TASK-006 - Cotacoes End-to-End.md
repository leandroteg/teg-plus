---
tipo: tarefa
id: TASK-006
titulo: "Cotações End-to-End via n8n"
status: em-andamento
prioridade: critica
modulo: compras
responsavel: Leandro
milestone: MS-002
sprint: Sprint-2
estimativa: 13
gasto: 3
data_inicio: 2026-03-01
data_fim: 2026-03-31
tags: [tarefa, cotacao, n8n, comprador, pedido]
---

# 🔵 TASK-006 — Cotações End-to-End

## Descrição
Fluxo completo de cotação: fila de cotações → comparativo de fornecedores → aprovação da cotação → geração automática de PO via n8n.

## Entregas
- [x] UI básica FilaCotacoes.tsx
- [x] UI básica CotacaoForm.tsx
- [ ] Workflow n8n `POST /compras/cotacao`
- [ ] Regras automáticas (1/2/3 cotações por valor)
- [ ] Aprovação da cotação pelo solicitante
- [ ] Geração automática de PO
- [ ] Número PO-YYYYMM-XXXX

## Links
- [[11 - Fluxo Requisição]]
- [[10 - n8n Workflows]]
