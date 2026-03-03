---
tipo: requisito
id: REQ-018
titulo: "Controle de Acesso por Alçadas — Módulo Financeiro"
categoria: nao-funcional
prioridade: alta
status: planejado
modulo: financeiro
sprint: Sprint-4
milestone: MS-004
tags: [requisito, financeiro, acesso, alcadas, usuarios, permissoes]
---

# 📋 REQ-018 — Controle de Acesso por Alçadas

## Descrição
O módulo financeiro é acessado por perfis distintos com permissões diferentes. A equipe financeira opera, os demais visualizam conforme suas alçadas.

## Perfis e Permissões

| Perfil | Módulo | Permissão |
|--------|--------|-----------|
| Equipe Financeira | Todos os submodulos financeiros | Operar (criar, editar, executar) |
| Diretor Presidente (Laucídio) | Aprovações | Aprovar / Reprovar |
| Contratos / Suprimentos | Comprovantes e status de POs | Visualizar (somente leitura) |
| Controladoria | Relatórios, DRE, DFC, extrato | Visualizar + Exportar |
| Diretoria | Dashboard e relatórios executivos | Visualizar |
| RH | Remessa de folha | Submeter remessa |
| Contabilidade | NFs, conciliação, histórico | Visualizar + Exportar |

## Critérios de Aceite
- [ ] Perfis de acesso configuráveis sem deploy (via painel admin)
- [ ] Usuário vê apenas o que seu perfil permite
- [ ] Tentativas de acesso não autorizado registradas em log de auditoria
- [ ] Diretoria e Controladoria acessam relatórios sem acionar TI
- [ ] Suprimentos visualiza comprovante de pagamento do seu PO sem ver dados de outros POs
- [ ] Equipe financeira opera com produtividade: poucos cliques, sem sobrecarga

## Critérios de Sucesso Ligados a este Requisito
- Equipe sabe utilizar o sistema, recorrendo raramente à TI
- 99,8% dos pagamentos seguindo o fluxo previsto com toda documentação

## Tarefas Relacionadas
- [[TASK-017 - Acesso Alcadas Financeiro]]
