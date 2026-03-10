---
tipo: issue
id: ISSUE-005
titulo: "Ausência de testes automatizados"
status: parcial
severidade: media
modulo: infra
reportado_por: Leandro
data_report: 2026-03-02
data_atualizacao: 2026-03-07
sprint: Sprint-3
tags: [issue, testes, ci, qualidade, parcial]
---

# 🟡 ISSUE-005 — Sem testes automatizados (PARCIALMENTE RESOLVIDA)

## Descrição
O projeto não possui nenhum teste automatizado (unitário, integração ou e2e). Com a expansão para novos módulos, o risco de regressão aumenta significativamente.

## Impacto
- Alterações podem quebrar funcionalidades existentes silenciosamente
- Deploy sem confiança de regressão
- Custo alto de QA manual

## Solução Proposta
1. Vitest para unit/integration tests (hooks e services)
2. Playwright para e2e (fluxo crítico: criar requisição → aprovar)
3. Integrar no GitHub Actions (TASK-011)

## Progresso

Commit `c41b794` (2026-03-07):
- [x] Vitest configurado (`vitest.config.ts` + `setup.ts`)
- [x] Testes basicos criados: `wizard-validation.test.ts`, `periodo-mapping.test.ts`
- [x] Suite expandida com 14 arquivos de teste (auth, compras, contratos, estoque, financeiro, frotas, logistica, cadastros, e2e-smoke, validators)
- [x] Mocks configurados: api, supabase, router
- [ ] Playwright para e2e — pendente
- [ ] Integracao com GitHub Actions (CI) — pendente
- [ ] Cobertura >= 60% — pendente

> Infraestrutura de testes configurada. Proximos passos: aumentar cobertura e integrar no CI.

## Links
- [[15 - Deploy e GitHub]]
