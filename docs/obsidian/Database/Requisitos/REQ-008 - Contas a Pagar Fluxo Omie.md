---
tipo: requisito
id: REQ-008
titulo: "Contas a Pagar — Fluxo Completo com Omie"
categoria: funcional
prioridade: critica
status: entregue
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
tags: [requisito, financeiro, contas-a-pagar, omie, pagamento]
---

# 📋 REQ-008 — Contas a Pagar — Fluxo Completo com Omie

## Objetivo
Garantir governança total sobre pagamentos: pagar somente o que deve ser pago, sem erros, no prazo correto, com toda documentação obrigatória e rastreabilidade por classe, CC e projeto.

## Contexto — Decisão Arquitetural
**Opção A adotada:** Interface própria do TEG+ + API Omie no back (front TEG+, dados Omie).

## Fluxo Implementado
```
PO Emitido (TEG+)
  └─► CP criado automaticamente via TRIGGER (status: previsto) ✅
        └─► Comprador confirma entrega + libera para pagamento ✅
              └─► CP → aguardando_aprovacao (TRIGGER) ✅
                    └─► Financeiro registra pagamento + comprovante ✅
                          └─► CP → pago | PO → pago (TRIGGER) ✅
                                └─► Comprovante visível ao comprador ✅
                                      └─► [pendente] Remessa bancária em lote
```

## Critérios de Aceite
- [x] PO emitido → CP criado automaticamente (status: previsto) ✅
- [x] Comprador pode liberar para pagamento com upload de NF ✅
- [x] Financeiro registra pagamento com comprovante ✅
- [x] Comprovante visível ao comprador no módulo Compras ✅
- [x] Rastreabilidade: status visível em ambos os módulos ✅
- [ ] Sistema bloqueia pagamento sem documentos obrigatórios
- [ ] Aprovação formal do Diretor Presidente (alçada)
- [ ] 99,8% dos pagamentos seguindo o fluxo previsto documentado
- [ ] Remessa bancária em lote

## Documentos Obrigatórios por Pagamento
- Ordem de Compra ou Contrato
- Boleto / Fatura / Nota Fiscal
- Recibo
- Comprovante de pagamento
- Relatório de Pagamentos
- Extrato Bancário

## Exceções ao Fluxo Padrão
- Repasse de viagem
- Reembolso
- Pagamentos com status "previsto" (regras específicas a definir)

## Tarefas Relacionadas
- [[TASK-009 - Integracao Omie]]
- [[TASK-013 - CP Workflow Aprovacao]]
