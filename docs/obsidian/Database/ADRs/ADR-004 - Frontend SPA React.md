---
tipo: adr
id: ADR-004
titulo: "React SPA + Vite sem SSR"
status: aceito
data: 2026-03-01
autor: Time DEV
tags: [adr, react, vite, spa, frontend]
---

# ADR-004 — Frontend SPA React + Vite (sem SSR)

## Status
✅ Aceito

## Contexto
ERP interno sem necessidade de SEO. Precisa de reatividade, PWA support, e desenvolvimento rápido.

## Decisão
React 18 + Vite 6 + TypeScript como SPA puro. Sem SSR (Next.js/Remix). Deploy como estático no Vercel.

## Alternativas Consideradas
1. **Next.js** — SSR/SSG desnecessário para ERP interno, mais complexidade
2. **Vue/Nuxt** — Menos ecossistema de componentes para nosso caso
3. **Angular** — Over-engineering, curva de aprendizado maior

## Consequências
### Positivas
- Build rápido (Vite HMR < 100ms)
- Simplicidade de deploy (estáticos no Vercel)
- Ecossistema React maduro (TanStack, Tailwind, Lucide)
- PWA fácil de implementar

### Negativas
- Sem SSR = primeiro load mais lento (mitigado com code splitting)
- Sem SEO (irrelevante para ERP interno)

## Links
- [[02 - Frontend Stack]]
- [[01 - Arquitetura Geral]]
- [[40 - ADRs Index]]
