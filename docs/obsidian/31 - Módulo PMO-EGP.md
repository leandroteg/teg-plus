---
title: Módulo PMO/EGP — Escritório de Gestão de Projetos
type: modulo
modulo: pmo
status: ativo
tags: [pmo, egp, portfolio, eap, cronograma, medicoes, gestao-projetos, riscos, custos, histograma, osc, ia]
criado: 2026-03-12
atualizado: 2026-06-26
relacionado: ["[[PILAR - Projetos]]", "[[27 - Módulo Contratos Gestão]]", "[[32 - Módulo Obras]]", "[[30 - Módulo Controladoria]]", "[[03 - Páginas e Rotas]]"]
---

# Módulo PMO/EGP — Escritório de Gestão de Projetos

> Gerenciamento completo do portfólio de obras da TEG com visão física-financeira por ciclo de vida PMBOK: EAP, cronograma, histograma de recursos, custos realizado vs. orçado, medições OSC, análise de riscos via IA e indicadores.

---

## Visão Geral

O módulo EGP (`/egp`) centraliza a gestão técnica e financeira do portfólio de obras. Cada portfólio (obra) é navegado pelo **ciclo de vida PMBOK em 5 fases**, cada uma com suas próprias abas de trabalho. Um seletor persistente de portfólio no topo mantém o contexto entre páginas.

---

## Estrutura de Rotas

| Rota | Componente | Abas disponíveis |
|------|-----------|-----------------|
| `/egp` | `EGPPainel` / `EGPPainelMobile` | Painel executivo do portfólio |
| `/egp/iniciacao/:id?` | `EGPIniciacao` | TAP, Stakeholders, Viabilidade |
| `/egp/planejamento/:id?` | `EGPPlanejamento` | EAP · Cronograma · Histograma · Custos · Medição · Riscos |
| `/egp/controle/:id?` | `EGPControle` | Medições · Eventos · Status Report · Indicadores |
| `/egp/encerramento/:id?` | `EGPEncerramento` | Lições aprendidas, aceite, desmobilização |
| `/egp/portfolio` | `Portfolio` | Lista de todos os portfólios |
| `/egp/portfolio/novo` | `NovoPortfolio` | Criar portfólio |
| `/egp/portfolio/:id` | `PortfolioDetalhe` | Detalhe do portfólio |

> **Redirects legados:** `/egp/tap`, `/egp/eap`, `/egp/cronograma`, `/egp/histograma`, `/egp/custos`, `/egp/medicoes` → redirecionam para a fase correspondente (sem quebrar bookmarks antigos).

---

## Fase: Planejamento (`EGPPlanejamento.tsx`)

Maior tela do módulo. Abas em tab-bar colorida:

| Aba | Descrição |
|-----|-----------|
| **EAP** | Estrutura Analítica do Projeto (WBS) — árvore hierárquica gerada ou editada manualmente; botão "Gerar via IA" |
| **Cronograma** | Gantt de tarefas com datas, durações, dependências e % de avanço físico; geração por IA |
| **Histograma** | Histograma de recursos: efetivo real do RH (base → frente) + máquinas (fro_veiculos); engine `cronogramaEngine.ts` |
| **Custos** | Base (80% contrato × 7 naturezas) · Projetado (×% físico) · Realizado (via `fin_legado_custos`, mapeamento `grupo_dre → natureza`); R$ 12,2 mi lidos do legado |
| **Medição** | OSCs: lista de boletins importados via PDF (SuperTEG `/osc/parse`); itens normalizados na EAP + faturado por OSC |
| **Riscos** | Matriz 5×5 probabilidade × impacto; CRUD; agrupamento frente/obra; análise incremental por IA (edge `egp-riscos-analisar` → n8n → SuperTEG → callback grava) |

### Histograma — detalhe

- Fonte RH: `rh_colaboradores` filtrado por `base_id` (base → frente TEG); cargo → grupo de recursos
- Fonte frota: `fro_veiculos` (tipo_ativo = 'maquina'), alocações ativas por obra
- Limitação conhecida: colaboradores sem `obra_id` direto (só `base_id`); Uberlândia/Comendador Gomes sem base cadastrada

### Custos — detalhe

- **Base:** 80% do valor do contrato rateado em 7 naturezas (MO, Material, Equip., Subcontrat., etc.)
- **Projetado:** Base × % físico do cronograma
- **Realizado:** consulta `fin_legado_custos` (totvs + nibo, 31.312 linhas, R$ 95,2 mi total); mapeamento `grupo_dre → natureza`
- Observação: folha de pagamento não está no `fin_legado_custos` → MO realizado aparece baixo

### Riscos — detalhe

- Análise via IA: botão "Analisar" → edge function `egp-riscos-analisar` → n8n workflow "EGP - Riscos AI" (ativo) → SuperTEG `/chat` → callback grava análise na tabela
- Análise incremental: apenas riscos sem análise prévia são enviados por vez
- Resultado salvo como texto livre na coluna `analise_ia`

### OSC / Medição — detalhe

- Parse de PDF via SuperTEG (`/osc/parse`): extrai OSC, itens, valores acumulados
- Backfill automático: 107 OSCs processadas (652 itens normalizados + "Outros")
- Faturado por OSC: lê coluna "Acum" → calcula valor-saldo por boletim
- Rota de medição dentro de Planejamento; rota `/egp/medicoes` redireciona aqui

---

## Fase: Controle (`EGPControle.tsx`)

| Aba | Descrição |
|-----|-----------|
| **Medições** | Boletins de medição por portfólio (BM) — itens medidos, valores, aprovação |
| **Eventos** | Alertas e eventos contratuais (prazo, multas, paralisações) |
| **Status Report** | Relatório periódico: KPIs físico-financeiros, semáforo de risco |
| **Indicadores** | CPI, SPI, curva S, projeções de término |

---

## Painel Executivo (`EGPPainel.tsx`)

Dashboard do portfólio com:
- KPIs consolidados: Obras em andamento · Valor total · Margem média · Progresso físico
- Lista de portfólios com status, progresso, valor OSC, custo real e margem
- **Aba Produção:** check-ins mensais da meta de produção (SGI); dados sourced do EGP
- Registrado no hub `/paineis` (pilar Projetos)

---

## Schema do Banco

Prefixo: `pmo_`

| Tabela | Descrição |
|--------|-----------|
| `pmo_portfolios` | Portfólios/obras com dados gerenciais e financeiros |
| `pmo_tap` | Termo de Abertura do Projeto |
| `pmo_eap` | Estrutura Analítica — nós da árvore |
| `pmo_eap_itens` | Pacotes de trabalho e entregáveis |
| `pmo_cronograma` | Tarefas / atividades do Gantt |
| `pmo_medicoes` | Boletins de medição (BM) |
| `pmo_medicao_itens` | Itens de cada BM |
| `pmo_histograma` | Alocação de recursos por período |
| `pmo_orcamento` | Orçamento por natureza (7 linhas) |
| `pmo_riscos` | Riscos: probabilidade, impacto, analise_ia |
| `pmo_reunioes` | Atas e deliberações |
| `pmo_reuniao_acoes` | Ações resultantes de reuniões |
| `pmo_status_reports` | Status reports periódicos |
| `pmo_multas` | Registro de multas contratuais |
| `pmo_mudancas` | Mudanças de escopo/prazo/custo |
| `egp_tap` | TAPs gerados/editados (tabela separada da pmo_tap legacy) |
| `egp_osc` | OSCs importadas via PDF |
| `egp_osc_itens` | Itens normalizados das OSCs |

---

## Hooks (`src/hooks/usePMO.ts` + `useEGP.ts`)

| Hook | Responsabilidade |
|------|------------------|
| `usePortfolios()` | Lista portfólios com KPIs |
| `usePortfolioDetalhe(id)` | Detalhe completo |
| `useTAP(id)` | TAP do portfólio |
| `useEAP(id)` | Árvore EAP |
| `useCronograma(id)` | Tarefas Gantt |
| `useHistograma(id)` | Histograma de recursos |
| `useControleCustos(id)` | Orçado vs realizado |
| `useRiscos(id)` | Riscos do portfólio |
| `useMedicaoPorOSC(id)` | Medições via OSC importada |
| `useOSCItens(oscId)` | Itens de uma OSC |
| `useReunioes(id?)` | Atas |
| `useStatusReports(id?)` | Status reports |

---

## Integração com Outros Módulos

| Módulo | Integração |
|--------|-----------|
| **Financeiro (legado)** | `fin_legado_custos` alimenta aba Custos (Realizado) |
| **Contratos** | Valor do contrato base do orçamento EGP |
| **Obras** | `obr_planejamento_equipe` lido pelo Histograma de Recursos |
| **RH** | `rh_colaboradores` (base_id → frente) alimenta Histograma |
| **Frotas** | `fro_veiculos` (máquinas) aparece no Histograma |
| **SGI/Governança** | Aba Produção do painel EGP serve de fonte para check-ins de meta no SGI |
| **n8n/SuperTEG** | Análise de riscos via IA + parse de OSC em PDF |
| **Painéis** | `EGPPainel` registrado no hub `/paineis` |

---

## Fases do Ciclo de Vida (PMBOK)

1. **Iniciação** — TAP, análise de viabilidade, stakeholders
2. **Planejamento** — EAP, cronograma, histograma, orçamento, medição OSC, riscos
3. **Execução** → *redirect para Planejamento* (execução acompanhada pelas abas de Planejamento)
4. **Controle** — Status reports, KPIs (CPI/SPI), medições, eventos
5. **Encerramento** — Lições aprendidas, aceite final, desmobilização

---

## Links Relacionados

- [[03 - Páginas e Rotas]] — Rotas do módulo
- [[30 - Módulo Controladoria]] — Orçado vs realizado
- [[32 - Módulo Obras]] — Equipe e apontamentos de campo
- [[49 - SuperTEG AI Agent]] — Parse OSC e análise de riscos
- [[51 - Módulo Governança SGI]] — Check-ins de produção
