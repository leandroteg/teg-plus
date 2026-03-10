---
tipo: milestone
id: MS-010
titulo: "Módulo Contratos e Medições de Obra"
status: em-andamento
fase: Q1-2026
data_alvo: 2026-06-30
progresso: 80
updated: 2026-03-10
modulo: contratos
tags: [milestone, contratos, medicoes, boletim, aditivos]
---

# 🔵 MS-010 — Módulo Contratos e Medições

## Visão Geral
Gestão completa de contratos (cliente e fornecedor), boletins de medição, aditivos contratuais, cronograma físico-financeiro e integração com Financeiro para faturamento.

## Entregas — Contratos v2 (Implementado 2026-03-10)

### Core (Concluído)
- [x] Pipeline de 7 estágios: solicitação -> análise -> melhorias -> minuta -> aprovação -> assinatura -> encerramento
- [x] Análise AI com Gemini (avaliação de cláusulas e riscos)
- [x] Geração de minuta formal com jsPDF (PDF nativo no browser)
- [x] Aprovação via AprovAi (tipo: minuta_contratual)
- [x] Executive summary + PDF attachment nos cards de aprovação
- [x] Schema DB: con_contratos, con_contrato_itens, con_clientes, con_parcelas, con_parcela_anexos
- [x] Cadastro de clientes
- [x] Parcelas com controle de pagamento

### Pendente
- [ ] Boletins de Medição (BM)
- [ ] Aditivos contratuais
- [ ] Cronograma físico-financeiro por contrato
- [ ] SLA e penalidades
- [ ] Reajustes (IGPM, IPCA)

### Integrações
- [ ] Financeiro (faturamento por medição)
- [ ] Controladoria (previsto vs realizado)
- [ ] Monday.com PMO (cronograma)
- [ ] Compras (compras por contrato)

## Tarefas
| ID | Tarefa | Status |
|----|--------|--------|
| [[TASK-025 - Contratos Gestao Medicoes\|TASK-025]] | Gestão de Contratos e Medições | 🟡 parcial (v2 pipeline done, medições pendente) |

## Progresso
`████████░░` 80%
