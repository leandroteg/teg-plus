---
tipo: issue
id: ISSUE-004
titulo: "TypeScript com strict: false — risco de bugs"
status: aberto
severidade: baixa
modulo: infra
reportado_por: Leandro
data_report: 2026-03-02
sprint: Sprint-3
tags: [issue, typescript, qualidade, tipos]
---

# 🟢 ISSUE-004 — TypeScript strict desativado

## Descrição
O `tsconfig.json` tem `"strict": false`, o que desabilita verificações importantes como `strictNullChecks`, `noImplicitAny` e `strictFunctionTypes`. Isso aumenta o risco de bugs em runtime.

## Impacto
- Possível `undefined is not a function` em produção
- Tipos `any` implícitos passam sem aviso
- Dificulta manutenção futura

## Solução Proposta
Habilitar gradualmente:
1. `"strictNullChecks": true` — primeiro passo
2. Corrigir todos os erros que aparecerem
3. `"noImplicitAny": true` — segundo passo
4. `"strict": true` — meta final

## Links
- [[02 - Frontend Stack]]
