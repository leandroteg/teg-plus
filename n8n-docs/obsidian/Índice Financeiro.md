# Índice Financeiro

> Módulo: Financeiro | Última atualização: 2026-03-03

Página índice do módulo Financeiro do TEG+. Navegue pelas subpáginas para documentação detalhada de cada componente.

---

## Documentação do Módulo

| Página | Descrição | Status |
|--------|-----------|--------|
| [[TEG+ Integração Omie]] | Arquitetura, mapeamentos e troubleshooting da integração Omie | Rascunho |
| [[Setup Integração Omie]] | Guia passo a passo para configurar a integração | Rascunho |
| [[Arquitetura Agent Squads]] | Como os squads de agentes n8n funcionam | Rascunho |

---

## Domínios do Módulo Financeiro

### Fornecedores
- **Tabela:** `cmp_fornecedores`
- **Fonte:** Omie ERP (sync unidirecional)
- **Workflow:** `TEG+ | Omie - Sync Fornecedores`
- **Webhook:** `POST /omie/sync/fornecedores`
- **Status:** Implementado

### Contas a Pagar
- **Tabela:** `fin_contas_pagar`
- **Fonte:** Omie ERP (sync bidirecional com aprovações)
- **Workflow:** `TEG+ | Omie - Sync Contas a Pagar`
- **Webhook:** `POST /omie/sync/contas-pagar`
- **Status:** Planejado

### Contas a Receber
- **Tabela:** `fin_contas_receber`
- **Fonte:** Omie ERP (sync unidirecional)
- **Workflow:** `TEG+ | Omie - Sync Contas a Receber`
- **Webhook:** `POST /omie/sync/contas-receber`
- **Status:** Planejado

### Aprovações de Pagamento
- **Tabela:** `fin_aprovacoes`
- **Fonte:** TEG+ (interno, dispara escrita no Omie)
- **Workflow:** `TEG+ | Omie - Aprovar Pagamento`
- **Webhook:** `POST /omie/aprovar-pagamento`
- **Status:** Planejado

---

## Referência Rápida de Webhooks

| Webhook | Método | Workflow | Status |
|---------|--------|----------|--------|
| `/omie/sync/fornecedores` | POST | TEG+ \| Omie - Sync Fornecedores | Ativo |
| `/omie/sync/contas-pagar` | POST | TEG+ \| Omie - Sync Contas a Pagar | Planejado |
| `/omie/sync/contas-receber` | POST | TEG+ \| Omie - Sync Contas a Receber | Planejado |
| `/omie/aprovar-pagamento` | POST | TEG+ \| Omie - Aprovar Pagamento | Planejado |

**URL base (produção):** `https://seu-n8n.dominio.com.br/webhook`

---

## Referência Rápida de Tabelas

| Tabela | Linhas (aprox.) | Última Sync |
|--------|-----------------|-------------|
| `cmp_fornecedores` | — | — |
| `fin_contas_pagar` | — | — |
| `fin_contas_receber` | — | — |
| `fin_aprovacoes` | — | — |
| `fin_sync_log` | — | — |
| `sys_config` | ~10 chaves | Manual |

> Atualizar manualmente após a primeira sincronização.

### Consulta rápida de saúde

```sql
-- Resumo de sync por domínio
SELECT DISTINCT ON (dominio)
  dominio,
  status,
  registros,
  to_char(executado_em, 'DD/MM/AAAA HH24:MI') as executado_em
FROM fin_sync_log
ORDER BY dominio, executado_em DESC;
```

---

## Workflows n8n - Módulo Financeiro

| # | Nome | Arquivo JSON | Status |
|---|------|-------------|--------|
| 7 | TEG+ \| Omie - Sync Fornecedores | `workflow-omie-sync-fornecedores.json` | Implementado |
| 8 | TEG+ \| Omie - Sync Contas a Pagar | `workflow-omie-sync-contas-pagar.json` | Planejado |
| 9 | TEG+ \| Omie - Sync Contas a Receber | `workflow-omie-sync-contas-receber.json` | Planejado |
| 10 | TEG+ \| Omie - Aprovar Pagamento | `workflow-omie-aprovar-pagamento.json` | Planejado |

---

## Status de Implementação

### Concluído

- [x] Arquitetura da integração definida
- [x] Mapeamento de campos Omie → Supabase documentado
- [x] Workflow de sync de fornecedores (Squad 1)
- [x] Documentação técnica (esta seção)

### Em Desenvolvimento

- [ ] Workflow de sync de contas a pagar (Squad 2)
- [ ] Workflow de sync de contas a receber (Squad 3)
- [ ] Workflow de aprovação de pagamento (Squad 4)
- [ ] Tela Financeiro → Fornecedores no Frontend
- [ ] Tela Financeiro → Contas a Pagar no Frontend
- [ ] Tela Financeiro → Contas a Receber no Frontend

### Planejado (Futuro)

- [ ] Squad 5: Agent NF (notas fiscais)
- [ ] Squad 6: Agent Remessa (CNAB)
- [ ] Squad 7: Agent Conciliação (extrato bancário)
- [ ] Dashboard financeiro com KPIs (DRE, fluxo de caixa)
- [ ] Relatórios de aging (inadimplência)
- [ ] Integração Open Finance

---

## Configurações Necessárias (`sys_config`)

| Chave | Descrição | Onde Configurar |
|-------|-----------|-----------------|
| `omie_app_key` | App Key do app Omie | Financeiro → Configurações |
| `omie_app_secret` | App Secret do app Omie | Financeiro → Configurações |
| `omie_habilitado` | Flag de integração ativa (`true`/`false`) | Financeiro → Configurações |
| `n8n_base_url` | URL base do n8n | Financeiro → Configurações |

---

## Diagrama de Dependências

```
Frontend TEG+
      │
      ├──▶ n8n Workflows ──▶ Omie ERP API
      │          │
      │          ▼
      └──▶ Supabase (PostgreSQL)
               │
               ├── sys_config (credenciais)
               ├── cmp_fornecedores
               ├── fin_contas_pagar
               ├── fin_contas_receber
               ├── fin_aprovacoes
               └── fin_sync_log
```

---

## Links Externos

- [Omie ERP](https://www.omie.com.br)
- [Developer Portal Omie](https://developer.omie.com.br)
- [Documentação API Omie](https://developer.omie.com.br/service-list/)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [n8n Painel](https://seu-n8n.dominio.com.br)

---

## Outros Módulos TEG+

- [[Compras]] - Requisições, aprovações e suprimentos
- [[Obras]] - Gestão de obras e subestações
- [[Dashboard]] - Painéis e KPIs
