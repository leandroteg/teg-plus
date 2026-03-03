---
tipo: requisito
id: REQ-007
titulo: "Agente de IA conversacional (TEG+ AI)"
categoria: funcional
prioridade: alta
status: planejado
modulo: ai
sprint: Sprint-5
milestone: MS-005
tags: [requisito, ai, claude, whatsapp, agente, conversacional]
---

# 📋 REQ-007 — Agente IA Conversacional

## Descrição
Usuários devem poder interagir com o TEG+ em linguagem natural via WhatsApp ou chat web: abrir requisições, consultar status, gerar relatórios.

## Critérios de Aceite
- [ ] Intenção "abrir requisição" → wizard conversacional
- [ ] Intenção "status da RC-XXX" → retorna situação atual
- [ ] Intenção "relatório do mês" → gera e envia PDF
- [ ] Contexto multi-turno (lembra da conversa)
- [ ] Fallback gracioso para perguntas fora do escopo

## Tarefa Relacionada
[[TASK-008 - AI TEG+ Agente]]
