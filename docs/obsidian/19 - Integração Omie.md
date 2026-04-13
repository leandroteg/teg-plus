---
title: Integração Omie ERP
type: integração
status: futuro
tags: [omie, erp, n8n, squads, financeiro, integração]
criado: 2026-03-03
atualizado: 2026-04-09
relacionado: ["[[10 - n8n Workflows]]", "[[20 - Módulo Financeiro]]", "[[07 - Schema Database]]", "[[08 - Migrações SQL]]", "[[45 - Mapa de Integrações]]", "[[ADR-009 - Omie Integracao]]"]
---

# Integração Omie ERP — TEG+

## Visão Geral

> **⏳ Status: FUTURO (~Jun 2026)** — Esta integração ainda não está ativa. O mapeamento abaixo documenta a arquitetura planejada.

O TEG+ se conectará ao **Omie ERP** para **emissão de lotes de pagamento** e **conciliação bancária**. O **n8n** atuará como middleware, orquestrando chamadas à API Omie e persistindo os dados no Supabase.

```mermaid
flowchart LR
    FE[Frontend TEG+] -->|trigger sync| N8N[n8n Squads]
    N8N -->|API calls| OMIE[Omie ERP API]
    OMIE -->|JSON| N8N
    N8N -->|upsert| DB[(Supabase)]
    DB -->|RLS query| FE
```

**Escopo planejado (NÃO é sync bidirecional completo):**
- Emissão de lotes de contas a pagar para pagamento em massa
- Conciliação de pagamentos (TEG+ ↔ Omie)
- **NÃO inclui**: sync geral de cadastros, fiscal, CR

---

## Configuração

### Credenciais

Armazenadas na tabela `sys_config` (colunas-chave):

| Chave | Descrição |
|-------|-----------|
| `omie_app_key` | App Key gerada no Portal Omie |
| `omie_app_secret` | App Secret correspondente |
| `omie_habilitado` | `"true"` para ativar a integração |
| `n8n_base_url` | URL base do n8n (ex: `https://n8n.tegplus.com.br/webhook`) |

### Onde Configurar

**Financeiro → Configurações** (acesso: role `admin`)

- Campos mascarados para App Key / App Secret
- Toggle para habilitar/desabilitar a integração
- Tabela de status de sync por domínio em tempo real

### Função Helper

```sql
-- Retorna as credenciais com SECURITY DEFINER (bypass RLS)
SELECT get_omie_config();
-- → { "app_key": "...", "app_secret": "...", "habilitado": true }
```

---

## Arquitetura de Squads

Cada squad é um workflow n8n dedicado a um domínio. Operam de forma independente e idempotente.

```mermaid
graph TD
    FE[Frontend TEG+] -->|POST webhook| S1[Squad 1\nFornecedores]
    FE -->|POST webhook| S2[Squad 2\nContas a Pagar]
    FE -->|POST webhook| S3[Squad 3\nContas a Receber]
    FE -->|POST webhook| S4[Squad 4\nAprovar Pagamento]

    S1 -->|upsert| cmp_forn[(cmp_fornecedores)]
    S2 -->|upsert| fin_cp[(fin_contas_pagar)]
    S3 -->|upsert| fin_cr[(fin_contas_receber)]
    S4 -->|write-back| OMIE[Omie ERP]

    S2 -->|Schedule 6h| OMIE
    S3 -->|Schedule 6h| OMIE
    S1 -->|on demand| OMIE
```

**Princípios:**
- **Idempotência:** upsert por `omie_id`, sem duplicatas
- **Observabilidade:** toda execução gravada em `fin_sync_log`
- **Responsabilidade única:** cada squad cuida de um domínio

---

## Squad 1 — Sync Fornecedores

**Arquivo:** `n8n-docs/workflow-omie-sync-fornecedores.json`
**Webhook:** `POST /omie/sync/fornecedores`
**Trigger:** Manual / chamado pelo frontend

```mermaid
flowchart LR
    W[Webhook] --> CF[get_omie_config\nSupabase RPC]
    CF --> OL[Omie\nListarFornecedores]
    OL --> TR[Transform\nJSON]
    TR --> UP[Upsert\ncmp_fornecedores]
    UP --> LOG[Log\nfin_sync_log]
    LOG --> R[Respond 200]
```

**Mapeamento Omie → Supabase:**

| Campo Omie | Campo TEG+ | Obs |
|-----------|------------|-----|
| `codigo_cliente_omie` | `omie_id` | PK de sync |
| `razao_social` | `nome` | — |
| `cnpj_cpf` | `cnpj` | — |
| `telefone1_numero` | `telefone` | — |
| `email` | `email` | — |
| `cidade` | `cidade` | — |
| `estado` | `estado` | — |

---

## Squad 2 — Sync Contas a Pagar

**Arquivo:** `n8n-docs/workflow-omie-sync-cp.json`
**Webhook:** `POST /omie/sync/contas-pagar`
**Trigger:** Schedule (6h) + Manual via frontend

```mermaid
flowchart LR
    W[Webhook\nou Schedule] --> CF[get_omie_config]
    CF --> OL[Omie\nListarContasPagar]
    OL --> TR[Transform]
    TR --> UP[Upsert\nfin_contas_pagar]
    UP --> LOG[Log fin_sync_log]
    LOG --> R[Respond 200]
```

**Mapeamento Omie → Supabase:**

| Campo Omie | Campo TEG+ |
|-----------|------------|
| `codigo_lancamento_omie` | `omie_id` |
| `nome_fornecedor` | `fornecedor_nome` |
| `valor_documento` | `valor` |
| `data_vencimento` | `data_vencimento` |
| `status_titulo` | `status` |
| `codigo_categoria` | `categoria` |

---

## Squad 3 — Sync Contas a Receber

**Arquivo:** `n8n-docs/workflow-omie-sync-cr.json`
**Webhook:** `POST /omie/sync/contas-receber`
**Trigger:** Schedule (6h) + Manual

Mesmo padrão do Squad 2, aplicado a `fin_contas_receber`.

**Mapeamento:** `codigo_lancamento_omie` → `omie_id`, cliente, valor, vencimento.

---

## Squad 4 — Aprovar Pagamento

**Arquivo:** `n8n-docs/workflow-omie-aprovacao-pgto.json`
**Webhook:** `POST /omie/aprovar-pagamento`
**Trigger:** Chamado pelo financeiro ao registrar pagamento no TEG+

```mermaid
flowchart LR
    W[Webhook\ncp_id] --> VL[Validar CP\nexiste + status]
    VL --> CF[get_omie_config]
    CF --> OA[Omie\nAlterarStatusCP\n→ pago]
    OA --> UPD[Update\nfin_contas_pagar\nomie_sincronizado=true]
    UPD --> LOG[Log fin_sync_log]
    LOG --> R[Respond 200]
```

---

## Log de Sincronização

Tabela `fin_sync_log`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | — |
| `dominio` | VARCHAR | fornecedores / contas-pagar / contas-receber |
| `status` | VARCHAR | sucesso / erro / parcial |
| `registros` | INTEGER | Qtd de registros processados |
| `executado_em` | TIMESTAMPTZ | Timestamp da execução |
| `detalhes` | JSONB | Erros ou informações adicionais |

**Consulta de saúde:**
```sql
SELECT DISTINCT ON (dominio)
  dominio, status, registros,
  to_char(executado_em, 'DD/MM HH24:MI') as ultima_sync
FROM fin_sync_log
ORDER BY dominio, executado_em DESC;
```

---

## SyncBar (Frontend)

Componente exibido em Fornecedores, Contas a Pagar e Contas a Receber quando `omie_habilitado = true`:

```
🔄  Última sync: hoje 14:32 — 127 fornecedores    [Sincronizar]
```

- Verde: sync recente (< 6h)
- Amarelo: sync antiga (> 6h)
- Vermelho: último sync com erro

---

## Troubleshooting

| Erro | Causa provável | Solução |
|------|---------------|---------|
| `401 Unauthorized` (Omie) | App Key/Secret inválidas | Verificar em Financeiro → Configurações |
| `404` no webhook n8n | URL base errada | Verificar `n8n_base_url` em `sys_config` |
| `RLS denied` no upsert | Service Role Key não configurada | Configurar credencial Supabase no n8n |
| Sync parcial | Timeout na API Omie | Verificar `detalhes` em `fin_sync_log` |
| Campos vazios após sync | Mapeamento divergiu | Inspecionar resposta JSON da Omie no log do n8n |

---

## Links Relacionados

- [[10 - n8n Workflows]] — Workflows base do TEG+
- [[20 - Módulo Financeiro]] — Telas e hooks do módulo financeiro
- [[21 - Fluxo Pagamento]] — Fluxo completo compras → pagamento
- [[07 - Schema Database]] — Tabelas `fin_*` e `sys_config`
- [[08 - Migrações SQL]] — Migration `013_omie_integracao.sql`
