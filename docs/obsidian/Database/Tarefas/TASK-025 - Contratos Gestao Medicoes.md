---
tipo: tarefa
id: TASK-025
titulo: "Contratos — Gestão e Medições de Obra"
status: em-andamento
prioridade: alta
modulo: contratos
milestone: MS-010
sprint: Sprint-8
estimativa: 21
gasto: 13
data_inicio: 2026-03-03
data_fim: 2026-09-30
updated: 2026-04-08
tags: [tarefa, contratos, medicoes, boletim, aditivos, cronograma, ai, minuta, aprovacao]
---

# 🟡 TASK-025 — Contratos e Medições

## Descrição
Módulo completo de gestão de contratos: pipeline de 7 estágios com IA, geração de minutas, aprovações, boletins de medição, aditivos, cronograma físico-financeiro e integração com Financeiro.

## Entregas — Contratos v2 Pipeline (Concluído 2026-03-10)
- [x] Schema DB: con_contratos, con_contrato_itens, con_clientes, con_parcelas, con_parcela_anexos, con_solicitacoes, con_minutas
- [x] Pipeline de 7 estágios: solicitação → análise → melhorias → minuta → aprovação → assinatura → encerramento
- [x] Análise AI com Gemini Flash (avaliação de cláusulas, riscos, score 0-100)
- [x] Edição de melhorias: aceitar/rejeitar sugestões + adicionar cláusulas manuais
- [x] Geração de minuta formal com jsPDF (PDF nativo no browser)
- [x] Upload para Supabase Storage (bucket contratos-anexos)
- [x] Aprovação via AprovAi (tipo: minuta_contratual)
- [x] Executive summary + PDF attachment nos cards de aprovação
- [x] Cadastro de clientes + parcelas com controle de pagamento
- [x] Dashboard Contratos com pipeline visual
- [x] Hooks: useSolicitacoes, useContratos
- [x] Layout indigo theme com sidebar + mobile bottom nav

## Entregas Pendentes — Medições e Avançado
- [ ] Boletins de Medição (BM)
- [ ] Aditivos contratuais
- [ ] Cronograma físico-financeiro por contrato
- [ ] SLA e penalidades
- [ ] Reajustes (IGPM, IPCA)
- [ ] Integração Financeiro (faturamento por medição)
- [ ] Integração Controladoria (previsto vs realizado)

## Arquivos Chave
- `frontend/src/pages/contratos/PreparaMinuta.tsx` — Pipeline principal (1900+ linhas)
- `frontend/src/hooks/useSolicitacoes.ts` — Hooks de solicitação + n8n
- `frontend/src/hooks/useContratos.ts` — CRUD contratos/clientes/parcelas
- `frontend/src/hooks/useAprovacoes.ts` — Enrichment minuta_contratual
- `frontend/src/pages/AprovAi.tsx` — MinutaExecutiveSummary component

## Entregas Adicionais — Abr 2026
- [x] Fix #198: Correcao timezone datas de vigencia (T12:00:00)
- [x] Fix #200: Botao voltar no AprovAi em modo standalone/PWA
- [x] Fix #199: Resumo executivo em aprovacao mostra dados do contrato
- [x] Fix #185: Permissoes supervisores corrigidas (RBAC via modulo_papeis)
- [x] Regra R$2000: Servicos >R$2000 desviam para contratos automaticamente
- [x] Recomendacao AI: Motor multi-criterio para selecao de fornecedores em cotacoes
- [x] Permissoes supervisor: Gerenciar modelos, executar acoes em contratos

## Links
- [[MS-010 - Modulo Contratos Medicoes]]
- [[12 - Fluxo Aprovação]]
- [[27 - Módulo Contratos Gestão]]
- [[Requisitos/PLAN-CONTRATOS-v2]]
