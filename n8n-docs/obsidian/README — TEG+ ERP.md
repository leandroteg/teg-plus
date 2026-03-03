# TEG+ ERP — Documentação Técnica

> Sistema ERP para gestão de compras, obras e finanças | Última atualização: 2026-03-03

---

## Índice Geral

| Módulo | Documento | Descrição |
|--------|-----------|-----------|
| **Compras** | [[Módulo Compras]] | Requisições, cotações, pedidos, anexos, liberar pgto |
| **Financeiro** | [[Índice Financeiro]] | CP, CR, fornecedores, Omie ERP |
| **Financeiro** | [[Fluxo de Pagamento]] | Ciclo completo compras → financeiro |
| **Integração** | [[TEG+ Integração Omie]] | Arquitetura técnica da integração Omie |
| **Integração** | [[Setup Integração Omie]] | Guia passo a passo de configuração |
| **Integração** | [[Arquitetura Agent Squads]] | n8n Squads e automações |

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Estado | @tanstack/react-query |
| Backend / DB | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (JWT) |
| Storage | Supabase Storage |
| Automação | n8n (workflows / webhooks) |
| ERP externo | Omie ERP |
| Deploy | Vercel (frontend) |

---

## Módulos Implementados

### Compras

- **Requisição de Compra** — abertura manual ou via texto livre (IA)
- **Cotações** — múltiplos fornecedores, regras de alçada, bypass com justificativa
- **Aprovações** — multi-nível, link por token, alçadas configuráveis por categoria
- **Pedidos de Compra** — PDF, compartilhamento WhatsApp/E-mail, confirmação de entrega
- **Liberar para Pagamento** — upload de NF, comprovante de entrega, medição
- **Histórico de Anexos** — compras + financeiro, visível em ambos os módulos

### Financeiro

- **Contas a Pagar** — gestão de CP, status, vencimentos, filtros
- **Contas a Receber** — gestão de CR
- **Fornecedores** — cadastro e sync com Omie
- **Configurações** — credenciais Omie, webhook n8n, toggle de integração
- **Integração Omie** — sync via n8n squads, status em tempo real

### Fluxo Compras → Financeiro

```
PO emitido → CP criado (Previsto)
Entrega confirmada → Liberar para Pagamento
Pgto liberado → CP: Aguard. Aprovação
Pgto registrado → CP: Pago | Comprovante visível ao comprador
```

---

## Banco de Dados — Tabelas Principais

| Schema | Tabela | Descrição |
|--------|--------|-----------|
| public | `sys_perfis` | Perfis de usuário |
| public | `sys_config` | Configurações do sistema (Omie, etc.) |
| public | `cmp_requisicoes` | Requisições de compra |
| public | `cmp_categorias` | Categorias de material e alçadas |
| public | `cmp_compradores` | Compradores responsáveis |
| public | `cmp_cotacoes` | Cabeçalho de cotações |
| public | `cmp_cotacao_fornecedores` | Propostas por fornecedor |
| public | `cmp_aprovacoes` | Aprovações e histórico |
| public | `cmp_pedidos` | Pedidos de compra |
| public | `cmp_pedidos_anexos` | Anexos dos pedidos (NF, comprovante, etc.) |
| public | `cmp_fornecedores` | Cadastro de fornecedores |
| public | `fin_contas_pagar` | Contas a pagar |
| public | `fin_contas_receber` | Contas a receber |
| public | `fin_sync_log` | Log de sincronizações Omie |
| storage | `pedidos-anexos` | Bucket de arquivos dos POs |

---

## Migrations (ordem de execução)

| Arquivo | Descrição |
|---------|-----------|
| `001_*.sql` — `009_*.sql` | Schema base, RLS, categorias, fluxo aprovação |
| `010_categorias.sql` | Categorias com regras de cotação e alçada |
| `011_*.sql` | Ajustes e fixes |
| `012_fix_rls_perfis.sql` | Fix RLS recursiva em sys_perfis |
| `013_omie_integracao.sql` | sys_config + fin_sync_log + RLS + get_omie_config() |
| `014_fluxo_pagamento.sql` | Anexos, status_pagamento, triggers, storage bucket |

> Execute sempre em ordem numérica no Supabase SQL Editor.

---

## Workflows n8n

| # | Nome | Arquivo JSON | Trigger |
|---|------|-------------|---------|
| 1 | Sync Fornecedores | `workflow-omie-sync-fornecedores.json` | Webhook / Manual |
| 2 | Sync Contas a Pagar | `workflow-omie-sync-contas-pagar.json` | Schedule 6h + Webhook |
| 3 | Sync Contas a Receber | `workflow-omie-sync-contas-receber.json` | Schedule 6h + Webhook |
| 4 | Aprovar Pagamento | `workflow-omie-aprovacao-pgto.json` | Webhook |

**Base URL:** `https://seu-n8n.dominio.com.br/webhook`

---

## Variáveis de Ambiente (Frontend)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## Links Rápidos

- [Supabase Dashboard](https://supabase.com/dashboard)
- [n8n Painel](https://seu-n8n.dominio.com.br)
- [Omie Developer Portal](https://developer.omie.com.br)
- [Vercel Dashboard](https://vercel.com/dashboard)
