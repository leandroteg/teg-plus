---
tipo: requisito
id: REQ-013
titulo: "Relatórios Operacionais — Pagamentos e Recebimentos"
categoria: funcional
prioridade: alta
status: planejado
modulo: financeiro
sprint: Sprint-5
milestone: MS-004
tags: [requisito, financeiro, relatorios, operacional, fluxo-caixa]
---

# 📋 REQ-013 — Relatórios Operacionais — Pagamentos e Recebimentos

## Descrição
Relatórios táticos e operacionais para controle diário/semanal/mensal do financeiro. Devem ser disponíveis para equipe financeira, Controladoria e Diretoria, respeitando alçadas de visualização.

## Critérios de Aceite

### Pagamentos
- [ ] **Pagamentos previstos** com filtro por dia / semana / mês
- [ ] **Pagamentos realizados** filtráveis por: natureza financeira, classe, centro de custo, projeto
- [ ] Exportação para Excel/PDF
- [ ] Geração disponível para Controladoria sem precisar acionar TI

### Recebimentos
- [ ] **Recebimentos previstos** com filtro por dia / semana / mês
- [ ] **Recebimentos realizados** por natureza e projeto
- [ ] Conciliação de recebimentos com títulos a receber

### Integração com Obras
- [ ] Apontamento de custos por obra (integração com sistema de gestão de obras)
- [ ] Relatório previsto × realizado por obra / projeto

### Acesso e Exportação
- [ ] Banco de dados acessível para geração de relatórios e dashboards personalizados
- [ ] Suprimentos consegue acessar comprovantes de pagamento de seus POs
- [ ] Contabilidade acessa histórico de NFs e conciliação

## Tarefas Relacionadas
- [[TASK-016 - Relatorios Financeiros]]
