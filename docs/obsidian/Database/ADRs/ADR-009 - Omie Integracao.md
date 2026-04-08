---
tipo: adr
id: ADR-009
titulo: "Omie como ERP contábil com sync via n8n"
status: aceito
data: 2026-03-25
autor: Time DEV
tags: [adr, omie, integracao, erp, financeiro]
---

# ADR-009 — Integração com Omie ERP via n8n

## Status
✅ Aceito

## Contexto
TEG+ gerencia operação (compras, logística, contratos) mas precisa de ERP contábil para emissão de NF, DRE, obrigações fiscais. Reescrever contabilidade seria inviável.

## Decisão
Integrar com Omie ERP via API REST, orquestrado por n8n. Omie é o sistema contábil/fiscal; TEG+ é o sistema operacional. Sync bidirecional de CP, CR, e cadastros.

## Alternativas Consideradas
1. **Construir módulo contábil** — Complexidade regulatória (SPED, NFe) inviável
2. **TOTVS/SAP** — Custo muito alto para o porte
3. **Sync direto (sem n8n)** — Sem visibilidade de execuções, debug difícil

## Consequências
### Positivas
- TEG+ foca no operacional, Omie no contábil
- Sync automatizado (sem dupla digitação)
- Omie já homologado para NFe, SPED, etc.
- n8n dá visibilidade total do sync

### Negativas
- Rate limit da API Omie (3 req/s)
- Mapeamento de campos complexo
- Dois sistemas para gerenciar

## Links
- [[19 - Integração Omie]]
- [[20 - Módulo Financeiro]]
- [[10 - n8n Workflows]]
- [[40 - ADRs Index]]
