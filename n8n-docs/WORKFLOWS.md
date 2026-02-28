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
