---
tipo: milestone
id: MS-012
titulo: "Controladoria e BI — Visão Executiva"
status: em-andamento
fase: Q1-2026
data_alvo: 2026-06-30
progresso: 75
updated: 2026-03-11
modulo: controladoria
tags: [milestone, controladoria, bi, dre, orcado, realizado]
---

# 🗺️ MS-012 — Controladoria e BI

## Visão Geral
Visão financeira consolidada para a diretoria: orçado vs realizado por obra, DRE consolidado, centro de custo, forecast de caixa, EBITDA e dashboard executivo.

## Estado Atual (2026-03-11)

### Frontend Implementado — 9 Páginas Operacionais
- [x] **ControladoriaHome** — Dashboard consolidado com KPIs
- [x] **Orcamentos** — Gestão de orçamentos por obra (CRUD completo)
- [x] **DRE** — Demonstrativo de Resultado do Exercício
- [x] **KPIs** — Painel de indicadores com múltiplos tipos
- [x] **Cenarios** — Análise de cenários (what-if)
- [x] **PlanoOrcamentario** — Plano orçamentário por período
- [x] **ControleOrcamentario** — Controle orçado vs realizado
- [x] **PainelIndicadores** — Painel de indicadores executivo
- [x] **AlertasDesvio** — Alertas de desvio com severidade

### API e Backend
- [x] Integração real com Supabase (queries diretas)
- [x] CRUD completo para orçamentos, KPIs, cenários, alertas
- [x] Análise de custo por obra
- [x] Layout Controladoria com sidebar

### Pendências
- [ ] DRE consolidado multi-obra
- [ ] Fluxo de caixa previsto (30/60/90 dias)
- [ ] EBITDA e margens consolidadas
- [ ] Drill-down por obra/período avançado
- [ ] Exportação para contabilidade
- [ ] Integração profunda com Financeiro (dados CP/CR reais)
- [ ] Integração RH (custo mão de obra)
- [ ] Integração Contratos (medições previstas)

## Dependências
- Financeiro (dados de CP, CR, DRE)
- RH (custo de mão de obra)
- Contratos (medições, previsto)
- Compras (custo de materiais)

## Tarefas
| ID | Tarefa | Status |
|----|--------|--------|
| [[TASK-029 - Controladoria DRE\|TASK-029]] | DRE Consolidado e Orçado vs Realizado | 🟡 parcial |

## Progresso
`███████░░░` 75%
