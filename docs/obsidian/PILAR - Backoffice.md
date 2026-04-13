---
title: "Pilar: Backoffice"
type: pilar
status: ativo
tags: [pilar, backoffice, financeiro, fiscal, controladoria, contratos, despesas]
criado: 2026-04-09
relacionado: ["[[00 - TEG+ INDEX]]"]
---

# 🔵 Pilar Backoffice

> Gestão financeira, fiscal, contratual e de controladoria.

---

## Módulos (5)

| Módulo | Completude | Doc principal |
|--------|-----------|---------------|
| **Financeiro** | 70% | [[20 - Módulo Financeiro]] |
| **Despesas** | Ativo | *(sub-módulo: cartões corporativos, adiantamentos)* |
| **Fiscal** | 80% | [[29 - Módulo Fiscal]] |
| **Controladoria** | 75% | [[30 - Módulo Controladoria]] |
| **Contratos** | 85% | [[27 - Módulo Contratos Gestão]] |

---

## Fluxo principal

```mermaid
flowchart LR
    PO[Pedido Emitido\nde Compras] -->|parcelas| CP[Contas a Pagar]
    CT[Contrato\nMedição] -->|parcelas| CP
    CP -->|liberação + NF| PAG[Pagamento]
    PAG --> TES[Tesouraria\nConciliação]
    
    NF[Nota Fiscal\nrecebida] -->|vincula| CP
    
    PAG --> DRE[Controladoria\nDRE]
    
    style PO fill:#10B981,color:#fff
    style CP fill:#10B981,color:#fff
    style PAG fill:#059669,color:#fff
    style DRE fill:#14B8A6,color:#fff
    style NF fill:#F59E0B,color:#fff
    style CT fill:#8B5CF6,color:#fff
```

---

## Docs detalhados

| Doc | Descrição |
|-----|-----------|
| [[20 - Módulo Financeiro]] | CP, CR, Tesouraria, pipeline |
| [[21 - Fluxo Pagamento]] | Liberação → NF → comprovante |
| [[27 - Módulo Contratos Gestão]] | 7 etapas, análise AI, medições |
| [[29 - Módulo Fiscal]] | Pipeline NF, SEFAZ |
| [[30 - Módulo Controladoria]] | DRE, orçamentos, KPIs, alertas |

## Integrações

- [[19 - Integração Omie]] — Futuro (~Jun 2026): lote pagamentos + conciliação
- [[45 - Mapa de Integrações]] — DocuSign (assinaturas), Bancos (CNAB/PIX)
- [[50 - Fluxos Inter-Módulos]] — Compras→Financeiro, Contratos→Financeiro

---

## Links

- [[00 - TEG+ INDEX]]
- [[PILAR - Suprimentos]] — Pedidos geram contas a pagar
- [[PILAR - Projetos]] — Obras geram adiantamentos
- [[50 - Fluxos Inter-Módulos]]
