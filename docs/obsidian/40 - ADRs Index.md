---
title: ADRs Index
type: dev-guide
status: ativo
tags: [adr, decisoes, arquitetura, registro, historico]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[00 - Premissas do Projeto]]", "[[01 - Arquitetura Geral]]"]
---

# 📋 ADRs — Architecture Decision Records

> Registro de decisões técnicas relevantes e o **porquê** de cada uma.
> Cada ADR é imutável após aceito — novas decisões criam novos ADRs.

---

## O que é um ADR?

Um ADR documenta:
- **Contexto**: Qual problema estávamos resolvendo?
- **Decisão**: O que decidimos fazer?
- **Alternativas**: O que mais consideramos?
- **Consequências**: O que ganhamos e o que abrimos mão?

---

## Índice de ADRs

| ID | Título | Status | Data |
|----|--------|--------|------|
| [[ADR-001 - Timezone BRT]] | Datas date-only com T12:00:00 | ✅ Aceito | 2026-04-08 |
| [[ADR-002 - Stack Supabase]] | Supabase como backend-as-a-service | ✅ Aceito | 2026-03-01 |
| [[ADR-003 - n8n Orquestrador]] | n8n como hub de automação | ✅ Aceito | 2026-03-01 |
| [[ADR-004 - Frontend SPA React]] | React SPA + Vite (sem SSR) | ✅ Aceito | 2026-03-01 |
| [[ADR-005 - PWA AprovAi]] | AprovAi como PWA standalone | ✅ Aceito | 2026-03-15 |
| [[ADR-006 - Prefixos Schema]] | Prefixos por módulo no banco | ✅ Aceito | 2026-03-01 |
| [[ADR-007 - Aprovacao Token]] | Aprovação via token único (email/WhatsApp) | ✅ Aceito | 2026-03-10 |
| [[ADR-008 - AI Parse Cotacoes]] | Upload inteligente de cotações com AI | ✅ Aceito | 2026-03-20 |
| [[ADR-009 - Omie Integracao]] | Omie como ERP contábil (sync via n8n) | ✅ Aceito | 2026-03-25 |
| [[ADR-010 - Regra Contrato R2000]] | Contrato obrigatório: recorrente ou serviço > R$2000 | ✅ Aceito | 2026-04-01 |

---

## Template para novo ADR

```markdown
---
tipo: adr
id: ADR-NNN
titulo: "Título da Decisão"
status: proposto | aceito | substituído | depreciado
data: YYYY-MM-DD
autor: Nome
tags: [adr, módulo-relevante]
---

# ADR-NNN — Título

## Status
Aceito

## Contexto
O que motivou essa decisão? Qual problema existia?

## Decisão
O que decidimos fazer?

## Alternativas Consideradas
1. **Alternativa A** — Por que não escolhemos
2. **Alternativa B** — Por que não escolhemos

## Consequências
### Positivas
- ...

### Negativas
- ...

## Links
- [[doc-relacionado]]
```

---

## Links

- [[00 - Premissas do Projeto]]
- [[01 - Arquitetura Geral]]
- [[35 - Onboarding DEV]]
- [[36 - Guia de Contribuição]]
