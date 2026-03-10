---
tipo: milestone
id: MS-011
titulo: "AI TEG+ — Agente Conversacional Claude"
status: em-andamento
fase: Q1-2026
data_alvo: 2026-06-30
progresso: 60
updated: 2026-03-10
modulo: ai
tags: [milestone, ai, claude, whatsapp, rag, agente]
---

# 🔵 MS-011 — AI TEG+ Agent

## Visão Geral
Agente conversacional baseado em Claude API para interação via WhatsApp e painel web. Capacidades de criação de requisições, consulta de status, relatórios e análise de anomalias.

## Estado Atual (2026-03-10)
SuperTEG AI Agent operacional com Gemini Flash via n8n. 4 sub-agents implementados e funcionais:
- **Agent Feedback:** registra issues no GitHub via API
- **Agent Consulta Dados:** busca dados no Supabase por módulo
- **Agent Dashboard KPIs:** agrega métricas financeiro/compras/estoque
- **Agent Pre-Cadastro:** cria pré-cadastros com enriquecimento CNPJ (BrasilAPI)

Frontend: structured actions protocol (auto-navigate, action buttons, notify_admins). NotificationBell com badge no header admin, review panel inline. Chat web embarcado e funcional.

## Capacidades Implementadas

| Comando | Ação | Canal | Status |
|---------|------|-------|--------|
| "Abrir pré-cadastro" | Pre-cadastro + enriquecimento CNPJ | Web | ✅ |
| "Status da RC-XXX" | Consulta Supabase | Web | ✅ |
| "Quantas pendentes?" | Dashboard KPIs | Web | ✅ |
| "Reportar problema" | GitHub Issue via API | Web | ✅ |
| "Relatório do mês" | AI + SQL | Web chat | ⬜ pendente (Claude API) |
| Análise anomalias | Claude + cron | Web | ⬜ pendente (Claude API) |

## Stack Técnico
- **LLM atual:** Gemini Flash (via n8n)
- **LLM futuro:** Claude API (Anthropic)
- **Orquestração:** n8n (SuperTEG workflow + 4 sub-agents)
- **Base de conhecimento:** Supabase pgvector (RAG) — pendente
- **Canal WhatsApp:** Evolution API — pendente config
- **Canal Web:** Chat embarcado no frontend — ✅ operacional

## Entregas
- [x] n8n workflow: Chat web → Gemini → resposta (SuperTEG Agent)
- [x] 4 sub-agents (Feedback, Consulta, KPIs, Pre-Cadastro)
- [x] Frontend chat com structured actions protocol
- [x] NotificationBell para admins (pré-cadastros)
- [ ] n8n workflow: WhatsApp → Claude → resposta
- [ ] RAG com pgvector (documentos, requisições, status)
- [ ] Migração Gemini → Claude API
- [ ] Tool use para consultas SQL avançadas
- [ ] Análise de anomalias financeiras
- [ ] Dashboard de uso do agente

## Tarefas
| ID | Tarefa | Status |
|----|--------|--------|
| [[TASK-008 - AI TEG+ Agente\|TASK-008]] | AI TEG+ — Agente Conversacional | 🟡 parcial (SuperTEG operacional) |
| [[TASK-026 - AI Agent Claude\|TASK-026]] | Implementação Claude API + RAG | ⬜ backlog |

## Progresso
`██████░░░░` 60%
