---
title: Variáveis de Ambiente
type: configuração
status: ativo
tags: [env, configuração, secrets, supabase, n8n]
criado: 2026-03-02
relacionado: ["[[02 - Frontend Stack]]", "[[06 - Supabase]]", "[[10 - n8n Workflows]]", "[[15 - Deploy e GitHub]]"]
---

# Variáveis de Ambiente — TEG+ ERP

## Arquivo `.env.example`

```env
# =============================================
# TEG+ ERP — Variáveis de Ambiente
# =============================================

# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# n8n
VITE_N8N_WEBHOOK_URL=https://seu-n8n.com/webhook

# Web Push (VAPID)
VITE_VAPID_PUBLIC_KEY=BNxxxxxxxxxxxxxxxxxxxxxxx...
```

---

## Variáveis por Serviço

### Supabase

| Variável | Tipo | Onde encontrar |
|----------|------|----------------|
| `VITE_SUPABASE_URL` | URL | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | JWT | Supabase Dashboard → Settings → API → anon public |

**Exemplo:**
```env
VITE_SUPABASE_URL=https://abcdefghijklmn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.xxx
```

### n8n

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `VITE_N8N_WEBHOOK_URL` | URL base | URL base dos webhooks sem trailing slash |

### Web Push

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `VITE_VAPID_PUBLIC_KEY` | Chave pública | Chave VAPID para notificações push no browser |

**Exemplo:**
```env
VITE_N8N_WEBHOOK_URL=https://meu-n8n.railway.app/webhook
```

**Uso no código:**
```ts
// Rotas construídas automaticamente:
POST ${VITE_N8N_WEBHOOK_URL}/compras/requisicao
POST ${VITE_N8N_WEBHOOK_URL}/compras/aprovacao
POST ${VITE_N8N_WEBHOOK_URL}/compras/requisicao-ai
GET  ${VITE_N8N_WEBHOOK_URL}/painel/compras
```

---

## Chaves NÃO expostas no Frontend

As seguintes chaves são sensíveis e ficam **apenas no n8n**:

| Variável | Descrição | Onde configurar |
|----------|-----------|----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Chave admin do Supabase | n8n → Credentials → Supabase |
| `LLM_API_KEY` | Chave da API de AI | n8n → Credentials → HTTP Header |
| `EVOLUTION_API_KEY` | WhatsApp API key | n8n → Credentials |

> **Nunca** coloque `service_role_key` no frontend — ela bypassa o RLS!

---

## Setup Local

```bash
# 1. Copie o exemplo
cp frontend/.env.example frontend/.env.local

# 2. Edite com suas credenciais reais
nano frontend/.env.local

# 3. Inicie o dev server
cd frontend && npm run dev
```

**Arquivo `.env.local`** é ignorado pelo git (`.gitignore`).

---

## Setup Vercel (Produção)

1. Acesse: **Vercel Dashboard → Projeto → Settings → Environment Variables**
2. Adicione cada variável:

```
VITE_SUPABASE_URL      = [production value]
VITE_SUPABASE_ANON_KEY = [production value]
VITE_N8N_WEBHOOK_URL   = [production value]
```

3. Selecione os ambientes: `Production` ✅ `Preview` ✅ `Development` ✅
4. Redeploy para aplicar

---

## Validação no Código

O Vite expõe automaticamente variáveis com prefixo `VITE_`:

```ts
// src/services/supabase.ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase não configurado! Verifique o .env.local')
}
```

---

## Ambientes

| Ambiente | Arquivo | Quando usado |
|----------|---------|-------------|
| Local | `.env.local` | `npm run dev` |
| Preview | Vercel (PR) | Pull Requests |
| Produção | Vercel | Branch main |

---

## Links Relacionados

- [[06 - Supabase]] — Como o Supabase usa as credenciais
- [[10 - n8n Workflows]] — Como o n8n usa suas credenciais
- [[15 - Deploy e GitHub]] — Configuração no Vercel
- [[02 - Frontend Stack]] — Vite e import.meta.env
