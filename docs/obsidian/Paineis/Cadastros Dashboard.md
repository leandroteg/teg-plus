---
title: Cadastros Dashboard
type: painel
status: ativo
tags: [dashboard, cadastros, master-data, dataview]
criado: 2026-03-05
atualizado: 2026-03-05
---

# ⚙️ Cadastros — Master Data Dashboard

> Painel centralizado de dados mestres do ERP. Gerenciado via módulo Cadastros (`/cadastros`).

---

## 📊 Entidades Master Data

| Entidade | Tabela | AI? | Status |
|----------|--------|-----|--------|
| Fornecedores | `cmp_fornecedores` | 🤖 CNPJ Lookup | ✅ Ativo |
| Itens de Estoque | `est_itens` | — | ✅ Ativo |
| Classes Financeiras | `fin_classes_financeiras` | — | ✅ Ativo |
| Centros de Custo | `sys_centros_custo` | — | ✅ Ativo |
| Obras / Projetos | `obras` | 🤖 AI Parse | ✅ Ativo |
| Colaboradores | `rh_colaboradores` | 🤖 CPF Lookup | ✅ Ativo |

---

## 🤖 Pipeline AI

```mermaid
graph LR
    CNPJ[CNPJ / CPF] --> BRASIL[BrasilAPI]
    DOC[Documento / Texto] --> N8N[n8n Webhook]
    FALLBACK[Offline] --> REGEX[Regex Local]

    BRASIL --> CONF[Campos + Confiança]
    N8N --> CONF
    REGEX --> CONF

    CONF --> UI[MagicModal\nConfidenceField]

    style BRASIL fill:#10B981,color:#fff
    style N8N fill:#F59E0B,color:#fff
    style REGEX fill:#64748B,color:#fff
    style UI fill:#8B5CF6,color:#fff
```

---

## 📈 Componentes do Módulo

| Componente | Função |
|-----------|---------|
| `MagicModal` | Modal com toggle AI/Manual |
| `AiDropZone` | Drag-drop + CNPJ/CPF input |
| `ConfidenceField` | Input com indicador de confiança (emerald/amber/rose) |
| `CadastrosLayout` | Sidebar violet com 7 nav items |

---

## 🔗 Navegação

- [[28 - Módulo Cadastros AI]] — Documentação técnica completa
- [[Paineis/PAINEL PRINCIPAL|🏠 Painel Principal]] — Central de comando
- [[Paineis/Financeiro Dashboard|💰 Financeiro]] — Fornecedores e classes
- [[Paineis/Estoque Dashboard|📦 Estoque]] — Itens e inventário
