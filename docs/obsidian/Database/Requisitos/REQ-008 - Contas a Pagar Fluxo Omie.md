---
tipo: requisito
id: REQ-008
titulo: "Contas a Pagar — Fluxo Completo com Omie"
categoria: funcional
prioridade: critica
status: planejado
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
tags: [requisito, financeiro, contas-a-pagar, omie, pagamento]
---

# 📋 REQ-008 — Contas a Pagar — Fluxo Completo com Omie

## Objetivo
Garantir governança total sobre pagamentos: pagar somente o que deve ser pago, sem erros, no prazo correto, com toda documentação obrigatória e rastreabilidade por classe, CC e projeto.

## Contexto — Papel do Omie
O Omie será o **módulo central financeiro**. O TEG+ pode atuar como:
- **Opção A** — Interface própria do TEG+ consumindo API do Omie (front TEG+, back Omie)
- **Opção B** — Omie como back automatizado por IA, com o usuário operando o próprio Omie
> Decisão arquitetural a definir em sprint de discovery do módulo financeiro.

## Fluxo Previsto
```
PO Aprovado (TEG+)
  └─► Lançamento CP no Omie (automático via API)
        └─► NF/Boleto anexado + documentos obrigatórios
              └─► Aprovação Diretor Presidente (Laucídio)
                    └─► Remessa bancária em lote
                          └─► Baixa automática + conciliação
```

## Critérios de Aceite
- [ ] PO aprovado gera CP no Omie em < 5 minutos via API
- [ ] Sistema bloqueia pagamento sem documentos obrigatórios anexados
- [ ] Pagamento não sai sem aprovação do Diretor Presidente
- [ ] Rastreabilidade completa: classe financeira, centro de custo, projeto
- [ ] 99,8% dos pagamentos seguindo o fluxo previsto documentado
- [ ] Equipe opera sem sobrecarga (poucos cliques por operação, poucos lançamentos manuais)

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
