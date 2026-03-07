---
title: n8n Workflows
type: automação
status: ativo
tags: [n8n, automação, webhooks, workflows, integração]
criado: 2026-03-02
relacionado: ["[[01 - Arquitetura Geral]]", "[[11 - Fluxo Requisição]]", "[[12 - Fluxo Aprovação]]", "[[19 - Integração Omie]]", "[[20 - Módulo Financeiro]]"]
---

# n8n Workflows — TEG+ ERP

## Visão Geral

O n8n é o **hub de orquestração** do TEG+. Toda lógica de negócio complexa passa por aqui antes de chegar ao Supabase.

```mermaid
graph LR
    FE[Frontend] -->|Webhook calls| N8N[n8n Hub]
    N8N -->|service_role| DB[(Supabase)]
    N8N -->|LLM| AI[AI Parse]
    N8N -->|Futuro| WA[WhatsApp]
    N8N -->|Futuro| EMAIL[Email]
```

---

## Configuração

```env
# .env
VITE_N8N_WEBHOOK_URL=https://seu-n8n.com/webhook
```

**Credenciais no n8n:**
- Supabase: `service_role key` (bypass RLS)
- LLM API: configurado para AI parse

---

## Workflows Documentados

### 1. TEG+ | Nova Requisição
**Webhook:** `POST /compras/requisicao`
**ID n8n:** `8NjfiPcQHHZxSKUp`
**Nodes:** 9

```mermaid
flowchart LR
    W[Webhook\nPOST] --> V[Validate\nPayload]
    V --> GN[Gerar Número\nRC-YYYYMM-XXXX]
    GN --> SI[Save to\nSupabase]
    SI --> DA[Determinar\nAlçada]
    DA --> CA[Create\nAprovação]
    CA --> LOG[Log\nAtividade]
    LOG --> R[Respond\n201 Created]
```

**Payload de entrada:**
```json
{
  "solicitante_id": "uuid",
  "obra_id": "uuid",
  "categoria": "string",
  "urgencia": "normal|urgente|critica",
  "valor_estimado": 15000.00,
  "descricao": "Justificativa...",
  "itens": [
    {
      "descricao": "Cabo ACSR 250MCM",
      "quantidade": 500,
      "unidade": "M",
      "valor_unitario_estimado": 25.00
    }
  ]
}
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "requisicao": {
    "id": "uuid",
    "numero": "RC-202602-0042",
    "status": "em_aprovacao",
    "alcada_nivel": 2
  },
  "aprovacao": {
    "aprovador": "Gerente",
    "prazo_horas": 24,
    "token": "approval-token-uuid"
  }
}
```

---

### 2. TEG+ | Processar Aprovação
**Webhook:** `POST /compras/aprovacao`
**ID n8n:** `mdpXcMsQonwnQuT6`
**Nodes:** 16

```mermaid
flowchart TD
    W[Webhook\nPOST token] --> FT[Find Aprovacao\nby Token]
    FT --> VT{Token\nVálido?}
    VT -->|Não| E[Error 404]
    VT -->|Sim| VE{Expirado?}
    VE -->|Sim| EX[Mark Expirado\n→ Error]
    VE -->|Não| UD[Update Status\naprovada/rejeitada]
    UD --> REJ{Rejeitada?}
    REJ -->|Sim| CR[Cancel\nRequisição\n→ Fim]
    REJ -->|Não| NL{Próximo\nNível?}
    NL -->|Sim| NA[Create Next\nAprovação\n→ Notificar]
    NL -->|Não| FA[Finalizar\nRequisição\n→ Aprovada]
    FA --> LOG[Log Atividade]
    LOG --> R[Respond 200]
```

**Payload de entrada:**
```json
{
  "token": "approval-token-uuid",
  "decisao": "aprovada|rejeitada",
  "observacao": "Aprovado conforme orçamento."
}
```

---

### 3. TEG+ | Dashboard API
**Webhook:** `GET /painel/compras`
**ID n8n:** `fb6kSj7ZSxPU2TjO`
**Nodes:** 6

**Query params aceitos:**
```
?status=pendente
?obra_id=uuid
?periodo=30d           (7d | 30d | 90d)
?page=1
?limit=20
```

**Resposta:**
```json
{
  "kpis": {
    "total": 142,
    "pendentes": 23,
    "aprovadas": 89,
    "em_cotacao": 15,
    "valor_total": 1850000.00,
    "valor_aprovado": 1200000.00
  },
  "por_status": [
    { "status": "pendente", "count": 23, "percentual": 16.2 }
  ],
  "por_obra": [
    { "obra": "SE Frutal", "count": 34, "valor": 420000.00 }
  ],
  "recentes": [...]
}
```

---

### 4. TEG+ | AI Parse Requisição
**Webhook:** `POST /compras/requisicao-ai`
**ID n8n:** (configurado)

```mermaid
flowchart LR
    W[Webhook\nPOST texto] --> LLM[LLM / Claude\nExtrai entidades]
    LLM --> MAP[Mapear\nCategorias + Obras]
    MAP --> CONF[Calcular\nConfiança]
    CONF --> R[Respond\nItens estruturados]
```

**Payload de entrada:**
```json
{
  "texto": "Preciso de 10 capacetes amarelos e 5 pares de luvas de raspa para obra de Frutal urgente",
  "solicitante_nome": "João Silva"
}
```

**Resposta:**
```json
{
  "itens": [
    {
      "descricao": "Capacete de segurança amarelo",
      "quantidade": 10,
      "unidade": "UN",
      "categoria_sugerida": "EPI/EPC"
    },
    {
      "descricao": "Luvas de raspa",
      "quantidade": 5,
      "unidade": "PAR",
      "categoria_sugerida": "EPI/EPC"
    }
  ],
  "obra_sugerida": "SE Frutal",
  "categoria_sugerida": "EPI/EPC",
  "comprador_sugerido": "Lauany",
  "urgencia_detectada": "urgente",
  "confianca": 0.92,
  "observacoes": "Obra identificada por menção direta. Urgência detectada."
}
```

---

### 4b. TEG+ | AI Parse Cotação
**Webhook:** `POST /compras/parse-cotacao`
**ID n8n:** `P5xDZQJ2Hh6mVXO0`
**Nodes:** 5 (Webhook → Gemini Flash → Respond + Error Handler)
**Status:** Ativo

```mermaid
flowchart LR
    W[Webhook\nPOST file_base64] --> G[Gemini 2.5 Flash\nMultimodal]
    G -->|Sucesso| R[Respond\nFornecedores JSON]
    G -->|Erro| E[Error Handler] --> RE[Respond Erro]
```

**Payload de entrada:**
```json
{
  "file_base64": "base64-encoded-file",
  "file_name": "cotacao-fornecedor.pdf",
  "mime_type": "application/pdf"
}
```

**Formatos aceitos:** JPG, PNG, WebP, PDF (até 10 MB)

**Resposta de sucesso:**
```json
{
  "success": true,
  "fornecedores": [
    {
      "fornecedor_nome": "Eletro Sul Materiais LTDA",
      "fornecedor_cnpj": "12.345.678/0001-99",
      "fornecedor_contato": "(34) 99999-1234",
      "valor_total": 15750.00,
      "prazo_entrega_dias": 15,
      "condicao_pagamento": "30/60 dias",
      "itens": [
        {"descricao": "Cabo XLPE 240mm", "qtd": 500, "valor_unitario": 25.50, "valor_total": 12750.00},
        {"descricao": "Terminal compressão", "qtd": 20, "valor_unitario": 150.00, "valor_total": 3000.00}
      ],
      "observacao": "Frete incluso"
    }
  ]
}
```

**Componente frontend:** `UploadCotacao.tsx` — Drag & drop com auto-preenchimento via IA.

---

## Fallback Strategy

Se o n8n estiver **indisponível**:

```ts
// src/services/api.ts
async criarRequisicao(payload) {
  try {
    // Tenta n8n primeiro
    return await fetch(`${N8N_URL}/compras/requisicao`, ...)
  } catch (e) {
    // Fallback: insert direto no Supabase
    console.warn('n8n indisponível, usando Supabase direto')
    return await supabase.from('requisicoes').insert(payload)
  }
}
```

---

---

## Squads Omie ERP (Módulo Financeiro)

Quatro workflows dedicados à integração com o Omie ERP. Detalhes completos em [[19 - Integração Omie]].

### 5. TEG+ | Omie — Sync Fornecedores
**Arquivo:** `n8n-docs/workflow-omie-sync-fornecedores.json`
**Webhook:** `POST /omie/sync/fornecedores`

```mermaid
flowchart LR
    W[Webhook] --> CF[get_omie_config\nRPC] --> OL[Omie API\nListarFornecedores] --> UP[Upsert\ncmp_fornecedores] --> LOG[fin_sync_log]
```

---

### 6. TEG+ | Omie — Sync Contas a Pagar
**Arquivo:** `n8n-docs/workflow-omie-sync-cp.json`
**Webhook:** `POST /omie/sync/contas-pagar`
**Trigger:** Schedule 6h + Manual

```mermaid
flowchart LR
    W[Schedule\nou Webhook] --> CF[get_omie_config] --> OL[Omie API\nListarContasPagar] --> UP[Upsert\nfin_contas_pagar] --> LOG[fin_sync_log]
```

---

### 7. TEG+ | Omie — Sync Contas a Receber
**Arquivo:** `n8n-docs/workflow-omie-sync-cr.json`
**Webhook:** `POST /omie/sync/contas-receber`
**Trigger:** Schedule 6h + Manual

Mesmo padrão do Squad 6, aplicado a `fin_contas_receber`.

---

### 8. TEG+ | Omie — Aprovar Pagamento
**Arquivo:** `n8n-docs/workflow-omie-aprovacao-pgto.json`
**Webhook:** `POST /omie/aprovar-pagamento`

```mermaid
flowchart LR
    W[Webhook\ncp_id] --> CF[get_omie_config] --> OA[Omie API\nAlterarStatusCP] --> UP[omie_sincronizado=true] --> LOG[fin_sync_log]
```

---

### 9. TEG+ | Consulta CNPJ
**Webhook:** `POST /consulta-cnpj`
**ID n8n:** `6rfMdHdRdJefrKB3`
**Nodes:** 10
**Criado:** 2026-03-06
**Status:** Ativo

```mermaid
flowchart LR
    W[Webhook\nPOST] --> EX[Extrair CNPJ\n14 dígitos]
    EX --> V{Válido?}
    V -->|Não| ERR[Respond 400\nErro]
    V -->|Sim| CC[Verificar Cache\nCode node]
    CC --> TC{Cache hit?}
    TC -->|Sim| RC[Respond\nCache]
    TC -->|Não| BA[BrasilAPI\nGET /cnpj/v1]
    BA --> TS[Transformar\n+ Salvar Cache]
    TS --> RA[Respond\nDados CNPJ]
```

**Payload:** `{ "valor": "59460450000100" }`

**Resposta:**
```json
{
  "cnpj": "59460450000100",
  "razao_social": "EMPRESA LTDA",
  "nome_fantasia": "EMPRESA",
  "situacao": "ATIVA",
  "endereco": { "cep": "...", "logradouro": "...", "numero": "...", "bairro": "...", "cidade": "...", "uf": "..." },
  "telefone": "1199999999",
  "email": "contato@empresa.com"
}
```

**Notas técnicas:**
- "Verificar Cache" é Code node (NÃO HTTP Request) — sempre retorna dados, evita pipeline parar
- Cache salvo via fire-and-forget (não bloqueia resposta)
- Cache: tabela `cache_consultas` no Supabase, TTL 7 dias
- Frontend fallback: se n8n falhar, consulta BrasilAPI direto

---

### 10. TEG+ | Consulta CEP
**Webhook:** `POST /consulta-cep`
**ID n8n:** `iZGk3HiN35xGxe7K`
**Nodes:** 12 (precisa mesma fix do cache do CNPJ)
**Criado:** 2026-03-06
**Status:** Ativo (com bug no cache — HTTP Request retorna 0 items)

Mesmo padrão do Consulta CNPJ. Payload: `{ "valor": "01001000" }`.
**TODO:** Aplicar mesma fix do CNPJ (trocar HTTP Request cache por Code node).

---

## Configuração EasyPanel

| Variável | Valor |
|----------|-------|
| `WEBHOOK_URL` | `https://teg-agents-n8n.nmmcas.easypanel.host` |
| Domínio | `https://teg-agents-n8n.nmmcas.easypanel.host/` → `http://teg-agents_n8n:5678/` |

**IMPORTANTE:** Updates via API (REST ou MCP) só alteram o DRAFT do workflow. Para ativar webhooks de produção, é obrigatório **Publicar via UI do editor n8n**.

---

## Workflows Futuros

| Workflow | Trigger | Função |
|----------|---------|--------|
| WhatsApp Notificações | Nova aprovação | Envia link WhatsApp via Evolution API |
| Email Aprovação | Nova aprovação | Email Outlook com link de aprovação |
| AI TEG+ Agent | Mensagem WhatsApp | Responde dúvidas e cria requisições |

---

## Links Relacionados

- [[01 - Arquitetura Geral]] — Posição do n8n na arquitetura
- [[11 - Fluxo Requisição]] — Fluxo detalhado de criação
- [[12 - Fluxo Aprovação]] — Fluxo detalhado de aprovação
- [[19 - Integração Omie]] — Squads Omie detalhados
- [[05 - Hooks Customizados]] — Como o frontend chama os webhooks
- [[17 - Roadmap]] — Integrações futuras planejadas
