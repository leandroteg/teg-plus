# EGP — Redesign Ciclo de Vida em 6 Visões

> **Data**: 2026-04-06
> **Status**: Design aprovado
> **Módulo**: EGP (Escritório de Gestão de Projetos)

## Contexto

O módulo EGP hoje tem 11 itens no nav (Painel, Portfólio, TAP, EAP, Cronograma, Medições, Histograma, Custos, Fluxo OS, Reuniões, Indicadores). Precisa ser reorganizado em 6 visões que espelham o ciclo de vida real da OSC, com sub-abas em fluxo dentro de cada visão.

## Fluxo de Negócio

```
Contrato assinado → OSCs emitidas → Cadastra OSC (vincula obra + polo)
→ Dados preenchidos por OSC/obra → Portfólio consolida tudo
```

Ciclo de vida da OSC (fases 3→4→5 se repetem mensalmente):
```
Nova OSC → 1.Iniciação → 2.Planejamento → 3.Detal.Mensal → 4.Execução → 5.Monitoramento → 6.Eventos → 7.Medições → 8.Encerramento
```

## Navegação Final

```
📊 Painel | 🚀 Iniciação | 📐 Planejamento | ⚡ Execução | 📈 Controle | ✅ Encerramento
```

Rota base: `/egp`

---

## 1. Painel (`/egp`)

Dashboard consolidado — mesmo modelo visual do Dashboard de Compras (SpotlightMetric + MiniInfoCard + HorizontalStatusBar).

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Painel — EGP                    [Polo ▾] [Atualizar]    │
├───────────────────────────────────┬─────────────────────┤
│ Núcleo EGP (1.52fr)              │ Janela Crítica      │
│ ┌──────────┬──────────┬────────┐ │ (0.88fr)            │
│ │ Avanço   │ Prazo    │ Custo  │ │ ┌─────────┬───────┐ │
│ │ Físico   │ Médio    │ Real   │ │ │ Riscos  │Recurs.│ │
│ │ 67.2%    │ -12 dias │ R$4.2M │ │ │Críticos │Crít.  │ │
│ │ tone:teal│tone:amber│tone:sky│ │ │ 3       │ 2     │ │
│ └──────────┴──────────┴────────┘ │ ├─────────┼───────┤ │
│                                   │ │ Ações   │Multas │ │
│                                   │ │Críticas │Ativas │ │
│                                   │ │ 5       │ 1     │ │
│                                   │ └─────────┴───────┘ │
├───────────────────────────────────┴─────────────────────┤
│ Pulso por Status (HorizontalStatusBar)                  │
│ [Em Aprovação 3] [A Iniciar 5] [Em Andamento 8] [...]   │
├─────────────────────────────────────────────────────────┤
│ OSCs Críticas (2 colunas)                               │
│ ┌──────────────────────┐ ┌────────────────────────────┐ │
│ │ Atrasadas (red)      │ │ SPI < 0.85 (amber)        │ │
│ │ • LD-01 Montes..     │ │ • LD-05 Uberlân...        │ │
│ │ • LD-03 Araguari     │ │ • DC-01 Paracatu          │ │
│ └──────────────────────┘ └────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Por Polo / Obra (barras horizontais)                    │
│ Polo 1 — Triângulo    ████████████░░  R$ 12.5M         │
│ Polo 2 — Alto Paranaí ██████░░░░░░░  R$ 8.2M           │
│ ...                                                     │
├─────────────────────────────────────────────────────────┤
│ Recentes (últimas 8 atualizações)                       │
│ • LD-01: Medição #5 aprovada — há 2h                    │
│ • LD-03: Risco crítico adicionado — há 5h               │
└─────────────────────────────────────────────────────────┘
```

### KPIs (SpotlightMetric)

| KPI | Cálculo | Tone |
|-----|---------|------|
| Avanço Físico | Média ponderada `pmo_indicadores_snapshot.pct_valor_executado` | teal |
| Prazo | Dias de desvio médio (término previsto vs previsão atual) | amber/emerald (condicional) |
| Custo Real | Soma `pmo_portfolio.custo_real` do portfólio filtrado | sky |

### MiniInfoCards (Janela Crítica)

| Card | Fonte | Ícone |
|------|-------|-------|
| Riscos Críticos | `pmo_indicadores_snapshot` onde riscos = alto/critico | AlertTriangle (red) |
| Recursos Críticos | Histograma onde `real < planejado * 0.7` | Users (amber) |
| Ações Críticas | `pmo_mudancas` + plano de ação com status pendente e prazo vencido | Zap (red) |
| Multas Ativas | `pmo_multas` status IN (notificada, contestada, confirmada) | Scale (amber) |

### Dados

- Fonte principal: `vw_pmo_portfolio_resumo` + `pmo_indicadores_snapshot`
- Filtros: Polo (obra.polo), Status, Tipo OSC
- Atualização: TanStack Query com staleTime 30s

---

## 2. Iniciação (`/egp/iniciacao`)

Hub: grid de OSCs → clica → `/egp/iniciacao/:portfolioId`

### Sub-abas

```
[TAP] → [Stakeholders] → [Comunicação]
```

#### 2.1 TAP
- Formulário completo do Termo de Abertura (reusa `TapPage.tsx` existente)
- Botão "Gerar com IA" puxa dados do contrato assinado (con_contratos)
- Campos: identificação, objetivo, escopo, premissas, restrições, riscos, marcos, orçamento, equipe, aprovação
- Classificação: urgência, complexidade, faturamento, duração
- Status: `rascunho → em_aprovacao → aprovado → rejeitado`
- **Integração**: Contratos → quando `con_contratos.status = 'assinado'`, notifica EGP

#### 2.2 Stakeholders
- Tabela editável: nome, papel, organização, influência (alta/média/baixa), estratégia de engajamento
- Nova tabela: `pmo_stakeholders`

#### 2.3 Comunicação
- Plano de comunicação: o quê, para quem, frequência, canal, responsável
- Rotina do contrato: calendário de entregas obrigatórias
- Nova tabela: `pmo_comunicacao`

### Frequência: Preenchimento único na abertura da OSC

---

## 3. Planejamento (`/egp/planejamento`)

Hub: grid de OSCs → `/egp/planejamento/:portfolioId`

### Sub-abas

```
[EAP] → [Cronograma] → [Histograma] → [Orçamento] → [Riscos]
```

#### 3.1 EAP
- Reusa `EAP.tsx` existente
- Hierarquia: fase → entregável → subitem
- Geração com IA a partir do TAP
- Campos: código, título, fase, tipo_serviço, responsável, entregáveis, peso_%

#### 3.2 Cronograma
- Cronograma Macro (Gantt mensal) + Detalhado com datas reais
- Reusa `Cronograma.tsx` + dados de `pmo_tarefas`
- **Integração saída**: Publica atividades planejadas → aparecem no RDO (módulo Obras)
- **Ação 1 clique**: Atividade que precisa de material → "Solicitar Compra" → abre wizard Requisição pré-preenchido (obra, CC, itens da atividade)
- **Integração entrada**: Apontamentos do RDO atualizam % real e previsão de conclusão

#### 3.3 Histograma
- Reusa `Histograma.tsx`
- MO direta/indireta + maquinário por mês
- Planejado vs Real
- Tabela `pmo_histograma`

#### 3.4 Orçamento
- Orçamento detalhado por disciplina/insumo/fase
- Base para controle de custos ao longo do contrato
- Nova tabela: `pmo_orcamento`

#### 3.5 Riscos
- Mapeamento: probabilidade × impacto → criticidade
- Campos: descrição, categoria, probabilidade, impacto, resposta, responsável, status
- Tabela existente via `pmo_indicadores_snapshot.dados_extras` ou nova `pmo_riscos`

### Frequência: Único (setup) + Riscos revisados mensalmente

---

## 4. Execução (`/egp/execucao`)

O ciclo mensal recorrente — onde EGP atualiza o plano e dispara necessidades para outras áreas.

Hub: grid de OSCs → `/egp/execucao/:portfolioId`

### Sub-abas

```
[Cronograma] → [Histograma] → [Custos] → [Riscos] → [Plano de Ação]
```

#### 4.1 Cronograma (Gestão do Cronograma)
- Cronograma Detalhado: atualização mensal de datas reais, % avanço, previsão de conclusão
- Diferente do Cronograma Macro (Planejamento): aqui é o **acompanhamento** mês a mês
- Reusa `pmo_tarefas` com foco em `data_inicio_real`, `data_termino_real`, `percentual_concluido`
- **Integração saída → Obras**: Publica atividades planejadas do mês → aparecem no RDO como "a reportar"
- **Integração entrada ← Obras**: Apontamentos do RDO atualizam % real + previsão de conclusão
- **Ação 1 clique → Compras**: Atividade que precisa de material → "Solicitar Compra" → abre wizard Requisição pré-preenchido (obra, CC, itens)
- **Ação 1 clique → Logística**: "Solicitar Transporte" → abre Solicitação de Transporte pré-preenchida
- **Ação 1 clique → Contratos**: "Solicitar Contratação" → abre Solicitação de Contrato pré-preenchida

#### 4.2 Histograma (Gestão de Recursos)
- Atualização mensal: quantidade real de MO e maquinário vs planejado
- Identificação de recursos críticos (real << planejado)
- Reusa `pmo_histograma`
- **Ação 1 clique → RH/Mobilização**: "Solicitar Mobilização" quando recurso abaixo do planejado

#### 4.3 Custos (Gestão de Custos)
- Custo planejado vs executado por mês, delta, previsão de custo final
- IDC (Índice de Desempenho de Custo)
- Reusa `ControleCustos.tsx` + `pmo_portfolio`
- **Integração ← Financeiro**: Puxa CPs pagas vinculadas à OSC (`fin_contas_pagar WHERE obra_id`)

#### 4.4 Riscos (Gestão de Riscos)
- Revisão mensal: novos riscos, reclassificação, fechamento
- Matriz probabilidade × impacto → criticidade
- Nova tabela: `pmo_riscos`

#### 4.5 Plano de Ação
- Ações corretivas de desvios identificados no ciclo mensal
- Campos: descrição, tipo_desvio, responsável, prazo, status, evidência
- Nova tabela: `pmo_plano_acao`

### Frequência: Mensal (ciclo recorrente — Fases 3→4→5 da metodologia)
### Fluxo: Atualizar cronograma → conferir recursos → apurar custos → revisar riscos → registrar ações

---

## 5. Controle (`/egp/controle`)

O que vem da contratante e do campo — medições, pleitos, report executivo.

Hub: grid de OSCs → `/egp/controle/:portfolioId`

### Sub-abas

```
[Medições] → [Eventos] → [Status Report] → [Indicadores]
```

#### 5.1 Medições
- Medição contratual: plan vs executado por período, itens de medição
- Reusa `Medicoes.tsx` + `pmo_medicao_*`
- **Integração ← Obras**: Medições enviadas pelo campo aparecem aqui para validação
- **Integração → Contratos**: Valores medidos alimentam controle contratual
- Botão "Solicitar Faturamento" → gera `fis_solicitacoes_nf` no Fiscal

#### 5.2 Eventos
- **Mudanças**: Solicitações de alteração contratual (escopo, prazo, custo) — reusa `pmo_mudancas`
- **Multas**: Penalidades recebidas, valor, prazo de defesa, status — reusa `pmo_multas`
- **Pleitos**: Reivindicações formais, valor pleiteado vs aprovado, ações — lógica nova ou extensão de mudanças

#### 5.3 Status Report
- Relatório executivo periódico: OS totais, faturamento, delta, riscos, multas
- Reusa `pmo_status_report` + `StatusReportList.tsx`
- Frequência: mensal ou sob demanda

#### 5.4 Indicadores
- Dashboard de performance: SPI, CPI, IDC, IDP
- Produção mensal, taxa de frequência, horas trabalhadas, acidentes
- Reusa `pmo_indicadores_snapshot`
- Snapshot histórico com evolução temporal

### Frequência: Mensal (Medições, Indicadores, Status Report) + Sob demanda (Eventos)

---

## 6. Encerramento (`/egp/encerramento`)

Hub: grid de OSCs → `/egp/encerramento/:portfolioId`

### Sub-abas

```
[Status Report] → [Lições Aprendidas] → [Aceite] → [Desmobilização]
```

#### 6.1 Status Report
- Relatório executivo final: OS totais, faturamento, delta, riscos residuais
- Reusa `pmo_status_report` + `StatusReportList.tsx`

#### 6.2 Lições Aprendidas
- Registro estruturado: fase, o que funcionou, o que não funcionou, recomendação
- Nova tabela: `pmo_licoes_aprendidas`

#### 6.3 Aceite
- Termo de aceite formal com assinatura digital (Certisign)
- Nova tabela: `pmo_aceite`
- **Integração**: Vincula ao encerramento do contrato (`con_contratos`)

#### 6.4 Desmobilização
- Checklist: devolução equipamentos, materiais, documentos, baixas
- Nova tabela: `pmo_desmobilizacao`
- **Integração**: Estoque (baixa patrimonial) + Logística (transporte retorno)

### Frequência: Único (fim da OSC)

---

## Integrações

| Direção | De → Para | Visão EGP | Mecanismo |
|---------|-----------|-----------|-----------|
| Contratos → EGP | Contrato assinado dispara Iniciação | Iniciação | Notificação + AI preenche TAP |
| EGP → Obras | Cronograma publica atividades planejadas | Execução | Insert em tabela compartilhada / flag |
| Obras → EGP | Apontamentos RDO atualizam avanço físico | Execução | Query `obr_apontamentos WHERE obra_id` |
| EGP → Compras | Cronograma dispara requisição (1 clique) | Execução | Navigate pré-preenchido + query params |
| EGP → Logística | Cronograma dispara transporte (1 clique) | Execução | Navigate pré-preenchido |
| EGP → Contratos | Cronograma dispara contratação (1 clique) | Execução | Navigate pré-preenchido |
| Financeiro → EGP | CPs pagas por OSC alimentam Custos | Execução | Query `fin_contas_pagar WHERE obra_id` |
| Obras → EGP | Medições enviadas pelo campo | Controle | Status change em `pmo_medicao_*` |
| EGP → Contratos | Medições alimentam controle contratual | Controle | Query compartilhada |
| EGP → Fiscal | Medição aprovada → Solic. Faturamento | Controle | Insert `fis_solicitacoes_nf` |
| EGP → Contratos | Aceite vincula encerramento | Encerramento | Update `con_contratos.status` |

---

## Novas Tabelas (11)

| Tabela | Visão | Campos principais |
|--------|-------|-------------------|
| `pmo_stakeholders` | Iniciação | portfolio_id, nome, papel, organizacao, influencia, estrategia |
| `pmo_comunicacao` | Iniciação | portfolio_id, item, destinatario, frequencia, canal, responsavel |
| `pmo_orcamento` | Planejamento | portfolio_id, disciplina, insumo, fase, valor_previsto, valor_realizado |
| `pmo_riscos` | Execução | portfolio_id, descricao, categoria, probabilidade, impacto, resposta, responsavel, status |
| `pmo_plano_acao` | Execução | portfolio_id, descricao, tipo_desvio, responsavel, prazo, status, evidencia_url |
| `pmo_entregaveis` | Execução | portfolio_id, eap_id, responsavel, pct_conclusao, status, data_prevista, data_real |
| `pmo_documentos` | Execução | portfolio_id, tipo, descricao, data_emissao, data_vencimento, status, arquivo_url |
| `pmo_avanco_fisico` | Execução | portfolio_id, semana, mes, pct_planejado, pct_executado, observacoes |
| `pmo_licoes_aprendidas` | Encerramento | portfolio_id, fase, descricao, tipo (positivo/negativo), recomendacao |
| `pmo_aceite` | Encerramento | portfolio_id, contrato_id, data_aceite, assinatura_url, observacoes, status |
| `pmo_desmobilizacao` | Encerramento | portfolio_id, item, categoria, status, responsavel, data_prevista, data_real |

## Tabelas Existentes Reutilizadas (15)

`pmo_portfolio`, `pmo_tap`, `pmo_eap`, `pmo_tarefas`, `pmo_histograma`, `pmo_fluxo_os`, `pmo_medicao_resumo`, `pmo_medicao_periodo`, `pmo_medicao_itens`, `pmo_medicao_item_periodo`, `pmo_indicadores_snapshot`, `pmo_multas`, `pmo_reunioes`, `pmo_mudancas`, `pmo_status_report`

---

## Rotas

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/egp` | EGPPainel | Dashboard consolidado (portfólio) |
| `/egp/iniciacao` | EGPIniciacaoHub | Grid de OSCs |
| `/egp/iniciacao/:id` | EGPIniciacao | TAP → Stakeholders → Comunicação |
| `/egp/planejamento` | EGPPlanejamentoHub | Grid de OSCs |
| `/egp/planejamento/:id` | EGPPlanejamento | EAP → Cronograma → Histograma → Orçamento → Riscos |
| `/egp/execucao` | EGPExecucaoHub | Grid de OSCs |
| `/egp/execucao/:id` | EGPExecucao | Cronograma → Histograma → Custos → Riscos → Plano de Ação |
| `/egp/controle` | EGPControleHub | Grid de OSCs |
| `/egp/controle/:id` | EGPControle | Medições → Eventos → Status Report → Indicadores |
| `/egp/encerramento` | EGPEncerramentoHub | Grid de OSCs |
| `/egp/encerramento/:id` | EGPEncerramento | Status Report → Lições → Aceite → Desmobilização |

---

## EGPLayout (nav atualizado)

```typescript
const NAV = [
  { to: '/egp',              icon: LayoutDashboard, label: 'Painel',        end: true },
  { to: '/egp/iniciacao',    icon: Rocket,          label: 'Iniciação' },
  { to: '/egp/planejamento', icon: Compass,         label: 'Planejamento' },
  { to: '/egp/execucao',     icon: Zap,             label: 'Execução' },
  { to: '/egp/controle',     icon: BarChart3,       label: 'Controle' },
  { to: '/egp/encerramento', icon: CheckCircle2,    label: 'Encerramento' },
]
```
