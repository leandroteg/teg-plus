---
tipo: tarefa
id: TASK-018
titulo: "Integração RH — Remessa de Folha de Pagamento"
status: backlog
prioridade: media
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
estimativa: 5
gasto: 0
tags: [task, financeiro, rh, folha, remessa, integracao]
---

# 📋 TASK-018 — Integração RH — Folha de Pagamento

## Descrição
O RH envia ao financeiro a remessa de pagamento da folha. O financeiro executa o pagamento e devolve o comprovante ao RH, sem retrabalho ou troca de arquivos por e-mail.

## Subtarefas
- [ ] Tela de submissão de remessa de folha pelo RH
- [ ] Upload do arquivo CNAB/planilha com os créditos da folha
- [ ] Validação dos dados antes da submissão (nomes, CPFs, valores)
- [ ] Financeiro recebe notificação de remessa pendente
- [ ] Aprovação da Diretoria antes da execução
- [ ] Execução via remessa bancária (integrada com TASK-014)
- [ ] Comprovante de pagamento disponível para RH após execução
- [ ] Histórico de folhas pagas por competência

## Requisitos Relacionados
- [[REQ-015 - Integracoes Internas Financeiro]]

## Milestone
[[MS-004 - Modulo Financeiro]]
