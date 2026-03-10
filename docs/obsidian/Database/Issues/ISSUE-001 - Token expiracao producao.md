---
tipo: issue
id: ISSUE-001
titulo: "Tokens de aprovação expiram sem notificação"
status: resolvida
severidade: alta
modulo: compras
reportado_por: Leandro
data_report: 2026-03-02
data_resolucao: 2026-03-07
sprint: Sprint-2
tags: [issue, token, aprovacao, notificacao, resolvida]
---

# ✅ ISSUE-001 — Tokens expiram sem notificação (RESOLVIDA)

## Descrição
Quando o prazo de uma aprovação expira, o status muda para `expirada` no banco, mas nenhuma notificação é enviada ao solicitante ou ao comprador. A requisição fica "travada" em `em_aprovacao` sem que ninguém saiba.

## Impacto
- Requisições ficam paradas sem progresso
- Solicitante não sabe que precisa agir
- Compromete SLA de aprovação

## Solução Proposta
Criar cron job no n8n (schedule trigger, a cada hora) que:
1. Busca aprovações `status = pendente AND data_limite < NOW()`
2. Atualiza para `expirada`
3. Notifica solicitante e comprador via WhatsApp/Email

## Passos para Reproduzir
1. Criar requisição com valor < R$5.000
2. Aguardar 24h sem aprovar
3. Verificar tabela `apr_aprovacoes` — status não muda automaticamente

## Resolucao

Implementado em 2026-03-07 via commit `4f1005c`:
- Criado workflow n8n "Expiracao de Aprovacoes" (ID: `pxhj2bgacHUC1Jsc`) com schedule trigger (cron horario)
- Busca aprovacoes pendentes com `data_limite < NOW()` e atualiza status para `expirada`
- Workflow ativo em producao

## Links
- [[12 - Fluxo Aprovação]]
- [[10 - n8n Workflows]]
