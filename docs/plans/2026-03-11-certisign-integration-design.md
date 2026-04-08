# Design: Integração Certisign — Assinatura Digital de Contratos

**Issue:** #76
**Data:** 2026-03-11
**Status:** Aprovado

## Contexto

O módulo Contratos possui um fluxo de solicitação com etapa `enviar_assinatura`, mas atualmente o CertisignModal apenas avança a etapa manualmente sem integração real. Esta design implementa a integração completa com o Portal de Assinaturas da Certisign via n8n.

## Decisões

- **Abordagem**: n8n como hub de assinatura (padrão arquitetural do projeto)
- **Signatários**: Configurável por contrato (usuário define emails ao enviar)
- **Tipo assinatura**: Ambos — eletrônica (sem certificado) e digital ICP-Brasil (escolha no envio)
- **Credenciais**: Configuradas diretamente no n8n (HTTP Header Auth)

## Arquitetura

```
Frontend (CertisignModal)
    │
    ▼ POST /webhook/certisign-enviar
n8n Workflow "Certisign - Enviar Assinatura"
    │
    ├─ Download PDF minuta
    ├─ Upload documento → Certisign API
    ├─ Criar envelope com signatários
    ├─ INSERT con_assinaturas no Supabase
    └─ UPDATE solicitação assinatura_status = 'enviado'

Certisign (callback quando status muda)
    │
    ▼ POST /webhook/certisign-callback
n8n Workflow "Certisign - Callback"
    │
    ├─ Identificar envelope → buscar con_assinaturas
    ├─ Atualizar signatário no JSONB
    ├─ Download documento assinado (se completo)
    └─ Avançar solicitação → etapa 'arquivar'
```

## Banco de Dados

### Nova tabela: `con_assinaturas`

```sql
CREATE TABLE con_assinaturas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id             UUID REFERENCES con_contratos(id),
  solicitacao_id          UUID REFERENCES con_solicitacoes(id),
  minuta_id               UUID REFERENCES con_minutas(id),
  provedor                TEXT NOT NULL DEFAULT 'certisign'
                          CHECK (provedor IN ('certisign','manual')),
  tipo_assinatura         TEXT NOT NULL DEFAULT 'eletronica'
                          CHECK (tipo_assinatura IN ('eletronica','digital_icp')),
  documento_externo_id    TEXT,
  envelope_id             TEXT,
  status                  TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','enviado','parcialmente_assinado',
                                            'assinado','recusado','expirado','cancelado')),
  signatarios             JSONB NOT NULL DEFAULT '[]',
  enviado_em              TIMESTAMPTZ,
  concluido_em            TIMESTAMPTZ,
  expira_em               TIMESTAMPTZ,
  documento_assinado_url  TEXT,
  certificado_url         TEXT,
  webhook_log             JSONB DEFAULT '[]',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE con_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "con_assinaturas_all" ON con_assinaturas
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON con_assinaturas
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Index
CREATE INDEX idx_con_assinaturas_solicitacao ON con_assinaturas(solicitacao_id);
CREATE INDEX idx_con_assinaturas_envelope ON con_assinaturas(envelope_id);
```

### Formato JSONB `signatarios`

```json
[
  {
    "nome": "João Silva",
    "email": "joao@empresa.com",
    "cpf": "123.456.789-00",
    "papel": "contratante",
    "ordem": 1,
    "status": "pendente",
    "assinado_em": null,
    "link_assinatura": null
  }
]
```

## n8n Workflows

### Workflow 1: "Certisign - Enviar Assinatura"

**Trigger:** Webhook POST `/certisign-enviar`

**Input:**
```json
{
  "solicitacao_id": "uuid",
  "minuta_url": "https://...",
  "tipo_assinatura": "eletronica | digital_icp",
  "signatarios": [
    { "nome": "...", "email": "...", "cpf": "...", "papel": "contratante" }
  ],
  "callback_url": "https://teg-agents-n8n.../webhook/certisign-callback"
}
```

**Steps:**
1. HTTP Request — Download PDF da minuta_url
2. HTTP Request — POST Certisign API upload documento
3. HTTP Request — POST Certisign API criar envelope com signatários + callback_url
4. Supabase — INSERT con_assinaturas (status: 'enviado')
5. Supabase — UPDATE con_solicitacoes SET assinatura_status = 'enviado'
6. Respond to Webhook — 200 `{ assinatura_id, envelope_id, status: 'enviado' }`

**Error handling:** Se Certisign API falha, gravar con_assinaturas com status 'pendente' e retornar erro ao frontend.

### Workflow 2: "Certisign - Callback"

**Trigger:** Webhook POST `/certisign-callback`

**Input:** Payload do Certisign (evento de assinatura)

**Steps:**
1. Switch — tipo de evento (assinado, recusado, expirado)
2. Supabase — SELECT con_assinaturas WHERE envelope_id = payload.envelope_id
3. Code — atualizar signatário específico no JSONB
4. Supabase — UPDATE con_assinaturas (status, signatarios, webhook_log append)
5. IF todos assinaram:
   - HTTP Request — GET Certisign API download documento assinado
   - Supabase Storage — upload PDF assinado
   - Supabase — UPDATE con_assinaturas.documento_assinado_url
   - Supabase — UPDATE con_solicitacoes etapa → 'arquivar'
6. Respond 200

## Frontend

### CertisignModal (atualizar)

**Arquivo:** `frontend/src/pages/contratos/SolicitacaoDetalhe.tsx`

Substituir o modal placeholder por formulário real:
- Lista de signatários com campos: nome, email, CPF, papel
- Botão + para adicionar signatário
- Select tipo assinatura: Eletrônica / Digital ICP-Brasil
- Botão "Enviar para Assinatura" → POST webhook n8n
- Loading state durante envio
- Toast sucesso/erro

### Hook `useEnviarAssinatura`

**Arquivo:** `frontend/src/hooks/useSolicitacoes.ts`

```typescript
export function useEnviarAssinatura() {
  // POST /webhook/certisign-enviar
  // Invalida queries ['con_assinaturas'], ['solicitacoes-contrato']
}
```

### Hook `useAssinaturas`

**Arquivo:** `frontend/src/hooks/useContratos.ts`

```typescript
export function useAssinaturas(solicitacao_id?: string) {
  // SELECT * FROM con_assinaturas WHERE solicitacao_id = ...
}
```

### Tela Assinaturas (atualizar)

**Arquivo:** `frontend/src/pages/contratos/Assinaturas.tsx`

Consumir `con_assinaturas` em vez de inferir status:
- Status real do Certisign por envelope
- Badge por signatário (quem já assinou)
- Botão reenviar se expirado/recusado
- Link para documento assinado quando completo

## Certisign API (endpoints esperados)

Base URL: `https://api.portaldeassinaturas.com.br` (configurar no n8n)

| Ação | Método | Endpoint |
|------|--------|----------|
| Upload documento | POST | /documents |
| Criar envelope | POST | /envelopes |
| Status envelope | GET | /envelopes/{id} |
| Download assinado | GET | /documents/{id}/signed |

Auth: Header `Authorization: Bearer {token}` (credencial no n8n)

> Nota: Endpoints exatos a confirmar com documentação Certisign após login no portal do desenvolvedor. O workflow n8n será parametrizado para ajustar facilmente.


## Links
- [[obsidian/27 - Módulo Contratos Gestão]]
