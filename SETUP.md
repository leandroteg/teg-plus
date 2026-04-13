# TEG+ ERP — Guia de Setup

## Arquitetura

```
[React SPA]  --->  [n8n Webhooks]  --->  [Supabase PostgreSQL]
 (Vercel)          (EasyPanel)            (Auth + RLS + Realtime)
     \                  |
      \                 v
       \----------->[AI Parse - Gemini Flash / Claude]
```

> Para documentacao detalhada da arquitetura, ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 1. Pre-requisitos

- **Node.js 20+** (recomendado: LTS)
- **Projeto Supabase** — criar em https://supabase.com
- **Instancia n8n** — self-hosted (EasyPanel, Docker, etc.)
- **Git** para controle de versao

## 2. Supabase

### 2.1 Criar projeto
1. Acessar https://supabase.com
2. Criar projeto "teg-plus"
3. Anotar: **Project URL**, **anon key**, **service_role key**

### 2.2 Executar migrations
No SQL Editor do Supabase, executar em ordem numerica os arquivos de `supabase/`:

```
001_schema_compras.sql       # Schema base de compras
002_seed_usuarios.sql        # Usuarios iniciais e obras
003_rpc_dashboard.sql        # RPCs do dashboard
004_schema_cotacoes.sql      # Cotacoes e fornecedores
...
017_frotas_manutencao.sql    # Frotas, veiculos, OS
...
025_rls_granular.sql         # Politicas RLS granulares
...
042_apr_tipo_aprovacao.sql   # Tipos de aprovacao (4 tipos)
043_cadastros_ai.sql         # Master data com AI
044_lotes_pagamento.sql      # Lotes de pagamento e aprovacao parcial
```

### 2.3 Verificar
- ~90 tabelas criadas (prefixos: fin_, est_, log_, fro_, ctr_, cad_, apr_, ctrl_)
- Views: vw_dashboard_requisicoes, vw_kpis_compras, etc.
- RPCs: get_dashboard_compras, rpc_resolver_lote_status, rpc_registrar_pagamento_batch, generate_numero_lote
- Realtime habilitado para tabelas principais
- Storage buckets: cotacoes-docs, contratos-docs

## 3. n8n

### 3.1 Credenciais
Em Settings > Credentials, configurar:
- **Supabase** — Host + Service Role Key
- **Gemini** — API key para parse de documentos
- **Evolution API** — WhatsApp (opcional)

### 3.2 Workflows
Importar os workflows de `n8n-workflows/`. Principais:
- `TEG+ | Compras - Nova Requisicao` (POST /compras/requisicao)
- `TEG+ | Compras - Processar Aprovacao` (POST /compras/aprovacao)
- `TEG+ | Compras - Cotacao` (POST /compras/cotacao)
- `TEG+ | Compras - Parse Cotacao AI` (POST /compras/parse-cotacao)
- `TEG+ | Consulta CNPJ` (POST /consulta-cnpj)
- `TEG+ | Consulta CEP` (POST /consulta-cep)
- `TEG+ | Painel - Dashboard` (GET /painel/compras)

### 3.3 Ativar
Em cada workflow: verificar nodes Supabase, selecionar credencial, salvar e ativar.

## 4. Frontend

### 4.1 Instalar
```bash
cd frontend
npm install
```

### 4.2 Configurar .env
```bash
cp .env.example .env.local
```

Preencher:
```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_N8N_WEBHOOK_URL=https://seu-n8n.com/webhook
```

> **Importante:** Chaves sensiveis (service_role, LLM keys) ficam **somente** no n8n.

### 4.3 Rodar
```bash
npm run dev
# Acessar http://localhost:5173
```

### 4.4 Build de producao
```bash
npm run build   # Output em dist/
npm run preview # Preview local do build
```

## 5. Deploy (Vercel)

1. Conectar repositorio GitHub ao Vercel
2. Configurar:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Adicionar variaveis de ambiente (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_N8N_WEBHOOK_URL)
4. Deploy automatico a cada push em `main`

O `vercel.json` ja configura SPA rewrites para React Router.

## 6. Modulos Disponiveis

| Modulo | Rota | Status |
|--------|------|--------|
| Compras | `/compras/*` | 95% operacional |
| Financeiro | `/financeiro/*` | 65% operacional |
| Estoque | `/estoque/*` | 60% operacional |
| Logistica | `/logistica/*` | 85% operacional |
| Frotas | `/frotas/*` | 80% operacional |
| Contratos | `/contratos/*` | 85% operacional |
| Cadastros | `/cadastros/*` | 100% operacional |
| Controladoria | `/controladoria/*` | 75% (controle orcamentario) |
| RH | `/rh/*` | 15% (headcount + cultura) |
| SSMA | `/ssma` | 0% (stub) |

## 7. Documentacao

A documentacao tecnica completa esta em `docs/obsidian/`. Para a melhor experiencia, abra como vault no [Obsidian](https://obsidian.md/) com plugins Dataview, Calendar, Kanban e Templater.

- [Arquitetura detalhada](docs/ARCHITECTURE.md)
- [Roadmap estrategico](ROADMAP_ERP_WORLD_CLASS.md)
- [Indice Obsidian](docs/obsidian/00%20-%20TEG+%20INDEX.md)

---

Ultima atualizacao: 2026-04-10
