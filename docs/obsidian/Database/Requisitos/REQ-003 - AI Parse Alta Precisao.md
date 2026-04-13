---
tipo: requisito
id: REQ-003
titulo: "AI parse com precisão > 90%"
categoria: nao-funcional
prioridade: alta
status: entregue
modulo: compras
sprint: Sprint-1
milestone: MS-001
tags: [requisito, ai, parse, precisao, llm]
---

# ✅ REQ-003 — AI Parse Alta Precisão

## Descrição
O sistema de AI parse deve identificar corretamente categoria, obra, itens e urgência em pelo menos 90% dos casos de texto livre em português.

## Critérios de Aceite
- [x] Score de confiança retornado (0-1)
- [x] Keywords por categoria para boost de precisão
- [x] Fallback para parser local se n8n indisponível
- [x] Campos editáveis após parse (usuário pode corrigir)
- [x] Precisão medida: ≥ 90% nos casos testados

## Tarefa Relacionada
- [[Database/Tarefas/TASK-001 - Portal de Requisicoes|TASK-001 — Portal de Requisições]]
- [[26 - Upload Inteligente Cotacao]]
- [[10 - n8n Workflows]]
