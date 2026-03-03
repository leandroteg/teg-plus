# TEG+ | Workflows n8n - Documentacao

## Workflows Criados

### 1. TEG+ | Compras - Nova Requisicao
- **ID:** 8NjfiPcQHHZxSKUp
- **Webhook:** POST `/compras/requisicao`
- **Nodes:** 9
- **Fluxo:** Webhook -> Validar -> Salvar Requisicao -> Preparar Aprovacao -> Criar Aprovacao -> Log -> Responder

**Payload esperado:**
```json
{
  "solicitante_nome": "Joao Silva",
  "solicitante_id": "uuid-opcional",
  "obra_nome": "SE Frutal",
  "obra_id": "uuid-opcional",
  "centro_custo": "CC-001",
  "descricao": "Cabos eletricos para SE Frutal",
  "justificativa": "Material necessario para fase 2",
  "categoria": "material",
  "urgencia": "normal",
  "data_necessidade": "2026-03-15",
  "itens": [
    {
      "descricao": "Cabo XLPE 15kV 50mm2",
      "quantidade": 500,
      "unidade": "m",
      "valor_unitario_estimado": 45.50
    },
    {
      "descricao": "Terminal de compressao 50mm2",
      "quantidade": 20,
      "unidade": "un",
      "valor_unitario_estimado": 85.00
    }
  ]
}
```

**Alcadas automaticas por valor:**
| Nivel | Cargo | Faixa de Valor |
|-------|-------|----------------|
| 1 | Coordenador | Ate R$ 5.000 |
| 2 | Gerente | R$ 5.001 - R$ 25.000 |
| 3 | Diretor | R$ 25.001 - R$ 100.000 |
| 4 | CEO | Acima de R$ 100.000 |

---

### 2. TEG+ | Compras - Processar Aprovacao
- **ID:** mdpXcMsQonwnQuT6
- **Webhook:** POST `/compras/aprovacao`
- **Nodes:** 16
- **Fluxo:** Webhook -> Buscar Aprovacao -> Validar -> Atualizar -> Switch Decisao -> [Aprovada: verificar proximo nivel / Rejeitada: atualizar req] -> Log -> Responder

**Payload esperado:**
```json
{
  "token": "apr-1234567890-abc123def",
  "decisao": "aprovada",
  "observacao": "Aprovado conforme orcamento"
}
```

**Logica multi-nivel:**
- Se valor requer nivel 3 (Diretor), passa por: Coordenador -> Gerente -> Diretor
- Cada nivel aprova sequencialmente
- Rejeicao em qualquer nivel cancela a requisicao

---

### 3. TEG+ | Painel - API Dashboard Compras
- **ID:** fb6kSj7ZSxPU2TjO
- **Webhook:** GET `/painel/compras`
- **Nodes:** 8
- **Fluxo:** Webhook -> Parsear Filtros -> [Buscar KPIs + Por Status + Por Obra + Recentes] -> Montar Dashboard -> Responder

**Query params:**
- `?status=em_aprovacao` - filtrar por status
- `?obra_id=uuid` - filtrar por obra
- `?periodo=mes` - mes, semana, trimestre, ano
- `?page=1&limit=20` - paginacao

---

### 4. TEG+ | Compras - AI Parse Requisicao
- **ID:** (importar de `workflow-ai-parse-requisicao.json`)
- **Webhook:** POST `/compras/requisicao-ai`
- **Nodes:** 3
- **Fluxo:** AI Parse Webhook -> Parse com IA -> Responder

**Payload esperado:**
```json
{
  "texto": "Preciso de 500m de cabo XLPE 15kV e 20 terminais para SE Frutal urgente",
  "solicitante_nome": "Joao Silva"
}
```

**Resposta:**
```json
{
  "itens": [
    { "descricao": "cabo XLPE 15kV", "quantidade": 500, "unidade": "m", "valor_unitario_estimado": 0 },
    { "descricao": "terminais", "quantidade": 20, "unidade": "un", "valor_unitario_estimado": 0 }
  ],
  "obra_sugerida": "SE Frutal",
  "urgencia_sugerida": "urgente",
  "categoria_sugerida": "eletrico",
  "comprador_sugerido": { "id": "comp-1", "nome": "Marcos Almeida" },
  "justificativa_sugerida": "Requisicao criada via IA - eletrico",
  "confianca": 0.85
}
```

**Categorias detectadas:** eletrico, epi, civil, ferramentas, servicos, consumo
**Obras detectadas:** SE Frutal, SE Paracatu, SE Perdizes, SE Tres Marias, SE Rio Paranaiba, SE Ituiutaba

---

### 5. TEG+ | Suprimentos - AI Agent (pre-existente)
- **ID:** 6Dh8b6VOP09GpH0x
- **Nodes:** 6

### 6. TEG+ | Suprimentos - Notificacoes de Status (pre-existente)
- **ID:** UYgLUU9v7cfMJN8k
- **Nodes:** 6

---

## Configuracao Necessaria

### Credenciais Supabase no n8n
1. Ir em Settings > Credentials > Add Credential
2. Selecionar "Supabase"
3. Preencher:
   - **Host:** sua-url.supabase.co
   - **Service Role Key:** (copiar do Supabase Dashboard > Settings > API)

### Ativar Workflows
Apos configurar credenciais:
1. Abrir cada workflow
2. Configurar nodes Supabase com a credencial
3. Ativar o workflow (toggle)
4. Testar com o webhook URL

### URLs dos Webhooks (apos ativar)
- **Producao:** `https://seu-n8n.com/webhook/compras/requisicao`
- **Producao (AI Parse):** `https://seu-n8n.com/webhook/compras/requisicao-ai`
- **Teste:** `https://seu-n8n.com/webhook-test/compras/requisicao`
- **Teste (AI Parse):** `https://seu-n8n.com/webhook-test/compras/requisicao-ai`

---

## Modulo Financeiro - Omie

Workflows de integracao com o Omie ERP para sincronizacao de dados financeiros.
Todos os workflows deste modulo leem as credenciais Omie do `sys_config` no Supabase
e registram cada execucao no `fin_sync_log`.

**Documentacao detalhada:** ver pasta `n8n-docs/obsidian/`

---

### 7. TEG+ | Omie - Sync Fornecedores
- **Arquivo:** `workflow-omie-sync-fornecedores.json`
- **Webhook:** POST `/omie/sync/fornecedores`
- **Nodes:** 9
- **Fluxo:** Trigger -> Get Omie Credentials -> Extract Credentials -> Omie ListarFornecedores -> Mapear Fornecedores -> Upsert Supabase (cmp_fornecedores) -> Preparar Sync Log -> Inserir fin_sync_log -> Responder Sucesso

**Payload:** Nenhum body necessario (disparado sem parametros)

**Resposta:**
```json
{
  "success": true,
  "message": "Sync de fornecedores concluido",
  "registros": 42
}
```

**Mapeamento de campos:**
| Campo Omie | Campo Supabase |
|------------|----------------|
| `nCodFornecedor` | `omie_id` (text) |
| `cRazaoSocial` | `razao_social` |
| `cNomeFantasia` | `nome_fantasia` |
| `cnpj_cpf` | `cnpj` (so digitos) |
| `cEmail` | `email` |
| `telefone1_numero` | `telefone` |

**Upsert key:** `omie_id` (onConflict=omie_id + Prefer: resolution=merge-duplicates)

**Credenciais necessarias no n8n:**
- Supabase Service Role Key (via credential "TEG+ Supabase")
- Variaveis: `$vars.supabase_url`, `$vars.supabase_service_role_key`

---

### 8. TEG+ | Omie - Sync Contas a Pagar
- **Arquivo:** `workflow-omie-sync-contas-pagar.json` _(a criar)_
- **Webhook:** POST `/omie/sync/contas-pagar`
- **Nodes:** ~10
- **Fluxo:** Trigger -> Get Omie Credentials -> Omie ListarContasPagar -> Mapear Contas -> Preservar Status Aprovado -> Upsert Supabase (fin_contas_pagar) -> Log -> Responder

**Payload:** Nenhum body necessario (pode receber filtros opcionais)

**Payload opcional:**
```json
{
  "pagina": 1,
  "registros_por_pagina": 500,
  "filtrar_status": "ABERTO"
}
```

**Mapeamento de campos:**
| Campo Omie | Campo Supabase |
|------------|----------------|
| `nCodCP` | `omie_cp_id` |
| `cFornecedor` | `fornecedor_nome` |
| `nCodFornecedor` | `fornecedor_omie_id` |
| `nValorDocumento` | `valor_original` |
| `nValorPago` | `valor_pago` |
| `nValorAberto` | `valor_aberto` |
| `dDataVencimento` | `data_vencimento` (parse DD/MM/AAAA) |
| `dDataEmissao` | `data_emissao` |
| `dDataPagamento` | `data_pagamento` |
| `cNumeroDocumento` | `numero_documento` |
| `cStatus` | `status_omie` + `status` (mapeado) |

**Mapeamento de status:**
| Status Omie | Status TEG+ |
|-------------|-------------|
| `ABERTO` | `pendente` |
| `VENCIDO` | `vencido` |
| `PAGO` | `pago` |
| `CANCELADO` | `cancelado` |

**Regra especial:** se `status` atual for `aprovado` ou `aguardando_aprovacao`, o sync nao sobrescreve.

**Upsert key:** `omie_cp_id`

---

### 9. TEG+ | Omie - Sync Contas a Receber
- **Arquivo:** `workflow-omie-sync-contas-receber.json` _(a criar)_
- **Webhook:** POST `/omie/sync/contas-receber`
- **Nodes:** ~9
- **Fluxo:** Trigger -> Get Omie Credentials -> Omie ListarContasReceber -> Mapear Contas -> Upsert Supabase (fin_contas_receber) -> Log -> Responder

**Payload:** Nenhum body necessario

**Mapeamento de campos:**
| Campo Omie | Campo Supabase |
|------------|----------------|
| `nCodCR` | `omie_cr_id` |
| `cCliente` | `cliente_nome` |
| `nCodCliente` | `cliente_omie_id` |
| `nValorDocumento` | `valor_original` |
| `nValorRecebido` | `valor_recebido` |
| `nValorAberto` | `valor_aberto` |
| `dDataVencimento` | `data_vencimento` |
| `dDataRecebimento` | `data_recebimento` |
| `cStatus` | `status_omie` + `status` (mapeado) |

**Mapeamento de status:**
| Status Omie | Status TEG+ |
|-------------|-------------|
| `ABERTO` | `pendente` |
| `VENCIDO` | `vencido` |
| `RECEBIDO` | `recebido` |
| `CANCELADO` | `cancelado` |

**Upsert key:** `omie_cr_id`

---

### 10. TEG+ | Omie - Aprovar Pagamento
- **Arquivo:** `workflow-omie-aprovar-pagamento.json` _(a criar)_
- **Webhook:** POST `/omie/aprovar-pagamento`
- **Nodes:** ~11
- **Fluxo:** Trigger -> Buscar Conta Supabase -> Validar Status -> Get Omie Credentials -> Omie AlterarContaPagar -> Atualizar Supabase (status=aprovado) -> Inserir fin_aprovacoes -> Log -> Responder

**Payload esperado:**
```json
{
  "conta_id": "uuid-da-conta-no-supabase",
  "aprovado_por": "uuid-do-usuario",
  "observacao": "Aprovado conforme alçada financeira"
}
```

**Resposta (sucesso):**
```json
{
  "success": true,
  "message": "Pagamento aprovado com sucesso",
  "conta_id": "uuid-da-conta-no-supabase",
  "omie_cp_id": "123456",
  "aprovado_em": "2026-03-03T14:30:00.000Z"
}
```

**Resposta (erro - status invalido):**
```json
{
  "success": false,
  "error": "Conta nao esta em status aprovavel",
  "status_atual": "pago"
}
```

**Logica de validacao:**
- Conta deve ter status `pendente` ou `aguardando_aprovacao`
- Contas ja `aprovado`, `pago` ou `cancelado` sao rejeitadas
- Falha na chamada Omie nao atualiza o Supabase (consistencia)

**Tabelas afetadas:**
- `fin_contas_pagar` - UPDATE status → `aprovado`, preenche `aprovado_por` e `aprovado_em`
- `fin_aprovacoes` - INSERT com registro da aprovacao
- `fin_sync_log` - INSERT com log da execucao

---

### Configuracao dos Workflows Omie

**Variaveis necessarias no n8n (Settings > Variables):**
| Variavel | Valor |
|----------|-------|
| `supabase_url` | URL base do projeto Supabase |
| `supabase_service_role_key` | Service Role Key do Supabase |

**Credenciais Omie:** armazenadas no Supabase (`sys_config`), nao no n8n.
Os workflows buscam `omie_app_key` e `omie_app_secret` dinamicamente a cada execucao.

**URLs dos Webhooks Omie (apos ativar):**
- **Sync Fornecedores:** `https://seu-n8n.com/webhook/omie/sync/fornecedores`
- **Sync Contas a Pagar:** `https://seu-n8n.com/webhook/omie/sync/contas-pagar`
- **Sync Contas a Receber:** `https://seu-n8n.com/webhook/omie/sync/contas-receber`
- **Aprovar Pagamento:** `https://seu-n8n.com/webhook/omie/aprovar-pagamento`

**Agendamento recomendado (Cron):**
- Fornecedores: `0 2 * * *` (diario, 02:00)
- Contas a Pagar: `0 */4 * * *` (a cada 4 horas)
- Contas a Receber: `0 6 * * *` (diario, 06:00)
- Aprovacao: on-demand (sem agendamento)
