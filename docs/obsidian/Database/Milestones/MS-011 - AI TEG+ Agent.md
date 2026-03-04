---
tipo: milestone
id: MS-011
titulo: "AI TEG+ — Agente Conversacional Claude"
status: backlog
fase: Q2-2026
data_alvo: 2026-06-30
progresso: 0
modulo: ai
tags: [milestone, ai, claude, whatsapp, rag, agente]
---

# 🗺️ MS-011 — AI TEG+ Agent

## Visão Geral
Agente conversacional baseado em Claude API para interação via WhatsApp e painel web. Capacidades de criação de requisições, consulta de status, relatórios e análise de anomalias.

## Capacidades Planejadas

| Comando | Ação | Canal |
|---------|------|-------|
| "Abrir requisição" | Wizard conversacional | WhatsApp + Web |
| "Status da RC-XXX" | Consulta Supabase | WhatsApp + Web |
| "Quantas pendentes?" | Dashboard via RAG | WhatsApp |
| "Relatório do mês" | AI + SQL | Web chat |
| Análise anomalias | Claude + cron | Web |

## Stack Técnico
- **LLM:** Claude API (Anthropic)
- **Orquestração:** n8n
- **Base de conhecimento:** Supabase pgvector (RAG)
- **Canal WhatsApp:** Evolution API
- **Canal Web:** Chat embarcado no frontend

## Entregas Planejadas
- [ ] n8n workflow: WhatsApp → Claude → resposta
- [ ] n8n workflow: Chat web → Claude → resposta
- [ ] RAG com pgvector (documentos, requisições, status)
- [ ] Tool use para consultas SQL
- [ ] Análise de anomalias financeiras
- [ ] Dashboard de uso do agente

## Tarefas
| ID | Tarefa | Status |
|----|--------|--------|
| [[TASK-008 - AI TEG+ Agente\|TASK-008]] | AI TEG+ — Agente Conversacional | ⬜ backlog |
| [[TASK-026 - AI Agent Claude\|TASK-026]] | Implementação Claude API + RAG | ⬜ backlog |

## Progresso
`░░░░░░░░░░` 0%
