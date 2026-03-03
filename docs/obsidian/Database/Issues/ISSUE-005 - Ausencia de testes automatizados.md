---
tipo: issue
id: ISSUE-005
titulo: "Ausência de testes automatizados"
status: aberto
severidade: media
modulo: infra
reportado_por: Leandro
data_report: 2026-03-02
sprint: Sprint-3
tags: [issue, testes, ci, qualidade]
---

# 🟡 ISSUE-005 — Sem testes automatizados

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

## Links
- [[15 - Deploy e GitHub]]
