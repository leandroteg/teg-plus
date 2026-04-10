# Arquitetura TEG+ ERP

## Visao Geral

TEG+ e um ERP modular de 4 camadas, projetado para gestao de obras de engenharia eletrica/transmissao.

```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 1 — Sistemas Terceiros (best-in-class)              │
│  Omie ERP · Monday.com · RDO App · Evolution API (WhatsApp) │
└──────────────────────────┬──────────────────────────────────┘
                           │ APIs / Webhooks
┌──────────────────────────┴──────────────────────────────────┐
│  CAMADA 2 — Coracao TEG+ (desenvolvimento proprio)          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Frontend     │  │  n8n         │  │  Supabase        │  │
│  │  React 18     │  │  Orquestrador│  │  PostgreSQL 15   │  │
│  │  Vite + TS    │──│  Webhooks    │──│  Auth + RLS      │  │
│  │  Tailwind     │  │  Automacoes  │  │  Realtime        │  │
│  │  TanStack Q.  │  │  Notificacoes│  │  Storage         │  │
│  │  Vercel       │  │  EasyPanel   │  │  RPCs + Views    │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│  CAMADA 3 — AI TEG+                                          │
│  Gemini Flash (parse docs) · Claude (agente) · BrasilAPI     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│  CAMADA 4 — 10 Areas Funcionais                              │
│  Diretoria · EGP · Obras · Suprimentos · SSMA · RH          │
│  Financeiro · Controladoria · Contratos · TI                 │
└─────────────────────────────────────────────────────────────┘
```

## Stack Tecnologico

### Frontend
- **React 18.3** com React Router 6 (SPA)
- **TypeScript** (strict: false, migrando gradualmente)
- **Tailwind CSS** com tema dark/light customizado
- **TanStack Query 5** para cache, mutations, invalidacao automatica
- **Lucide React** para icones
- **Supabase JS Client** para acesso direto ao banco (queries simples)
- **Vite** como bundler (build < 30s)

### Backend (Supabase)
- **PostgreSQL 15** com ~90 tabelas, 44+ migrations
- **Row Level Security (RLS)** — authenticated read, service_role write
- **Auth** — email/password + magic link, perfis em `usuarios`
- **Realtime** — subscriptions para invalidar cache no frontend
- **Storage** — buckets para cotacoes, contratos, documentos
- **RPCs** — funcoes SECURITY DEFINER para operacoes atomicas
- **Views** — dashboards, KPIs, agregacoes

### Automacao (n8n)
- **Self-hosted** em EasyPanel (Docker)
- **17+ workflows** ativos: requisicoes, aprovacoes, cotacoes, pagamentos, notificacoes
- **Webhooks** como API intermediaria entre frontend e servicos externos
- **Credenciais**: Supabase service_role, LLM keys, Evolution API

### Deploy
- **Vercel** — build automatico via push em `main`
- **vercel.json**: SPA rewrites, `frontend/dist` como output
- **Branches**: `main` (producao), `claude/*` (desenvolvimento)

## Principios Arquiteturais

1. **n8n como hub de logica de negocio** — workflows orquestram fluxos complexos (aprovacoes, notificacoes, integracao Omie)
2. **Fallback direto ao Supabase** — se n8n indisponivel, frontend opera via cliente Supabase
3. **RLS por padrao** — toda tabela tem RLS habilitado; anon key no frontend, service_role so no n8n
4. **Cache agressivo** — TanStack Query com staleTime, refetchInterval, invalidacao por mutation
5. **Token-based approvals** — aprovadores externos acessam via link com token UUID, sem login

## Fluxo de Dados

### Requisicao de Compra (exemplo)
```
Solicitante (React)
  |  POST /compras/requisicao
  v
n8n Webhook
  |  Valida, calcula alcada, insere em Supabase
  v
Supabase (requisicoes, aprovacoes)
  |  Realtime trigger
  v
AprovAi (React) — aprovador ve pendencia
  |  Token-based ou in-app
  v
n8n processa decisao
  |  Multi-nivel: se aprovado, proximo nivel ou finaliza
  v
Supabase atualiza status → Frontend invalida cache
```

### Upload Inteligente (Cotacao)
```
Usuario arrasta PDF/imagem
  |  Base64
  v
n8n /compras/parse-cotacao
  |  Gemini Flash Vision
  v
Retorna dados extraidos (fornecedores, precos, prazos)
  |
  v
Frontend preenche formulario + salva arquivo no Storage
```

## Modulos e Dependencias

```
Compras ──────────> Financeiro (CP automatico)
   |                    |
   v                    v
Estoque             Controladoria (DRE, orcado vs realizado)
   |                    ^
   v                    |
Logistica           RH (custo mao de obra)
                        ^
                        |
Contratos ──────────────┘ (medicoes)

Cadastros (master data) ──> TODOS os modulos

SSMA <──> RH (colaboradores, ASO)
     <──> Estoque (EPI)
     <──> Frotas (checklists seguranca)
```

## Seguranca

- **RLS** em todas as tabelas — usuarios so veem dados permitidos
- **Chaves sensiveis** nunca expostas no frontend (service_role, LLM keys ficam no n8n)
- **Aprovacoes por token UUID** — links unicos, uso unico, sem sessao
- **CORS** controlado pelo Supabase
- **Variaveis VITE_** — apenas URL e anon key (read-only com RLS)

## Estrutura de Diretorios

```
teg-plus/
├── frontend/
│   ├── src/
│   │   ├── components/    # ~40 componentes (Layout, KpiCard, StatusBadge, MagicModal...)
│   │   ├── contexts/      # AuthContext, ThemeContext
│   │   ├── hooks/         # ~15 hooks (useFinanceiro, useFrotas, useCotacoes...)
│   │   ├── pages/         # Por modulo: compras/, financeiro/, frotas/, contratos/...
│   │   ├── services/      # supabase.ts, api.ts (n8n + BrasilAPI + plate lookup)
│   │   └── types/         # TypeScript interfaces por dominio
│   ├── public/
│   └── package.json
├── supabase/              # 44+ migrations SQL (001-044)
├── n8n-workflows/         # Workflows exportados (.json)
├── docs/
│   ├── obsidian/          # Vault Obsidian com documentacao completa (120+ files)
│   └── ARCHITECTURE.md    # Este arquivo
├── README.md
├── SETUP.md
└── ROADMAP_ERP_WORLD_CLASS.md
```

## Banco de Dados — Prefixos de Tabela

| Prefixo | Modulo | Exemplos |
|---------|--------|----------|
| (sem) | Compras (legado) | requisicoes, cotacoes, aprovacoes |
| `fin_` | Financeiro | fin_contas_pagar, fin_contas_receber, fin_lotes_pagamento |
| `est_` | Estoque/Patrimonial | est_itens, est_movimentacoes, est_inventarios |
| `log_` | Logistica | log_solicitacoes, log_transportes, log_recebimentos |
| `fro_` | Frotas | fro_veiculos, fro_ordens_servico, fro_abastecimentos |
| `ctr_` | Contratos | ctr_contratos, ctr_parcelas, ctr_solicitacoes |
| `rh_` | RH | rh_colaboradores |
| `cad_` | Cadastros | cad_fornecedores, cad_itens, cad_obras |
| `apr_` | Aprovacoes | apr_aprovacoes (unificado multi-tipo) |
| `ctrl_` | Controladoria | ctrl_orcamentos, ctrl_kpis, ctrl_cenarios |

---

Ultima atualizacao: 2026-04-10
