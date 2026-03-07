---
tipo: issue
id: ISSUE-008
titulo: "Botao salvar nao funciona na tela de nova requisicao"
status: aberto
severidade: alta
modulo: compras
reportado_por: Usuario via SuperTEG
data_report: 2026-03-07
sprint: Sprint-3
origem: superteg-agent
tags: [issue, bug, compras, requisicao, botao, ux]
---

# 🟠 ISSUE-008 — Botao salvar travado na tela de nova requisicao

> **Origem:** Feedback via SuperTEG AI Agent (2 reports independentes)

## Descricao
O botao de salvar na tela de nova requisicao de compras nao funciona — fica travado ao clicar. Reportado por 2 usuarios diferentes via SuperTEG Agent, confirmando que e um bug recorrente.

## Impacto
- **CRITICO para operacao** — usuarios nao conseguem criar requisicoes
- 2 reports independentes confirmam o problema
- Bloqueia fluxo principal do modulo de Compras

## Solucao Proposta
1. Verificar handler `onSubmit` do formulario wizard 3-step
2. Checar se validacao esta bloqueando sem exibir erro
3. Verificar se mutation do TanStack Query esta em estado loading permanente
4. Testar com DevTools aberto para ver erros de console

## Passos para Reproduzir
1. Acessar /compras → Nova Requisicao
2. Preencher os 3 passos do wizard
3. Clicar em "Salvar"
4. Botao fica travado, sem resposta

## Arquivos Afetados
- `frontend/src/pages/compras/NovaRequisicao.tsx`
- `frontend/src/hooks/useRequisicoes.ts`
- `frontend/src/services/api.ts` (endpoint de criacao)

## Links
- [[05 - Modulo Compras]]
- [[TASK-001 - Portal de requisicoes]]
