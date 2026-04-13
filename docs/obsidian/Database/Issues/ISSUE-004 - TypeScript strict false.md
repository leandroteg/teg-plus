---
tipo: issue
id: ISSUE-004
titulo: "TypeScript com strict: false — risco de bugs"
status: parcial
severidade: baixa
modulo: infra
reportado_por: Leandro
data_report: 2026-03-02
data_atualizacao: 2026-03-07
sprint: Sprint-3
tags: [issue, typescript, qualidade, tipos, parcial]
---

# 🟡 ISSUE-004 — TypeScript strict desativado (PARCIALMENTE RESOLVIDA)

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

## Progresso

Commit `3dc22ad` (2026-03-07):
- [x] `"strictNullChecks": true` habilitado no `tsconfig.json`
- [x] Erros de tipo corrigidos em `usePatrimonial.ts`, `CotacaoForm.tsx`, `Inventario.tsx`
- [ ] `"noImplicitAny": true` — pendente (passo 2)
- [ ] `"strict": true` — meta final, pendente

> O `tsconfig.json` agora tem `strict: false` + `strictNullChecks: true`. Proximo passo e habilitar `noImplicitAny`.

## Links
- [[02 - Frontend Stack]]
- [[Database/Tarefas/TASK-030 - Testes CI CD|TASK-030 — Testes e CI/CD]]
- [[15 - Deploy e GitHub]]
