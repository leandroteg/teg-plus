---
title: Roadmap
type: estratégia
status: ativo
tags: [roadmap, planejamento, futuro, módulos, integrações, erp]
criado: 2026-03-02
atualizado: 2026-03-03
relacionado: ["[[00 - TEG+ INDEX]]", "[[01 - Arquitetura Geral]]"]
---

# Roadmap — TEG+ ERP Tailor-Made

> Plano completo para transformar o TEG+ em um ERP sob medida para operações de engenharia elétrica.
> Organizado por trimestre, com dependências e prioridades claras.

---

## Visão Geral do Produto

```mermaid
graph LR
    subgraph ENTREGUE["✅ Entregue (6 módulos)"]
        C[Compras]
        F[Financeiro]
        E[Estoque]
        L[Logística]
        FR[Frotas]
        MU[Mural RH]
    end

    subgraph EVOLUIR["🔵 Evoluir (Q1-Q2)"]
        C2[Cotações E2E]
        F2[NF-e + Relatórios]
        E2[Transferências]
        L2[GPS Tracking]
        FR2[Telemetria Real]
    end

    subgraph CONSTRUIR["🟡 Construir (Q2-Q3)"]
        RH[RH Completo]
        SS[SSMA]
        CT[Contratos]
        AI[AI TEG+ Agent]
        CO[Controladoria]
    end

    subgraph INTEGRAR["🟣 Integrar (Q3-Q4)"]
        MON[Monday.com PMO]
        SEF[SEFAZ NF-e]
        ESO[eSocial]
        OB[Open Banking]
    end

    style C fill:#10B981,color:#fff
    style F fill:#10B981,color:#fff
    style E fill:#10B981,color:#fff
    style L fill:#10B981,color:#fff
    style FR fill:#10B981,color:#fff
    style MU fill:#10B981,color:#fff
    style RH fill:#F59E0B,color:#fff
    style SS fill:#F59E0B,color:#fff
    style CT fill:#F59E0B,color:#fff
    style AI fill:#8B5CF6,color:#fff
    style CO fill:#8B5CF6,color:#fff
```

---

## Status Atual — Março 2026

### Entregue ✅ (6 Módulos Operacionais)

| Módulo | Completude | Funcionalidades |
|--------|-----------|-----------------|
| **Compras** | 95% | Wizard 3 etapas, AI parse, aprovações 4 alçadas, cotações, PO, token-based |
| **Financeiro** | 50% | CP, CR, aprovações, conciliação CNAB (UI), Omie ERP, 4 squads n8n |
| **Estoque** | 60% | Almoxarifado, inventário, patrimonial, depreciação linear, curva ABC |
| **Logística** | 85% | Solicitações 9 etapas, expedição, recebimentos, NF-e, transportadoras |
| **Frotas** | 80% | Veículos, OS manutenção, checklists, abastecimentos, telemetria (stub) |
| **Mural RH** | 100% | Slideshow Ken Burns, gestão admin, campanhas com vigência |

### Infraestrutura Entregue ✅

| Item | Detalhes |
|------|----------|
| Schema Supabase | 18 migrations, RLS, views, funções, triggers |
| Auth | Magic link + email/senha, 6 roles |
| n8n Workflows | 8 workflows ativos (compras, financeiro, AI parse) |
| Deploy | Vercel (frontend) + Easypanel (n8n) |
| Obsidian Vault | 25+ docs, 6 painéis Dataview |

---

## Q1 2026 — Completar Módulos Core (Mar)

> **Foco:** Fechar gaps dos módulos já entregues.

### Prioridade Crítica

| # | Item | Módulo | Milestone | Status |
|---|------|--------|-----------|--------|
| 1 | Notificações WhatsApp (Evolution API) | Compras | MS-002 | 🔵 Em andamento |
| 2 | Cotações end-to-end com regras automáticas | Compras | MS-002 | 🔵 Em andamento |
| 3 | Conciliação e Remessa Bancária (CNAB 240) | Financeiro | MS-004 | 🔵 Em andamento |
| 4 | Relatórios Financeiros (DRE, DFC, BP) | Financeiro | MS-004 | 🔵 Em andamento |

### Prioridade Alta

| # | Item | Módulo | Status |
|---|------|--------|--------|
| 5 | Solicitações de material inter-bases | Estoque | ⬜ Backlog |
| 6 | Transferências entre almoxarifados | Estoque | ⬜ Backlog |
| 7 | Testes automatizados (Vitest + Playwright) | Infra | ⬜ Backlog |
| 8 | CI/CD GitHub Actions | Infra | ⬜ Backlog |

---

## Q2 2026 — Módulo RH + AI (Abr → Jun)

> **Foco:** RH completo, AI agent, profundidade financeira.

### MS-008 · Módulo RH Completo

| Funcionalidade | Prioridade | Integrações |
|----------------|-----------|-------------|
| Cadastro de colaboradores | Crítica | Supabase + eSocial |
| Ponto eletrônico | Crítica | REP/Mobile |
| HHt — Homem-hora por obra | Crítica | PWA mobile-first |
| Folha de pagamento (cálculos) | Alta | Omie/Contabilidade |
| Férias, afastamentos, ASO | Alta | eSocial |
| Organograma e cargos | Média | Supabase |
| Relatórios trabalhistas | Média | eSocial/FGTS |

### MS-011 · AI TEG+ Agent

| Capacidade | Canal | Stack |
|-----------|-------|-------|
| "Abrir requisição" → wizard conversacional | WhatsApp + Web | Claude API |
| "Status da RC-XXX" → consulta Supabase | WhatsApp + Web | n8n + RAG |
| "Quantas requisições pendentes?" → dashboard | WhatsApp | Claude + Supabase |
| "Relatório de compras do mês" → AI + SQL | Web chat | Claude + RPC |
| Análise de anomalias financeiras | Web | Claude + cron |

### Financeiro Deep

| Item | Descrição |
|------|-----------|
| NF-e/NFS-e emissão | SEFAZ + Prefeitura via n8n |
| Alçadas financeiras | Controle granular por valor/tipo |
| Integração RH → Folha | Folha de pagamento no CP |
| Curva ABC fornecedores | Análise Pareto automática |

---

## Q3 2026 — SSMA + Contratos + Controladoria (Jul → Set)

> **Foco:** Módulos regulatórios e visão executiva.

### MS-009 · Módulo SSMA

| Funcionalidade | Prioridade | Regulação |
|----------------|-----------|-----------|
| Registro de acidentes/incidentes | Crítica | NR-4 |
| CAT (Comunicação Acidente Trabalho) | Crítica | Previdência |
| Permissão de Trabalho (PT) | Crítica | NR-10/NR-35 |
| DDS (Diálogo Diário de Segurança) | Alta | NR-1 |
| Controle de EPI (entrega/devolução) | Alta | NR-6 |
| Inspeções programadas | Alta | NR-10/NR-35 |
| ASO e exames periódicos | Média | NR-7/PCMSO |
| Indicadores LTIR, TFCA, TFSA | Média | Benchmarking |

### MS-010 · Módulo Contratos e Medições

| Funcionalidade | Prioridade |
|----------------|-----------|
| Cadastro de contratos (cliente/fornecedor) | Crítica |
| Medições de obra (BM — Boletim de Medição) | Crítica |
| Aditivos contratuais | Alta |
| Cronograma físico-financeiro por contrato | Alta |
| SLA e penalidades | Média |
| Reajustes (IGPM, IPCA) | Média |
| Integração Financeiro (faturamento por medição) | Crítica |

### MS-012 · Controladoria e BI

| Funcionalidade | Prioridade |
|----------------|-----------|
| Orçado vs Realizado por obra | Crítica |
| DRE consolidado (todas as obras) | Crítica |
| Centro de custo por obra/frente | Alta |
| Forecast de caixa (30/60/90 dias) | Alta |
| EBITDA e margem de contribuição | Alta |
| Dashboard executivo (BI) | Média |
| Exportação para contabilidade | Média |

---

## Q4 2026 — Integrações Enterprise (Out → Dez)

> **Foco:** Integrações externas e PMO.

### MS-013 · Monday.com PMO

| Funcionalidade | Descrição |
|----------------|-----------|
| Cronograma por obra | Importação de timeline |
| Status por frente de trabalho | Sync bidirecional |
| Vinculação compras ao cronograma | Compras ↔ Monday items |
| KPIs avanço físico-financeiro | Dashboard combinado |
| Alocação de recursos por obra | RH ↔ Monday |

### Integrações Externas Planejadas

| Integração | Módulo | Prioridade | Trimestre |
|------------|--------|-----------|-----------|
| WhatsApp (Evolution API) | Compras/Notif | Crítica | Q1 |
| SEFAZ — NF-e/NFS-e | Financeiro | Obrigatória | Q2 |
| eSocial | RH | Obrigatória | Q2 |
| CNAB 240/480 (bancário) | Financeiro | Obrigatória | Q1 |
| OFX / Open Banking | Financeiro | Alta | Q2 |
| Receita Federal (CNPJ) | Compras/Fin | Média | Q2 |
| Monday.com | PMO | Alta | Q4 |
| Contabilidade externa | Financeiro | Média | Q3 |
| GPS/Rastreamento frota | Frotas | Média | Q3 |

---

## Arquitetura Alvo — ERP Completo

```mermaid
graph TD
    subgraph CANAIS["📱 Canais de Entrada"]
        WEB[Portal Web]
        WA[WhatsApp]
        MOB[Mobile PWA]
    end

    subgraph AI["🤖 AI Layer"]
        AGENT[AI TEG+<br>Claude API]
        RAG[RAG Engine<br>Supabase pgvector]
    end

    subgraph N8N["⚙️ Orquestração n8n"]
        COMP[Compras]
        FIN[Financeiro]
        RH_N[RH/HHt]
        NOTIF[Notificações]
        SSMA_N[SSMA]
        NFE[NF-e Agent]
    end

    subgraph MODULOS["📦 Módulos ERP"]
        M1[Compras]
        M2[Financeiro]
        M3[Estoque]
        M4[Logística]
        M5[Frotas]
        M6[RH]
        M7[SSMA]
        M8[Contratos]
        M9[Controladoria]
    end

    subgraph DATA["🗄️ Dados & Integrações"]
        SUPA[(Supabase<br>Core)]
        OMIE[(Omie ERP)]
        MON[(Monday.com)]
        SEFAZ[(SEFAZ)]
        ESOCIAL[(eSocial)]
    end

    WEB --> N8N
    WA --> AGENT
    MOB --> N8N
    AGENT --> N8N
    N8N --> MODULOS
    MODULOS --> DATA
    RAG --> SUPA
```

---

## KPIs de Sucesso do Projeto

| Indicador | Atual (Mar/26) | Meta Q2 | Meta Q4 |
|---|---|---|---|
| Módulos operacionais | 6 | 8 (+ RH, AI) | 11 (todos) |
| Tabelas no schema | ~63 | ~90 | ~120 |
| Workflows n8n | 8 | 15 | 25 |
| Tempo aprovação compra | < 4h | < 2h | < 1h |
| Requisições digitais | 100% | 100% | 100% |
| Cobertura de testes | 0% | 40% | 70% |
| Integrações externas | 1 (Omie) | 4 | 8 |
| Visibilidade financeira | Parcial | Real-time | BI completo |

---

## Dependências entre Módulos

```mermaid
graph TD
    COMP[Compras ✅] --> FIN[Financeiro 🔵]
    COMP --> EST[Estoque 🔵]
    FIN --> CTRL[Controladoria 🟡]
    EST --> LOG[Logística ✅]
    RH[RH 🟡] --> FIN
    RH --> SSMA[SSMA 🟡]
    CONT[Contratos 🟡] --> FIN
    CONT --> CTRL
    FROT[Frotas ✅] --> EST
    AI[AI Agent 🟡] --> COMP
    AI --> FIN
    MON[Monday PMO 🟣] --> CONT
    MON --> CTRL
```

---

## Milestones Ativos

| ID | Milestone | Fase | Progresso |
|----|-----------|------|-----------|
| [[MS-001 - Modulo Compras Core\|MS-001]] | Compras Core | Q1-2026 | ✅ 100% |
| [[MS-002 - Cotacoes e Notificacoes\|MS-002]] | Cotações e Notificações | Q1-2026 | 🔵 30% |
| [[MS-004 - Modulo Financeiro\|MS-004]] | Financeiro — Omie Core | Q1-Q2 | 🔵 50% |
| [[MS-006 - Modulo Estoque Patrimonial\|MS-006]] | Estoque e Patrimonial | Q1-2026 | 🔵 60% |
| [[MS-006 - Modulo Logistica Transportes\|MS-006b]] | Logística e Transportes | Q1-2026 | 🔵 85% |
| [[MS-007 - Modulo Frotas Manutencao\|MS-007]] | Frotas e Manutenção | Q1-2026 | 🔵 80% |
| [[MS-008 - Modulo RH Completo\|MS-008]] | RH Completo | Q2-2026 | ⬜ 0% |
| [[MS-009 - Modulo SSMA\|MS-009]] | SSMA | Q3-2026 | ⬜ 0% |
| [[MS-010 - Modulo Contratos Medicoes\|MS-010]] | Contratos e Medições | Q3-2026 | ⬜ 0% |
| [[MS-011 - AI TEG+ Agent\|MS-011]] | AI TEG+ Agent | Q2-Q3 | ⬜ 0% |
| [[MS-012 - Controladoria BI\|MS-012]] | Controladoria e BI | Q3-2026 | ⬜ 0% |
| [[MS-013 - Monday PMO\|MS-013]] | Monday.com PMO | Q4-2026 | ⬜ 0% |

---

## Links Relacionados

- [[00 - TEG+ INDEX]] — Status atual consolidado
- [[01 - Arquitetura Geral]] — Arquitetura técnica
- [[10 - n8n Workflows]] — Workflows existentes e futuros
- [[Paineis/BI Dashboard|📊 BI Dashboard]] — Painel executivo visual
- [[Paineis/Roadmap Board|🗺️ Roadmap Board]] — Timeline interativa
