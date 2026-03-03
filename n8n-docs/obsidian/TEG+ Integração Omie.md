# TEG+ Integração Omie

> Módulo: Financeiro | Status: Em desenvolvimento | Última atualização: 2026-03-03

---

## Visão Geral

O TEG+ integra com o **Omie ERP** para sincronização bidirecional de dados financeiros. A integração é orquestrada pelo **n8n** como middleware de automação, utilizando o **Supabase** como banco de dados compartilhado entre os sistemas.

Os dados trafegam nos dois sentidos: o Omie é a fonte de verdade para cadastros (fornecedores, contas a pagar, contas a receber), enquanto o TEG+ controla o fluxo de aprovações e pode disparar pagamentos de volta ao Omie.

---

## Arquitetura

```
┌─────────────┐        ┌─────────────┐        ┌──────────────────┐
│             │        │             │        │                  │
│   Frontend  │──POST──▶    n8n      │──POST──▶   Omie API       │
│   TEG+      │        │  Workflows  │        │   (REST/JSON)    │
│             │◀──JSON─│             │◀──JSON─│                  │
└─────────────┘        └──────┬──────┘        └──────────────────┘
                              │                        ▲
                           SQL│                        │
                          REST│                   Credenciais
                              │                  (app_key/secret)
                              ▼                        │
                       ┌─────────────┐                 │
                       │             │                 │
                       │  Supabase   │─────────────────┘
                       │  (Postgres) │   (lidas do sys_config)
                       │             │
                       └─────────────┘
```

**Fluxo resumido:**
1. Frontend dispara webhook no n8n (manual ou agendado)
2. n8n lê as credenciais Omie do `sys_config` no Supabase
3. n8n chama a API do Omie com as credenciais
4. Omie retorna os dados
5. n8n mapeia os campos e faz upsert no Supabase
6. n8n registra o resultado no `fin_sync_log`
7. Frontend exibe os dados sincronizados

---

## Endpoints da API Omie Utilizados

| Domínio | URL | Call | Método | Descrição |
|---------|-----|------|--------|-----------|
| Fornecedores | `https://app.omie.com.br/api/v1/geral/fornecedores/` | `ListarFornecedores` | POST | Lista todos os fornecedores ativos |
| Fornecedores | `https://app.omie.com.br/api/v1/geral/fornecedores/` | `ConsultarFornecedor` | POST | Detalhes de um fornecedor |
| Contas a Pagar | `https://app.omie.com.br/api/v1/financas/contapagar/` | `ListarContasPagar` | POST | Lista contas a pagar |
| Contas a Pagar | `https://app.omie.com.br/api/v1/financas/contapagar/` | `AlterarContaPagar` | POST | Atualiza uma conta a pagar |
| Contas a Receber | `https://app.omie.com.br/api/v1/financas/contareceber/` | `ListarContasReceber` | POST | Lista contas a receber |
| Contas a Receber | `https://app.omie.com.br/api/v1/financas/contareceber/` | `AlterarContaReceber` | POST | Atualiza uma conta a receber |
| Categorias | `https://app.omie.com.br/api/v1/geral/categorias/` | `ListarCategorias` | POST | Lista categorias financeiras |

**Autenticação:** Todas as chamadas incluem `app_key` e `app_secret` no corpo da requisição (não em headers). As credenciais são armazenadas no Supabase (`sys_config`) e nunca no código do workflow.

---

## Mapeamento de Campos

### Fornecedores (`cmp_fornecedores`)

| Campo Omie (API) | Campo TEG+ (DB) | Tipo | Observações |
|------------------|-----------------|------|-------------|
| `nCodFornecedor` | `omie_id` | text | ID numérico do Omie, armazenado como string |
| `cRazaoSocial` | `razao_social` | text | Nome legal da empresa |
| `cNomeFantasia` | `nome_fantasia` | text | Nome comercial |
| `cnpj_cpf` | `cnpj` | text | Armazenado sem formatação (só dígitos) |
| `cEmail` | `email` | text | Email principal |
| `telefone1_numero` | `telefone` | text | Telefone principal |
| `cEndereco` | `endereco` | text | Logradouro |
| `cCidade` | `cidade` | text | Cidade |
| `cEstado` | `estado` | text | UF (2 caracteres) |
| `cCEP` | `cep` | text | CEP sem formatação |
| _(gerado pelo sistema)_ | `id` | uuid | PK do Supabase |
| _(gerado pelo sistema)_ | `created_at` | timestamptz | Data de criação no TEG+ |
| _(gerado pelo sistema)_ | `updated_at` | timestamptz | Data de atualização |

**Chave de upsert:** `omie_id` (onConflict no endpoint REST do Supabase)

---

### Contas a Pagar (`fin_contas_pagar`)

| Campo Omie (API) | Campo TEG+ (DB) | Tipo | Observações |
|------------------|-----------------|------|-------------|
| `nCodCP` | `omie_cp_id` | text | ID da conta a pagar no Omie |
| `cFornecedor` | `fornecedor_nome` | text | Nome do fornecedor (desnormalizado) |
| `nCodFornecedor` | `fornecedor_omie_id` | text | FK para cmp_fornecedores.omie_id |
| `nValorDocumento` | `valor_original` | numeric | Valor total do documento |
| `nValorPago` | `valor_pago` | numeric | Valor já pago |
| `nValorAberto` | `valor_aberto` | numeric | Saldo devedor |
| `dDataVencimento` | `data_vencimento` | date | Formato Omie: DD/MM/AAAA |
| `dDataEmissao` | `data_emissao` | date | Formato Omie: DD/MM/AAAA |
| `dDataPagamento` | `data_pagamento` | date | Preenchido quando pago |
| `cNumeroDocumento` | `numero_documento` | text | Número da NF ou boleto |
| `cStatus` | `status_omie` | text | Status original do Omie |
| _(mapeado)_ | `status` | text | Status normalizado TEG+ |
| `cObservacao` | `observacao` | text | Campo livre |
| `cCategoria` | `categoria` | text | Categoria financeira |
| _(gerado)_ | `aprovado_por` | uuid | FK para usuário que aprovou |
| _(gerado)_ | `aprovado_em` | timestamptz | Data de aprovação no TEG+ |

**Chave de upsert:** `omie_cp_id`

---

### Contas a Receber (`fin_contas_receber`)

| Campo Omie (API) | Campo TEG+ (DB) | Tipo | Observações |
|------------------|-----------------|------|-------------|
| `nCodCR` | `omie_cr_id` | text | ID da conta a receber no Omie |
| `cCliente` | `cliente_nome` | text | Nome do cliente (desnormalizado) |
| `nCodCliente` | `cliente_omie_id` | text | ID do cliente no Omie |
| `nValorDocumento` | `valor_original` | numeric | Valor total do documento |
| `nValorRecebido` | `valor_recebido` | numeric | Valor já recebido |
| `nValorAberto` | `valor_aberto` | numeric | Saldo a receber |
| `dDataVencimento` | `data_vencimento` | date | Formato Omie: DD/MM/AAAA |
| `dDataEmissao` | `data_emissao` | date | Formato Omie: DD/MM/AAAA |
| `dDataRecebimento` | `data_recebimento` | date | Preenchido quando recebido |
| `cNumeroDocumento` | `numero_documento` | text | Número da NF ou título |
| `cStatus` | `status_omie` | text | Status original do Omie |
| _(mapeado)_ | `status` | text | Status normalizado TEG+ |
| `cObservacao` | `observacao` | text | Campo livre |
| `cCategoria` | `categoria` | text | Categoria financeira |

**Chave de upsert:** `omie_cr_id`

---

## Mapeamento de Status

### Contas a Pagar

| Status Omie (`cStatus`) | Status TEG+ (`status`) | Descrição |
|------------------------|------------------------|-----------|
| `ABERTO` | `pendente` | Aguardando vencimento |
| `VENCIDO` | `vencido` | Passou da data de vencimento |
| `PAGO` | `pago` | Baixado como pago no Omie |
| `CANCELADO` | `cancelado` | Cancelado no Omie |
| `PREVISTO` | `previsto` | Lançamento futuro |
| _(sem equivalente)_ | `aguardando_aprovacao` | Controle interno do TEG+ |
| _(sem equivalente)_ | `aprovado` | Aprovado no TEG+, aguarda pagamento no Omie |

### Contas a Receber

| Status Omie (`cStatus`) | Status TEG+ (`status`) | Descrição |
|------------------------|------------------------|-----------|
| `ABERTO` | `pendente` | Aguardando recebimento |
| `VENCIDO` | `vencido` | Passou da data de vencimento |
| `RECEBIDO` | `recebido` | Baixado como recebido no Omie |
| `CANCELADO` | `cancelado` | Cancelado no Omie |
| `PREVISTO` | `previsto` | Lançamento futuro |

---

## Tabelas do Supabase Envolvidas

| Tabela | Descrição | Origem dos Dados |
|--------|-----------|-----------------|
| `sys_config` | Configurações do sistema (chaves Omie, URL n8n) | Manual / Frontend |
| `cmp_fornecedores` | Cadastro de fornecedores | Omie → TEG+ |
| `fin_contas_pagar` | Contas a pagar | Omie → TEG+ (bidirecional) |
| `fin_contas_receber` | Contas a receber | Omie → TEG+ |
| `fin_sync_log` | Log de execuções de sync | n8n (automático) |
| `fin_aprovacoes` | Registro de aprovações de pagamento | TEG+ (interno) |

---

## Configuração Passo a Passo

Veja o guia detalhado em [[Setup Integração Omie]].

**Resumo:**
1. Criar app no [Portal do Desenvolvedor Omie](https://developer.omie.com.br)
2. Inserir `omie_app_key` e `omie_app_secret` na tela de Configurações do TEG+
3. Importar workflows JSON no n8n
4. Configurar credencial Supabase no n8n
5. Ativar os workflows
6. Testar com o botão "Sincronizar"

---

## Troubleshooting

### Erro: "Credenciais Omie não encontradas"

**Causa:** As chaves `omie_app_key` ou `omie_app_secret` não estão na tabela `sys_config`.

**Solução:**
```sql
-- Verificar se as chaves existem
SELECT chave, valor FROM sys_config WHERE chave LIKE 'omie%';

-- Inserir se necessário
INSERT INTO sys_config (chave, valor) VALUES
  ('omie_app_key', 'sua-app-key'),
  ('omie_app_secret', 'seu-app-secret');
```

---

### Erro: "401 Unauthorized" na API do Omie

**Causa:** `app_key` ou `app_secret` inválidos ou app desativado no Omie.

**Solução:**
1. Acessar [developer.omie.com.br](https://developer.omie.com.br)
2. Verificar se o app está ativo
3. Regenerar as credenciais se necessário
4. Atualizar no `sys_config` do Supabase

---

### Erro: "Nenhum fornecedor retornado"

**Causa:** Filtro `filtrar_apenas_ativo: "S"` não encontrou fornecedores ativos, ou a empresa não tem fornecedores cadastrados.

**Solução:**
- Verificar no Omie se há fornecedores com status ativo
- Testar a chamada API diretamente via Postman/Insomnia
- Remover temporariamente o filtro de ativo para diagnóstico

---

### Sync não aparece no histórico (fin_sync_log vazio)

**Causa:** O workflow pode estar falhando antes do node de log, ou o workflow não está ativado.

**Solução:**
1. Verificar se o workflow está ativo no n8n
2. Verificar o histórico de execuções no n8n (Executions)
3. Checar logs de erro no n8n para a execução com falha

---

### Dados duplicados no Supabase

**Causa:** O header `Prefer: resolution=merge-duplicates` não está sendo enviado, fazendo inserção em vez de upsert.

**Solução:**
- Verificar o node "Upsert" no workflow n8n
- Garantir que o header `Prefer: resolution=merge-duplicates` está configurado
- Verificar que o parâmetro `onConflict=omie_id` está na URL do endpoint

---

## Páginas Relacionadas

- [[Setup Integração Omie]] - Guia de configuração passo a passo
- [[Arquitetura Agent Squads]] - Como os agentes de sincronização funcionam
- [[Índice Financeiro]] - Índice do módulo financeiro
- [[Workflows n8n]] - Documentação de todos os workflows

---

## Referências Externas

- [Documentação API Omie](https://developer.omie.com.br/service-list/)
- [Supabase REST API](https://supabase.com/docs/guides/api)
- [n8n HTTP Request Node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/)
