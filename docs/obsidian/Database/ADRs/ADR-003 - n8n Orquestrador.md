---
tipo: adr
id: ADR-003
titulo: "n8n como hub de orquestração e automação"
status: aceito
data: 2026-03-01
autor: Time DEV
tags: [adr, n8n, automacao, orquestracao, webhooks]
---

# ADR-003 — n8n como Hub de Orquestração

## Status
✅ Aceito

## Contexto
O TEG+ precisa orquestrar: notificações WhatsApp, análise AI, sync com Omie ERP, processamento de aprovações via token. Essas lógicas são complexas demais para Edge Functions simples.

## Decisão
Usar n8n (self-hosted via EasyPanel/Docker) como hub central de automação. Toda lógica complexa passa por n8n via webhooks.

## Alternativas Consideradas
1. **Supabase Edge Functions** — Bom para lógica simples, limitado para orquestração multi-step
2. **Zapier/Make** — Caro em volume, sem self-hosting
3. **Temporal.io** — Over-engineering para o caso de uso

## Consequências
### Positivas
- Interface visual para workflows (não-devs conseguem entender)
- Self-hosted = custo fixo, sem limites por execução
- 400+ integrações nativas (Omie, WhatsApp, OpenAI, etc.)
- Debug visual step-by-step

### Negativas
- Mais um componente para manter (Docker)
- Latência adicional (frontend → n8n → Supabase)
- Single point of failure se container cair

## Links
- [[10 - n8n Workflows]]
- [[01 - Arquitetura Geral]]
- [[45 - Mapa de Integrações]]
- [[40 - ADRs Index]]
