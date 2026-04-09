---
title: Deploy e GitHub
type: infraestrutura
status: ativo
tags: [deploy, vercel, github, ci-cd, infraestrutura]
criado: 2026-03-02
relacionado: ["[[01 - Arquitetura Geral]]", "[[16 - Variáveis de Ambiente]]", "[[35 - Onboarding DEV]]", "[[36 - Guia de Contribuição]]", "[[42 - Estratégia de Testes]]", "[[44 - Changelog]]"]
---

# Deploy e GitHub — TEG+ ERP

## Repositório GitHub

```
Repositório: leandroteg/teg-plus
Branch principal: main
Branch de desenvolvimento: claude/map-app-architecture-*
```

---

## Estratégia de Deploy

```mermaid
flowchart LR
    DEV[Desenvolvimento\nLocal :5173] -->|git push| GH[GitHub\nmain]
    GH -->|Trigger automático| VCL[Vercel\nBuild + Deploy]
    VCL -->|Deploy| PROD[Produção\ntegplus.com.br]
```

---

## Vercel (`vercel.json`)

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Detalhes:**
- Build: `cd frontend && npm install && npm run build`
- Output: `frontend/dist`
- Framework detectado: Vite
- SPA rewrite: todas as rotas → `index.html` (necessário para React Router)

---

## GitHub Actions

**Status atual:** Nenhum workflow configurado.

**Localização esperada:**
```
.github/
└── workflows/
    └── (vazio — não configurado)
```

**Recomendações futuras:**

```yaml
# .github/workflows/ci.yml (sugerido)
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm install
      - run: cd frontend && npm run build
      - run: cd frontend && npx tsc --noEmit
```

---

## Variáveis de Ambiente no Vercel

No painel Vercel → Settings → Environment Variables:

| Variável | Ambiente | Descrição |
|----------|----------|-----------|
| `VITE_SUPABASE_URL` | Production + Preview | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Production + Preview | Chave anon pública |
| `VITE_N8N_WEBHOOK_URL` | Production + Preview | Base URL dos webhooks n8n |

> **Importante:** prefixo `VITE_` é obrigatório para Vite expor as vars para o browser.

---

## Estrutura de Branches

```
main
├── Produção — auto-deploy no Vercel
└── Pull requests → preview deployments

claude/map-app-architecture-*
└── Desenvolvimento atual (Claude Code sessions)
```

---

## Build Local

```bash
# Instalação
cd frontend
npm install

# Desenvolvimento
npm run dev           # http://localhost:5173

# Build de produção
npm run build         # output: frontend/dist/

# Preview local do build
npm run preview       # http://localhost:4173

# Type check
npx tsc --noEmit
```

---

## .gitignore

```gitignore
# Dependências
node_modules/
frontend/node_modules/

# Build
dist/
frontend/dist/

# Ambiente
.env
.env.local
.env.*.local

# Sistema
.DS_Store
.vscode/
*.swp
```

---

## Domínio e SSL

- Deploy automático no domínio Vercel: `teg-plus.vercel.app`
- SSL automático via Vercel (Let's Encrypt)
- Domínio customizado: configurar no painel Vercel

---

## Links Relacionados

- [[01 - Arquitetura Geral]] — Visão da infraestrutura
- [[16 - Variáveis de Ambiente]] — Configuração de variáveis
- [[02 - Frontend Stack]] — Scripts de build
