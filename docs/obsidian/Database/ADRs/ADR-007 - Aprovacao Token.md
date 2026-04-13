---
tipo: adr
id: ADR-007
titulo: "Aprovação via token único por email e WhatsApp"
status: aceito
data: 2026-03-10
autor: Time DEV
tags: [adr, aprovacao, token, whatsapp, email]
---

# ADR-007 — Aprovação via Token Único

## Status
✅ Aceito

## Contexto
Aprovadores frequentemente não estão logados no sistema. Precisam aprovar/rejeitar de forma rápida por WhatsApp ou email, sem exigir login.

## Decisão
Cada aprovação gera um token UUID único armazenado em `apr_aprovacoes.token`. O aprovador recebe link com token que permite ação direta sem login.

```
https://tegplus.com.br/aprovai?token=abc-123-uuid
```

## Alternativas Consideradas
1. **Login obrigatório** — Friccão alta, aprovadores ignorariam
2. **OTP por SMS** — Custo por mensagem, latência
3. **Magic link genérico** — Não vincula à ação específica

## Consequências
### Positivas
- Aprovação em 1 clique (WhatsApp → link → decisão)
- Sem necessidade de login ou senha
- Token single-use (segurança)
- Rastreabilidade completa (quem, quando, qual token)

### Negativas
- Token exposto no link (mitigado: single-use + expiração)
- Quem tem o link pode aprovar (risco se encaminhado)

## Links
- [[12 - Fluxo Aprovação]]
- [[13 - Alçadas]]
- [[09 - Auth Sistema]]
- [[40 - ADRs Index]]
