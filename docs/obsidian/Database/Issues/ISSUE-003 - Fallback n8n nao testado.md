---
tipo: issue
id: ISSUE-003
titulo: "Fallback n8n → Supabase não testado em produção"
status: aberto
severidade: alta
modulo: infra
reportado_por: Leandro
data_report: 2026-03-02
sprint: Sprint-2
tags: [issue, fallback, n8n, supabase, confiabilidade]
---

# 🟠 ISSUE-003 — Fallback n8n não validado

## Descrição
O código possui lógica de fallback (se n8n falhar → Supabase direto), mas esse caminho nunca foi testado intencionalmente. Em produção, se o n8n cair, o usuário pode enfrentar comportamento imprevisível.

## Impacto
- Possível perda de requisições em caso de instabilidade do n8n
- Lógica de fallback pode ter bugs silenciosos

## Solução Proposta
1. Criar suite de testes para o fallback
2. Simular queda do n8n (desabilitar temporariamente)
3. Validar que Supabase direto funciona corretamente
4. Adicionar logs de fallback ativados

## Links
- [[01 - Arquitetura Geral]]
- [[10 - n8n Workflows]]
