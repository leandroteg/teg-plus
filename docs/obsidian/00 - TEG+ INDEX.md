---
title: TEG+ ERP — Índice Principal
type: index
status: ativo
tags: [teg-plus, erp, moc, index]
criado: 2026-03-02
atualizado: 2026-03-03
---

# TEG+ ERP — Mapa da Aplicação

> Sistema ERP modular para gestão de obras de engenharia elétrica/transmissão.
> Foco atual: **Módulo de Compras** com fluxo completo de requisições e aprovações.

---

## 🏠 Painéis de Gestão

| Painel | Descrição |
|--------|-----------|
| [[Paineis/PAINEL PRINCIPAL\|🏠 Painel Principal]] | Central de comando — KPIs, status, alertas |
| [[Paineis/Tasks Board\|📋 Tasks Board]] | Kanban de tarefas por status e sprint |
| [[Paineis/Roadmap Board\|🗺️ Roadmap]] | Timeline de milestones e progresso |
| [[Paineis/Issues Board\|🐛 Issues Board]] | Tracker de bugs e problemas |
| [[Paineis/Requisitos Board\|📦 Requisitos]] | Rastreabilidade de requisitos |

> **Como usar:** edite os arquivos em `Database/Tarefas/`, `Database/Issues/`, `Database/Requisitos/` ou `Database/Milestones/` — os painéis atualizam automaticamente via Dataview.

---

## 📖 Documentação Técnica

| Área | Nota |
|------|------|
| Visão geral | [[01 - Arquitetura Geral]] |
| Frontend | [[02 - Frontend Stack]] |
| Páginas & Rotas | [[03 - Páginas e Rotas]] |
| Componentes | [[04 - Componentes]] |
| Hooks | [[05 - Hooks Customizados]] |
| Banco de Dados | [[06 - Supabase]] |
| Schema SQL | [[07 - Schema Database]] |
| Migrações | [[08 - Migrações SQL]] |
| Autenticação | [[09 - Auth Sistema]] |
| Automação | [[10 - n8n Workflows]] |
| Fluxo Requisição | [[11 - Fluxo Requisição]] |
| Fluxo Aprovação | [[12 - Fluxo Aprovação]] |
| Alçadas | [[13 - Alçadas]] |
| Compradores & Categorias | [[14 - Compradores e Categorias]] |
| Deploy & GitHub | [[15 - Deploy e GitHub]] |
| Variáveis de Ambiente | [[16 - Variáveis de Ambiente]] |
| Roadmap | [[17 - Roadmap]] |
| Glossário | [[18 - Glossário]] |
| Integração Omie ERP | [[19 - Integração Omie]] |
| Módulo Financeiro | [[20 - Módulo Financeiro]] |
| Fluxo de Pagamento | [[21 - Fluxo Pagamento]] |
| Módulo Estoque e Patrimonial | [[22 - Módulo Estoque e Patrimonial]] |
| Módulo Logística | [[23 - Módulo Logística e Transportes]] |
| Módulo Frotas | [[24 - Módulo Frotas e Manutenção]] |

---

## Arquitetura em 3 Camadas

```mermaid
graph TD
    A[👤 Usuário] --> B[🌐 Frontend\nReact + Vite\nVercel]
    B --> C[⚙️ n8n\nOrquestrador\nWebhooks]
    C --> D[(🗄️ Supabase\nPostgreSQL + Auth\nRealtime)]
    B --> D
    C --> E[🤖 AI Parse\nClaude/LLM]
    D --> F[📡 Realtime\nSubscriptions]
    F --> B

    style A fill:#6366F1,color:#fff
    style B fill:#14B8A6,color:#fff
    style C fill:#F59E0B,color:#fff
    style D fill:#10B981,color:#fff
    style E fill:#8B5CF6,color:#fff
```

---

## Módulos da Aplicação

```mermaid
graph LR
    M[TEG+ ERP] --> C[✅ Compras]
    M --> F[✅ Financeiro]
    M --> E[✅ Estoque]
    M --> L[✅ Logística]
    M --> FR[✅ Frotas]
    M --> R[🔜 RH]
    M --> S[🔜 SSMA]
    M --> K[🔜 Contratos]

    C --> C1[Requisições]
    C --> C2[Cotações]
    C --> C3[Aprovações]
    C --> C4[Pedidos]

    E --> E1[Almoxarifado]
    E --> E2[Inventário]
    E --> E3[Patrimonial]

    L --> L1[Solicitações]
    L --> L2[Expedição]
    L --> L3[Transportes]
    L --> L4[Recebimentos]

    FR --> FR1[OS Manutenção]
    FR --> FR2[Checklists]
    FR --> FR3[Telemetria]

    style C  fill:#10B981,color:#fff
    style F  fill:#10B981,color:#fff
    style E  fill:#3B82F6,color:#fff
    style L  fill:#EA580C,color:#fff
    style FR fill:#F43F5E,color:#fff
    style R  fill:#64748B,color:#fff
    style S  fill:#64748B,color:#fff
    style K  fill:#64748B,color:#fff
```

---

## Status do Projeto

| Funcionalidade | Status | Notas |
|---|---|---|
| Portal de Requisições | ✅ Entregue | 3-step wizard + AI |
| Aprovações multi-nível | ✅ Entregue | 4 alçadas, token-based |
| ApprovaAi (mobile) | ✅ Entregue | Interface responsiva |
| Dashboard KPIs | ✅ Entregue | RPC + realtime |
| Schema Supabase | ✅ Entregue | 17 migrations |
| AI Parse requisições | ✅ Entregue | Keywords + n8n |
| Cotações | ✅ Entregue | Regras de alçada + bypass sem mínimo |
| PO — PDF e Compartilhamento | ✅ Entregue | Sem deps externas, WhatsApp + E-mail |
| Fluxo Pagamento (Compras→Fin) | ✅ Entregue | Triggers, anexos, comprovante |
| Financeiro (Omie ERP) | ✅ Entregue | CP, CR, Fornecedores, 4 squads n8n |
| Estoque e Patrimonial | ✅ Entregue | Almoxarifado, inventário, imobilizados, depreciação |
| Logística e Transportes | ✅ Entregue | 9 etapas, NF-e, rastreamento, avaliações |
| Frotas e Manutenção | ✅ Entregue | OS, checklist, abastecimento, telemetria |
| WhatsApp (Evolution API) | 🔜 Planejado | Notificações automáticas |
| AI TEG+ (Claude API) | 🔜 Planejado | Agente conversacional |
| Monday.com PMO | 🔜 Planejado | Gestão de portfólio |

---

## Obras Ativas (6)

- SE Frutal
- SE Paracatu
- SE Perdizes
- SE Três Marias
- SE Rio Paranaíba
- SE Ituiutaba

---

*Vault gerado automaticamente em 2026-03-02 a partir do código-fonte.*
