---
tipo: requisito
id: REQ-016
titulo: "Exceções ao Processo de Pagamento"
categoria: funcional
prioridade: media
status: planejado
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
tags: [requisito, financeiro, excecoes, reembolso, viagem]
---

# 📋 REQ-016 — Exceções ao Processo de Pagamento

## Descrição
Certos tipos de pagamento não seguem o fluxo padrão (PO → NF → Aprovação → Remessa). O sistema deve suportar esses casos sem criar brechas na governança.

## Exceções Mapeadas

### 1. Repasse de Viagem
- Solicitação prévia com valor estimado e justificativa
- Aprovação do gestor direto + Diretoria
- Prestação de contas obrigatória com comprovantes
- Diferença devolvida ou cobrada automaticamente

**Critérios de Aceite:**
- [ ] Formulário de solicitação de adiantamento de viagem
- [ ] Workflow de aprovação específico (gestor + Diretoria)
- [ ] Prazo para prestação de contas configurável
- [ ] Alerta automático de prestação de contas em aberto

### 2. Reembolso
- Comprovante de gasto do colaborador
- Aprovação do gestor direto + Diretoria
- Pagamento via folha ou transferência avulsa

**Critérios de Aceite:**
- [ ] Upload de comprovante pelo solicitante
- [ ] Workflow de aprovação (gestor + Diretoria)
- [ ] Integração com RH para pagamento via folha (opcional)

### 3. Pagamento de "Previsto" (sem NF/Boleto)
- Situações onde o pagamento precisa ser feito antes de receber a documentação
- Aprovação explícita da Diretoria obrigatória
- Regularização documental posterior obrigatória com prazo

**Critérios de Aceite:**
- [ ] Aprovação da Diretoria registrada com motivo obrigatório
- [ ] Prazo para regularização definido no ato da aprovação
- [ ] Alerta automático de documentação pendente de regularização
- [ ] Relatório de pagamentos pendentes de regularização

## Tarefas Relacionadas
- [[TASK-013 - CP Workflow Aprovacao]]
