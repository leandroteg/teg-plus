---
title: Modelo de Dados ERD
type: dev-guide
status: ativo
tags: [erd, modelo-dados, diagrama, relacionamentos, database]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[06 - Supabase]]", "[[07 - Schema Database]]", "[[08 - Migrações SQL]]"]
---

# 🗄️ Modelo de Dados ERD — TEG+ ERP

> Complemento visual ao [[07 - Schema Database]]. Aqui estão os diagramas ER por domínio.
> **82 objetos** | **~100 FKs** | Prefixos por módulo

---

## Visão Macro — Inter-módulos

```mermaid
erDiagram
    SYS_OBRAS ||--o{ CMP_REQUISICOES : "requisições"
    SYS_OBRAS ||--o{ CON_CONTRATOS : "contratos"
    SYS_OBRAS ||--o{ EST_SALDOS : "estoque"
    SYS_OBRAS ||--o{ LOG_SOLICITACOES : "logística"
    SYS_OBRAS ||--o{ FIN_CONTAS_PAGAR : "financeiro"
    SYS_OBRAS ||--o{ FRO_VEICULOS : "frotas"
    
    SYS_USUARIOS ||--o{ CMP_REQUISICOES : "cria"
    SYS_USUARIOS ||--o{ APR_APROVACOES : "aprova"
    
    CMP_REQUISICOES ||--o{ CMP_COTACOES : "recebe cotações"
    CMP_COTACOES ||--o| CMP_PEDIDOS : "gera PO"
    CMP_PEDIDOS ||--o{ LOG_SOLICITACOES : "despacha"
    LOG_SOLICITACOES ||--o{ LOG_TRANSPORTES : "transporta"
    
    CON_CONTRATOS ||--o{ CON_PARCELAS : "parcelas"
    CON_CONTRATOS ||--o{ CON_MEDICOES : "medições"
    CON_CONTRATOS ||--o{ FIN_CONTAS_PAGAR : "gera CP"
```

---

## Sistema (`sys_`)

```mermaid
erDiagram
    sys_empresas {
        uuid id PK
        text razao_social
        text cnpj
    }
    sys_obras {
        uuid id PK
        text nome
        text codigo
        uuid empresa_id FK
    }
    sys_usuarios {
        uuid id PK
        text nome
        text email
        text perfil_tipo
        uuid obra_id FK
    }
    sys_perfis {
        uuid id PK
        uuid user_id FK
        text tipo
        jsonb modulos
    }
    sys_centros_custo {
        uuid id PK
        text codigo
        text descricao
        uuid empresa_id FK
        uuid obra_id FK
    }
    sys_config {
        uuid id PK
        text chave
        text valor
    }
    sys_log_atividades {
        uuid id PK
        uuid user_id FK
        text acao
        text tabela
        timestamp created_at
    }
    
    sys_empresas ||--o{ sys_obras : "possui"
    sys_empresas ||--o{ sys_centros_custo : "agrupa"
    sys_obras ||--o{ sys_usuarios : "aloca"
    sys_usuarios ||--|| sys_perfis : "tem perfil"
    sys_usuarios ||--o{ sys_log_atividades : "gera logs"
```

---

## Compras (`cmp_`)

```mermaid
erDiagram
    cmp_requisicoes {
        uuid id PK
        text numero
        text status
        uuid solicitante_id FK
        uuid obra_id FK
        numeric valor_estimado
        text cat_tipo
        boolean is_recorrente
    }
    cmp_cotacoes {
        uuid id PK
        uuid requisicao_id FK
        uuid fornecedor_id FK
        numeric valor_total
        text status
    }
    cmp_pedidos {
        uuid id PK
        text numero
        uuid cotacao_id FK
        uuid requisicao_id FK
        text status
    }
    cmp_fornecedores {
        uuid id PK
        text razao_social
        text cnpj
        text status
    }
    apr_alcadas {
        uuid id PK
        text modulo
        numeric valor_min
        numeric valor_max
        integer nivel
    }
    apr_aprovacoes {
        uuid id PK
        uuid referencia_id FK
        text modulo
        uuid aprovador_id FK
        text decisao
        text token
    }
    
    cmp_requisicoes ||--o{ cmp_cotacoes : "cotações"
    cmp_cotacoes }o--|| cmp_fornecedores : "fornecedor"
    cmp_cotacoes ||--o| cmp_pedidos : "gera PO"
    cmp_requisicoes ||--o{ apr_aprovacoes : "aprovações"
```

---

## Contratos (`con_`)

```mermaid
erDiagram
    con_contratos {
        uuid id PK
        text numero
        text tipo_contrato
        text status
        text contraparte_nome
        text contraparte_cnpj
        numeric valor_total
        date data_inicio
        date data_fim
        uuid obra_id FK
    }
    con_parcelas {
        uuid id PK
        uuid contrato_id FK
        integer numero
        numeric valor
        date data_vencimento
        text status
    }
    con_medicoes {
        uuid id PK
        uuid contrato_id FK
        integer numero
        numeric valor_medido
        text status
    }
    con_resumos_executivos {
        uuid id PK
        uuid contrato_id FK
        text objeto_resumo
        jsonb riscos
        jsonb oportunidades
        text recomendacao
    }
    con_solicitacoes {
        uuid id PK
        uuid contrato_id FK
        text tipo
        text status
        text justificativa
    }
    
    con_contratos ||--o{ con_parcelas : "parcelas"
    con_contratos ||--o{ con_medicoes : "medições"
    con_contratos ||--o| con_resumos_executivos : "resumo AI"
    con_contratos ||--o{ con_solicitacoes : "solicitações"
```

---

## Logística (`log_`)

```mermaid
erDiagram
    log_solicitacoes {
        uuid id PK
        text numero
        text status
        uuid obra_origem FK
        uuid obra_destino FK
        uuid viagem_id FK
    }
    log_viagens {
        uuid id PK
        text numero
        text status
        text origem_principal
        text destino_final
        integer qtd_paradas
    }
    log_transportes {
        uuid id PK
        uuid solicitacao_id FK
        uuid viagem_id FK
        text placa
        text motorista_nome
        timestamp hora_saida
        timestamp hora_chegada
    }
    log_recebimentos {
        uuid id PK
        uuid solicitacao_id FK
        text status
        timestamp data_recebimento
    }
    
    log_viagens ||--o{ log_solicitacoes : "paradas"
    log_solicitacoes ||--o| log_transportes : "transporte"
    log_viagens ||--o{ log_transportes : "agrupamento"
    log_solicitacoes ||--o| log_recebimentos : "recebimento"
```

---

## Financeiro (`fin_`)

```mermaid
erDiagram
    fin_contas_pagar {
        uuid id PK
        text numero
        text status
        numeric valor
        date vencimento
        uuid fornecedor_id FK
        uuid obra_id FK
        text omie_id
    }
    fin_contas_receber {
        uuid id PK
        text numero
        numeric valor
        date vencimento
        text status
    }
    fin_docs {
        uuid id PK
        uuid conta_id FK
        text tipo
        text url
    }
    
    fin_contas_pagar ||--o{ fin_docs : "docs"
    fin_contas_pagar ||--o{ apr_aprovacoes : "aprovações"
```

---

## Convenções do Schema

| Convenção | Regra |
|-----------|-------|
| Prefixo | Módulo (`sys_`, `cmp_`, `con_`, etc.) |
| PK | Sempre `id UUID DEFAULT gen_random_uuid()` |
| FK | `<tabela_referencia>_id` |
| Timestamps | `created_at`, `updated_at` (com trigger) |
| Soft delete | `deleted_at TIMESTAMP` (quando aplicável) |
| Status | `TEXT` com enum check constraint |
| Valores | `NUMERIC(15,2)` para monetários |
| Datas | `DATE` para date-only, `TIMESTAMPTZ` para data+hora |

---

## Links

- [[07 - Schema Database]] — Referência completa de todas as tabelas
- [[08 - Migrações SQL]] — Histórico de alterações
- [[06 - Supabase]] — Configuração do banco
- [[41 - Segurança e RLS]] — Políticas de acesso por tabela
