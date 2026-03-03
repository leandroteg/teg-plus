---
tipo: requisito
id: REQ-010
titulo: "Conciliação e Remessa Bancária"
categoria: funcional
prioridade: critica
status: planejado
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
tags: [requisito, financeiro, conciliacao, remessa, banco]
---

# 📋 REQ-010 — Conciliação e Remessa Bancária

## Descrição
Integração com banco para dois fluxos críticos:
1. **Remessa de pagamento em lote** — enviar centenas de pagamentos com zero sobrecarga para a equipe
2. **Conciliação bancária automática** — baixar pagamentos e recebimentos cruzando com o que está lançado no sistema

## Problema Atual (TOTVS)
O TOTVS atualiza datas de vencimento automaticamente, gerando erros no controle de pagamentos. O novo sistema não deve ter esse comportamento — datas só mudam por ação humana explícita e registrada.

## Critérios de Aceite

### Remessa Bancária
- [ ] Exportação de arquivo de remessa (CNAB 240/480) compatível com os bancos utilizados
- [ ] Envio de centenas de pagamentos em lote com poucos cliques
- [ ] Validação automática do arquivo antes do envio (campo a campo)
- [ ] Confirmação de envio e rastreio do status de cada pagamento no lote

### Conciliação Automática
- [ ] Importação automática do extrato bancário (OFX ou API Open Banking)
- [ ] Cruzamento automático de débitos/créditos com lançamentos no sistema
- [ ] Itens não conciliados destacados para revisão manual
- [ ] Relatório de itens pendentes de conciliação por período
- [ ] Data de vencimento **nunca** alterada automaticamente pelo sistema

## Tarefas Relacionadas
- [[TASK-014 - Conciliacao Remessa Bancaria]]
