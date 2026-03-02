---
tipo: tarefa
id: TASK-001
titulo: "Portal de Requisições"
status: concluido
prioridade: critica
modulo: compras
responsavel: Leandro
milestone: MS-001
sprint: Sprint-1
estimativa: 21
gasto: 21
data_inicio: 2026-01-15
data_fim: 2026-02-10
tags: [tarefa, compras, requisicao, wizard, ai]
---

# ✅ TASK-001 — Portal de Requisições

## Descrição
Wizard de 3 etapas para criação de requisições de compra, com modo AI que interpreta texto livre e extrai itens estruturados.

## Entregas
- [x] Wizard step 1 — Identificação (obra, categoria, urgência)
- [x] Wizard step 2 — Itens (descrição, qtd, valor)
- [x] Wizard step 3 — Revisão e envio
- [x] Modo AI — parse via n8n + LLM
- [x] Integração com n8n `POST /compras/requisicao`
- [x] Geração de número RC-YYYYMM-XXXX

## Links
- [[11 - Fluxo Requisição]]
- [[10 - n8n Workflows]]
