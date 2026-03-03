---
tipo: tarefa
id: TASK-006
titulo: "Cotações End-to-End"
status: concluido
prioridade: critica
modulo: compras
responsavel: Leandro
milestone: MS-002
sprint: Sprint-2
estimativa: 13
gasto: 13
data_inicio: 2026-03-01
data_fim: 2026-03-03
tags: [tarefa, cotacao, n8n, comprador, pedido, concluido]
---

# ✅ TASK-006 — Cotações End-to-End

## Descrição
Fluxo completo de cotação: fila de cotações → comparativo de fornecedores → aprovação da cotação → geração de PO.

## Entregas
- [x] UI básica FilaCotacoes.tsx
- [x] UI básica CotacaoForm.tsx
- [x] Regras automáticas de alçada (1/2/3 cotações por faixa de valor)
- [x] Bypass: enviar sem mínimo de fornecedores + justificativa obrigatória
- [x] Alerta visual ao aprovador quando cotação enviada sem mínimo
- [x] Aprovação da cotação pelo aprovador
- [x] Geração de Pedido de Compra (PO)
- [x] Número PO-AAAA-NNNNN sequencial
- [x] PDF do PO gerado no browser (sem dependências externas)
- [x] Compartilhamento via WhatsApp e E-mail

## Links
- [[11 - Fluxo Requisição]]
- [[10 - n8n Workflows]]
- [[21 - Fluxo Pagamento]]
