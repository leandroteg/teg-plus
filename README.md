# TEG+ ERP

Sistema ERP modular para gestao de obras de engenharia eletrica e transmissao. Desenvolvido sob medida para a **TEG Engenharia**, cobrindo suprimentos, financeiro, frotas, logistica, contratos, RH e controladoria.

## Arquitetura

```
Usuario  -->  Frontend (React + Vite, Vercel)
                 |            |
                 v            v
            n8n (Webhooks)   Supabase (PostgreSQL + Auth + Realtime)
                 |
                 v
            AI Parse (Gemini Flash / Claude)
```

| Camada | Tecnologia | Funcao |
|--------|-----------|--------|
| Frontend | React 18, TypeScript, Tailwind, TanStack Query | SPA responsiva, PWA-ready |
| Backend | Supabase (PostgreSQL 15, Auth, Realtime, RLS) | Banco, autenticacao, tempo real |
| Automacao | n8n (self-hosted) | Orquestracao de workflows, webhooks, notificacoes |
| Deploy | Vercel | Build automatico a cada push em `main` |
| AI | Gemini Flash (parse documentos), Claude (agente) | Upload inteligente, preenchimento automatico |

## Modulos

| Modulo | Status | Completude | Descricao |
|--------|--------|-----------|-----------|
| **Compras** | Operacional | 95% | Requisicoes, cotacoes, aprovacoes multi-nivel, pedidos, upload inteligente AI |
| **Financeiro** | Operacional | 65% | Contas a pagar/receber, lotes de pagamento, aprovacao parcial, conciliacao |
| **Estoque** | Operacional | 60% | Almoxarifado, inventario, patrimonial, depreciacao |
| **Logistica** | Operacional | 85% | Solicitacoes de transporte, expedicao, recebimento, rastreamento |
| **Frotas** | Operacional | 80% | Veiculos, OS manutencao, checklists, abastecimento, telemetria, auto-fill placa |
| **Contratos** | Operacional | 85% | Fluxo 7 etapas, minutas AI, analise juridica, assinaturas, AprovAi |
| **Cadastros** | Operacional | 100% | Fornecedores, itens, obras, colaboradores, classes — com MagicModal AI |
| **Controladoria** | Em evolucao | 75% | DRE, orcado vs realizado, cenarios, KPIs, alertas de desvio |
| **RH** | Parcial | 15% | Headcount por obra, cultura/mural. Ponto, folha, HHt pendentes (Q2 2026) |
| **SSMA** | Planejado | 0% | Seguranca, NRs, DDS, EPI — previsto Q3 2026 |

### Sistema de Aprovacoes (AprovAi)

Centro unificado de aprovacoes com 4 tipos:
- Validacao Tecnica de Requisicao de Compra
- Aprovacao de Compras (cotacao)
- Autorizacao de Pagamento
- Minuta Contratual

Suporta 4 alcadas por valor, token-based para aprovadores externos, badge no header global.

## Quick Start

### Pre-requisitos
- Node.js 20+
- Projeto Supabase configurado
- Instancia n8n (self-hosted)

### Setup

```bash
# 1. Clonar
git clone https://github.com/leandroteg/teg-plus.git
cd teg-plus

# 2. Configurar variaveis de ambiente
cd frontend
cp .env.example .env.local
# Editar .env.local com suas credenciais:
#   VITE_SUPABASE_URL=https://xxx.supabase.co
#   VITE_SUPABASE_ANON_KEY=eyJ...
#   VITE_N8N_WEBHOOK_URL=https://seu-n8n.com/webhook

# 3. Instalar e rodar
npm install
npm run dev
# Acessar http://localhost:5173
```

### Migrations Supabase

Executar os arquivos SQL em `supabase/` no SQL Editor do Supabase, em ordem numerica:
```
supabase/001_schema_compras.sql
supabase/002_seed_usuarios.sql
...
supabase/044_lotes_pagamento.sql
```

### Variaveis de Ambiente

| Variavel | Onde | Descricao |
|----------|------|-----------|
| `VITE_SUPABASE_URL` | Frontend (.env.local) | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Frontend (.env.local) | Chave anonima (RLS) |
| `VITE_N8N_WEBHOOK_URL` | Frontend (.env.local) | URL base dos webhooks n8n |
| `SUPABASE_SERVICE_ROLE_KEY` | n8n (credentials) | Chave service_role (bypass RLS) |
| `LLM_API_KEY` | n8n (credentials) | API key Gemini/Claude |

> Chaves sensiveis (service_role, LLM) ficam **somente** no n8n, nunca no frontend.

## Deploy

Pipeline automatico:
1. `git push origin main`
2. Vercel detecta o push e roda `cd frontend && npm install && npm run build`
3. Output `frontend/dist` servido como SPA com rewrites para React Router

Configurar variaveis de ambiente no Vercel Dashboard > Settings > Environment Variables.

## Estrutura do Projeto

```
teg-plus/
  frontend/
    src/
      components/     # Componentes reutilizaveis (KpiCard, StatusBadge, MagicModal...)
      contexts/       # AuthContext, ThemeContext
      hooks/           # useFinanceiro, useFrotas, useCotacoes, useLotesPagamento...
      pages/           # Paginas por modulo (compras/, financeiro/, frotas/...)
      services/        # supabase.ts, api.ts (n8n + BrasilAPI)
      types/           # TypeScript interfaces
  supabase/            # Migrations SQL (001-044+)
  n8n-workflows/       # Workflows exportados
  docs/obsidian/       # Documentacao completa (Obsidian vault)
```

## Documentacao

A documentacao tecnica completa esta no vault Obsidian em `docs/obsidian/`:
- [Arquitetura Geral](docs/obsidian/01%20-%20Arquitetura%20Geral.md)
- [Frontend Stack](docs/obsidian/02%20-%20Frontend%20Stack.md)
- [Paginas e Rotas](docs/obsidian/03%20-%20Páginas%20e%20Rotas.md)
- [Schema Database](docs/obsidian/07%20-%20Schema%20Database.md)
- [n8n Workflows](docs/obsidian/10%20-%20n8n%20Workflows.md)
- [Roadmap](docs/obsidian/17%20-%20Roadmap.md)
- [Indice Completo](docs/obsidian/00%20-%20TEG+%20INDEX.md)

Para a melhor experiencia, abra `docs/obsidian/` como vault no [Obsidian](https://obsidian.md/) com os plugins Dataview, Calendar, Kanban e Templater.

## Obras Ativas

- SE Frutal
- SE Paracatu
- SE Perdizes
- SE Tres Marias
- SE Rio Paranaiba
- SE Ituiutaba

## Roadmap 2026

| Trimestre | Entregas Planejadas |
|-----------|-------------------|
| Q1 | WhatsApp (Evolution API), cotacoes end-to-end, CNAB |
| Q2 | RH completo (ponto, folha, HHt), AI Agent conversacional |
| Q3 | SSMA (NRs, DDS, EPI), medicoes contratos, Controladoria avancada |
| Q4 | Monday.com PMO, SEFAZ NF-e, eSocial, Open Banking |

---

Desenvolvido para **TEG Engenharia** — gestao de obras de transmissao de energia.
