---
tipo: adr
id: ADR-005
titulo: "AprovAi como PWA standalone"
status: aceito
data: 2026-03-15
autor: Time DEV
tags: [adr, pwa, aprovai, mobile, standalone]
---

# ADR-005 — AprovAi como PWA Standalone

## Status
✅ Aceito

## Contexto
Aprovadores (diretoria, gerentes) precisam aprovar requisições e contratos pelo celular, muitas vezes em campo sem boa conectividade. App nativo seria caro e lento de desenvolver.

## Decisão
AprovAi como rota PWA (`/aprovai`) com `display: standalone`. Instalável no celular como "app". Detecção via `window.matchMedia('(display-mode: standalone)')`.

## Alternativas Consideradas
1. **App nativo (React Native)** — Custo alto, deploy em app stores
2. **Responsive web apenas** — Sem experiência "app-like"
3. **Telegram/WhatsApp bot** — Limitado para UI complexa

## Consequências
### Positivas
- Zero custo de publicação em stores
- Reuso total do código React existente
- Experiência fullscreen no celular
- Aprovação via token funciona offline → online

### Negativas
- iOS tem limitações de PWA (sem push notifications até recente)
- Comportamento de navegação difere (sem botão voltar nativo do browser)
- Precisa detectar `isStandalone` para adaptar UX

## Links
- [[12 - Fluxo Aprovação]]
- [[04 - Componentes]]
- [[40 - ADRs Index]]
