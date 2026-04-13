---
tipo: adr
id: ADR-001
titulo: "Datas date-only com T12:00:00"
status: aceito
data: 2026-04-08
autor: Time DEV
tags: [adr, timezone, datas, brt, utc]
---

# ADR-001 — Timezone BRT: Datas date-only com T12:00:00

## Status
✅ Aceito

## Contexto
`new Date("2026-04-08")` é interpretado como UTC midnight pelo JavaScript. No fuso BRT (UTC-3), isso resulta em `2026-04-07T21:00:00`, mostrando o dia anterior ao usuário. Todas as datas do banco que são `DATE` (sem hora) sofriam esse problema.

## Decisão
Ao parsear strings date-only (formato `YYYY-MM-DD`, length === 10), sempre adicionar `T12:00:00`:

```typescript
const safeDate = (d: string) =>
  new Date(d.length === 10 ? d + 'T12:00:00' : d)
```

Meio-dia garante que mesmo com offsets de ±12h, o dia permanece correto.

## Alternativas Consideradas
1. **T00:00:00-03:00** (offset explícito) — Funciona, mas quebra se usuário estiver em outro fuso
2. **Usar Luxon/date-fns-tz** — Overhead de biblioteca para problema simples
3. **Armazenar como TIMESTAMPTZ** — Mudança de schema muito ampla para pouco ganho

## Consequências
### Positivas
- Zero dependência externa
- Fix simples e replicável em qualquer formatador
- Funciona em qualquer timezone brasileiro

### Negativas
- Devs precisam lembrar de usar `safeDate()` (risco de esquecimento)
- `T12:00:00` pode parecer "mágico" sem contexto

## Arquivos afetados
- `SolicitacaoDetalhe.tsx`, `SolicitacoesLista.tsx`, `PreparaMinuta.tsx`
- `ResumoExecutivo.tsx`, `Assinaturas.tsx`, `ContratoDetalhe.tsx`
- `NovaSolicitacao.tsx`, `contratosParcelas.ts`

## Links
- [[27 - Módulo Contratos Gestão]]
- [[36 - Guia de Contribuição]]
- [[37 - Troubleshooting FAQ]]
- [[40 - ADRs Index]]
