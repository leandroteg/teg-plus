---
tipo: milestone
id: MS-004
titulo: "Módulo Financeiro — Omie como Core"
status: em-andamento
fase: Q2-2026
data_alvo: 2026-09-30
progresso: 70
updated: 2026-03-10
modulo: financeiro
tags: [milestone, financeiro, omie, nfe, dre, conciliacao, aprovacao]
---

# 🗺️ MS-004 — Módulo Financeiro

## Visão Geral
Lançamento do módulo financeiro do TEG+ com o **Omie como módulo central**.

> **Decisão Arquitetural — Opção A Adotada:**
> Interface própria do TEG+ + API Omie no back (front TEG+, dados Omie).
> Frontend implementado com 7 telas + layout + sidebar dedicado.

## Implementação Atual (Sprint-4)
- [x] Schema PostgreSQL completo (migrations 013 + 014)
- [x] TypeScript types e React Query hooks
- [x] Layout com sidebar (emerald theme) + mobile bottom nav
- [x] Contas a Pagar (lista, filtros, busca, badges, registrar pagamento)
- [x] Contas a Receber (lista, filtros, vencidos)
- [x] Fornecedores (cadastro, sync Omie)
- [x] Configurações (credenciais Omie, toggle, status de sync)
- [x] SyncBar em CP, CR e Fornecedores
- [x] Integração Omie — 4 squads n8n funcionais (TASK-009 ✅)
- [x] Fluxo Compras → Financeiro: trigger PO → CP → liberar → pago (TASK-013 parcial)
- [x] Upload de NF/comprovante no módulo Compras e Financeiro
- [x] Comprovante de pagamento visível ao comprador

## Objetivos do Módulo
| Objetivo | Descrição |
|----------|-----------|
| 🏛️ Governança | Controle total de pagamentos, recebimentos e tesouraria — pagar somente o que deve ser pago, sem erros, no prazo |
| ⚡ Produtividade | Centenas/milhares de pagamentos com a equipe atual sem sobrecarga |
| 📈 Previsibilidade | Fluxo de caixa, projeções de pagamentos e recebimentos |
| 🔍 Rastreabilidade | Custos e receitas por classe, centro de custo, projeto, área |

## Critérios de Sucesso
- [x] Sistema disponível com ótima velocidade de carregamento
- [ ] Equipe opera sem recorrer à TI
- [ ] Sistema sempre atualizado (conciliações, baixas, lançamentos)
- [x] Poucos cliques por operação, poucos lançamentos manuais
- [ ] **99,8%** dos pagamentos seguindo o fluxo previsto com toda documentação

## Tarefas
| ID | Tarefa | Status |
|----|--------|--------|
| [[TASK-009 - Integracao Omie\|TASK-009]] | Integração Omie ERP | ✅ concluído |
| [[TASK-013 - CP Workflow Aprovacao\|TASK-013]] | CP — Workflow de Aprovação e Documentos | 🟡 parcial (core done, exceções pendentes) |
| [[TASK-014 - Conciliacao Remessa Bancaria\|TASK-014]] | Conciliação e Remessa Bancária | 🟡 em andamento (UI pronta) |
| [[TASK-015 - Emissao Recebimento NFe\|TASK-015]] | Emissão e Recebimento de NF-e/NFS-e | ⬜ backlog |
| [[TASK-016 - Relatorios Financeiros\|TASK-016]] | Relatórios DRE, DFC, BP, Fluxo de Caixa | 🟡 parcial (DRE/Fluxo/CC/Aging UI prontos) |
| [[TASK-017 - Acesso Alcadas Financeiro\|TASK-017]] | Controle de Acesso por Alçadas | 🟡 parcial (AprovAi com 4 tipos) |
| [[TASK-018 - Integracao RH Folha\|TASK-018]] | Integração RH — Folha de Pagamento | ⬜ backlog |

## Requisitos
| ID | Requisito | Prioridade |
|----|-----------|-----------|
| [[REQ-006 - Integracao Omie\|REQ-006]] | Integração Financeira Omie ERP | 🟠 Alta |
| [[REQ-008 - Contas a Pagar Fluxo Omie\|REQ-008]] | Contas a Pagar — Fluxo Completo | 🔴 Crítica |
| [[REQ-009 - Aprovacao Pagamentos Diretoria\|REQ-009]] | Aprovação de Pagamentos — Alçada Diretoria | 🔴 Crítica |
| [[REQ-010 - Conciliacao e Remessa Bancaria\|REQ-010]] | Conciliação e Remessa Bancária | 🔴 Crítica |
| [[REQ-011 - Emissao NF-e NFS-e\|REQ-011]] | Emissão NF-e e NFS-e | 🔴 Crítica |
| [[REQ-012 - Contas a Receber e NF Entrada\|REQ-012]] | Contas a Receber e NF de Entrada | 🟠 Alta |
| [[REQ-013 - Relatorios Operacionais Caixa\|REQ-013]] | Relatórios Operacionais | 🟠 Alta |
| [[REQ-014 - Relatorios Estrategicos DRE DFC BP\|REQ-014]] | DRE, DFC, BP, Fluxo de Caixa Previsto | 🟠 Alta |
| [[REQ-015 - Integracoes Internas Financeiro\|REQ-015]] | Integrações Internas (Compras, RH, Controladoria) | 🔴 Crítica |
| [[REQ-016 - Excecoes de Pagamento\|REQ-016]] | Exceções ao Processo de Pagamento | 🟡 Média |
| [[REQ-017 - API Aberta Agentes IA\|REQ-017]] | API Aberta para Agentes de IA | 🟠 Alta |
| [[REQ-018 - Controle de Acesso Alcadas\|REQ-018]] | Controle de Acesso por Alçadas | 🟠 Alta |

## Integrações Externas
| Integração | Prioridade | Status |
|------------|-----------|--------|
| Remessa bancária (CNAB 240/480) | Obrigatória | 🟡 UI pronta |
| Conciliação bancária (OFX / Open Banking) | Obrigatória | 🟡 UI pronta |
| SEFAZ — NF-e | Obrigatória | ⬜ backlog |
| Prefeitura — NFS-e | Obrigatória | ⬜ backlog |
| Receita Federal — CNPJ lookup | Importante | ⬜ backlog |
| Gestão de Obras (previsto × realizado) | Importante | ⬜ backlog |
| Contabilidade externa | Importante | ⬜ backlog |

## Notas (2026-03-10)
- CP approval flow wired into apr_aprovacoes via syncCPsParaAprovacao
- AprovAi (Centro de Aprovacoes) implementado com 4 tipos: cotacao, autorizacao_pagamento, minuta_contratual, requisicao_compra
- ApprovalBadge no header global para admin users
- Telas CP, CR, Aprovacoes, Conciliacao, Relatorios, Fornecedores todas operacionais
- Pendente: integracao SEFAZ, remessa bancaria real, exceções de pagamento, RBAC completo

## Progresso
`███████░░░` 70%
