---
title: "Pilar: Suprimentos"
type: pilar
status: ativo
tags: [pilar, suprimentos, compras, logistica, estoque, frotas, locacao, patrimonial]
criado: 2026-04-09
relacionado: ["[[00 - TEG+ INDEX]]"]
---

# 🟢 Pilar Suprimentos

> Cadeia completa de suprimentos: da requisição de compra à entrega no almoxarifado.

---

## Módulos (6)

| Módulo | Completude | Doc principal |
|--------|-----------|---------------|
| **Compras** | 95% | [[11 - Fluxo Requisição]] |
| **Logística** | 85% | [[23 - Módulo Logística e Transportes]] |
| **Estoque** | 65% | [[22 - Módulo Estoque e Patrimonial]] |
| **Patrimonial** | 60% | [[22 - Módulo Estoque e Patrimonial]] |
| **Frotas** | 85% | [[24 - Módulo Frotas e Manutenção]] |
| **Locação Imóveis** | 100% | [[34 - Módulo Locação]] |

---

## Fluxo principal

```mermaid
flowchart LR
    RC[Requisição\nde Compra] --> COT[Cotação]
    COT --> PO[Pedido\nde Compra]
    PO --> LOG[Logística\nTransporte]
    LOG --> EST[Estoque\nRecebimento]
    EST --> PAT[Patrimônio\nse imobilizado]
    
    PO -->|veículo| FRO[Frotas\nManutenção]
    
    style RC fill:#10B981,color:#fff
    style PO fill:#10B981,color:#fff
    style LOG fill:#EA580C,color:#fff
    style EST fill:#3B82F6,color:#fff
    style FRO fill:#F43F5E,color:#fff
```

---

## Docs Compras

| Doc | Descrição |
|-----|-----------|
| [[11 - Fluxo Requisição]] | Wizard 3 etapas, RC-YYYYMM-XXXX |
| [[12 - Fluxo Aprovação]] | Token-based, 4 alçadas, multi-tipo |
| [[13 - Alçadas]] | Limites por valor e categoria |
| [[14 - Compradores e Categorias]] | 3 compradores, 12 categorias |
| [[26 - Upload Inteligente Cotacao]] | Parse AI de PDF/imagem |

## Integrações

- [[45 - Mapa de Integrações]] — Cobli (telemetria), Veloe (combustível), Consulta Placa
- [[49 - SuperTEG AI Agent]] — Parse de cotações via chat
- [[50 - Fluxos Inter-Módulos]] — Compras→Financeiro, Logística→Estoque

---

## Links

- [[00 - TEG+ INDEX]]
- [[PILAR - Backoffice]] — Financeiro recebe pedidos daqui
- [[PILAR - Projetos]] — Obras consomem materiais daqui
- [[50 - Fluxos Inter-Módulos]]
