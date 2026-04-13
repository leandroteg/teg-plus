---
tipo: milestone
id: MS-008
titulo: "Módulo RH Completo — Colaboradores, Ponto, Folha"
status: em-andamento
fase: Q2-2026
data_alvo: 2026-06-30
progresso: 15
updated: 2026-04-10
modulo: rh
tags: [milestone, rh, colaboradores, ponto, folha, esocial]
---

# 🗺️ MS-008 — Módulo RH Completo

## Visão Geral
Construção completa do módulo de Recursos Humanos: cadastro de colaboradores, ponto eletrônico, HHt (homem-hora por obra), folha de pagamento, férias/afastamentos, ASO e integração eSocial.

> **Pré-requisito entregue:** Mural de Recados (gestão admin de banners).

## Entregas Planejadas

### Backend (Schema)
- [ ] Tabela `rh_colaboradores` — cadastro completo
- [ ] Tabela `rh_cargos` — cargos e salários
- [ ] Tabela `rh_departamentos` — organograma
- [ ] Tabela `rh_ponto` — registros de ponto
- [ ] Tabela `rh_hht` — homem-hora por obra
- [ ] Tabela `rh_ferias` — férias e afastamentos
- [ ] Tabela `rh_folha` — folha de pagamento
- [ ] Tabela `rh_aso` — exames médicos
- [ ] RLS policies para todas as tabelas
- [ ] Triggers de validação

### Frontend
- [x] Layout RH (sidebar dedicada)
- [x] Headcount — quadro de colaboradores por obra/cargo
- [x] Cultura — mural de recados, banners corporativos
- [ ] Página Colaboradores (CRUD completo)
- [ ] Página Ponto Eletrônico
- [ ] Página HHt (PWA mobile-first)
- [ ] Página Folha de Pagamento
- [ ] Página Férias e Afastamentos
- [ ] Dashboard RH com KPIs

### Integrações
- [ ] eSocial (eventos S-2200, S-2300, S-2206)
- [ ] Financeiro (folha → CP)
- [ ] SSMA (ASO, treinamentos)

## Tarefas
| ID | Tarefa | Status |
|----|--------|--------|
| [[TASK-021 - RH Cadastro Ponto\|TASK-021]] | Cadastro de Colaboradores e Ponto | ⬜ backlog |
| [[TASK-022 - RH Folha Ferias\|TASK-022]] | Folha de Pagamento e Férias | ⬜ backlog |
| [[TASK-010 - HHt App\|TASK-010]] | HHt App — Homem-hora | 🔵 em andamento |
| [[TASK-018 - Integracao RH Folha\|TASK-018]] | Integração RH → Folha Financeiro | ⬜ backlog |

## Estado Atual (2026-04-10)
- **Headcount** implementado com visualização por obra e cargo
- **Cultura/Mural** operacional com banners e gestão admin
- Demais módulos (ponto, folha, férias, HHt) ainda não iniciados

## Progresso
`██░░░░░░░░` 15%
