---
tipo: requisito
id: REQ-015
titulo: "Integrações Internas — Financeiro com demais módulos TEG+"
categoria: funcional
prioridade: critica
status: entregue
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
tags: [requisito, financeiro, integracao, rh, suprimentos, compras]
---

# 📋 REQ-015 — Integrações Internas do Módulo Financeiro

## Descrição
O módulo financeiro deve ser integrado com os demais módulos do TEG+ para eliminar lançamentos manuais, retrabalho e inconsistências.

## Integrações Obrigatórias

### Compras → Financeiro
- [x] **PO emitido** → CP criado automaticamente via trigger (status: previsto) ✅
- [x] Status do pagamento visível ao comprador (badges: Aguard. Pgto / Pago) ✅
- [x] Comprovante de pagamento acessível ao comprador nos Anexos do PO ✅
- [x] Liberar para Pagamento com upload de NF/comprovante de entrega ✅

### Vendas / NF de Venda → Financeiro
- [ ] **NF de Venda emitida** gera automaticamente Conta a Receber no Omie

### RH → Financeiro
- [ ] RH envia remessa de pagamento de Folha para o financeiro executar
- [ ] Financeiro confirma a execução e devolve comprovante para RH

### Controladoria → Financeiro
- [ ] Controladoria gera relatórios de pagamento, recebimento por classe / CC / projeto sem acionar TI
- [ ] Banco de dados acessível para dashboards e relatórios personalizados

## Integrações Externas Importantes

### Busca de CNPJ
- [ ] Preenchimento automático de dados do fornecedor via CNPJ (Receita Federal)

### Gestão de Obras
- [ ] Integração com sistema de gestão de obras para apontamento de custos
- [ ] Relatório previsto × realizado por obra acessível no financeiro

## Tarefas Relacionadas
- [[TASK-009 - Integracao Omie]]
- [[TASK-013 - CP Workflow Aprovacao]]
- [[TASK-018 - Integracao RH Folha]]
