---
tipo: tarefa
id: TASK-009
titulo: "Integração Omie ERP"
status: concluido
prioridade: alta
modulo: financeiro
responsavel: Leandro
milestone: MS-004
sprint: Sprint-4
estimativa: 21
gasto: 21
data_inicio: 2026-03-03
data_fim: 2026-03-03
tags: [tarefa, omie, financeiro, integracao, concluido]
---

# ✅ TASK-009 — Integração Omie ERP

## Descrição
Integração com Omie ERP via n8n Squads: sincronização bidirecional de dados financeiros (fornecedores, CP, CR) e escrita de aprovações de pagamento de volta ao Omie.

## Entregas
- [x] Configuração de credenciais Omie (tela Financeiro → Configurações)
- [x] Tabela `sys_config` + função `get_omie_config()` com SECURITY DEFINER
- [x] Squad 1 — Sync Fornecedores (`workflow-omie-sync-fornecedores.json`)
- [x] Squad 2 — Sync Contas a Pagar (`workflow-omie-sync-cp.json`) com schedule 6h
- [x] Squad 3 — Sync Contas a Receber (`workflow-omie-sync-cr.json`) com schedule 6h
- [x] Squad 4 — Aprovar Pagamento (`workflow-omie-aprovacao-pgto.json`)
- [x] Log de sincronização em `fin_sync_log`
- [x] SyncBar no frontend (última sync + botão sincronizar)
- [x] Toggle de integração (habilitar/desabilitar via UI)

## Fora do Escopo (próximas tarefas)
- [ ] Importação automática de NF-e via SEFAZ
- [ ] Conciliação PO × NF-e automática

## Links
- [[19 - Integração Omie]]
- [[20 - Módulo Financeiro]]
