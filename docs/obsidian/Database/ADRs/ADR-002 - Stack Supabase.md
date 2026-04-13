---
tipo: adr
id: ADR-002
titulo: "Supabase como backend-as-a-service"
status: aceito
data: 2026-03-01
autor: Time DEV
tags: [adr, supabase, backend, infraestrutura]
---

# ADR-002 — Supabase como Backend-as-a-Service

## Status
✅ Aceito

## Contexto
TEG+ precisava de um backend completo (DB, auth, storage, APIs) com time pequeno e entrega rápida. Não havia capacidade para manter servidor dedicado.

## Decisão
Adotar Supabase (PostgreSQL gerenciado + Auth + Storage + PostgREST + Realtime) como backend principal.

## Alternativas Consideradas
1. **Firebase** — NoSQL (Firestore) não ideal para dados relacionais de ERP
2. **Backend custom (Node/Express)** — Muito overhead para time pequeno
3. **AWS Amplify** — Vendor lock-in forte, mais complexo

## Consequências
### Positivas
- PostgreSQL real com SQL completo e RLS nativo
- Auth pronto (email, magic link, OAuth)
- Storage integrado para arquivos
- PostgREST gera APIs REST automaticamente
- Dashboard para gerenciar dados

### Negativas
- Dependência de vendor (Supabase)
- Lógica complexa precisa de Edge Functions ou n8n
- Free tier limitado para produção (necessário Pro)

## Links
- [[06 - Supabase]]
- [[01 - Arquitetura Geral]]
- [[40 - ADRs Index]]
