---
title: Fluxos Inter-Módulos
type: dev-guide
status: ativo
tags: [fluxos, modulos, integracao-interna, pipeline, compras, financeiro, logistica, estoque, contratos]
criado: 2026-04-09
relacionado: ["[[00 - TEG+ INDEX]]", "[[01 - Arquitetura Geral]]", "[[11 - Fluxo Requisição]]", "[[12 - Fluxo Aprovação]]", "[[20 - Módulo Financeiro]]", "[[21 - Fluxo Pagamento]]", "[[23 - Módulo Logística e Transportes]]", "[[27 - Módulo Contratos Gestão]]", "[[45 - Mapa de Integrações]]"]
---

# 🔄 Fluxos Inter-Módulos — TEG+ ERP

> Como os 16 módulos do TEG+ se conectam entre si. Cada fluxo descreve o caminho dos dados desde a origem até o destino final.

---

## Mapa de Conexões

```mermaid
flowchart TD
    COMPRAS[Compras] -->|pedido emitido| FIN[Financeiro]
    COMPRAS -->|compra recorrente| CONTRATOS[Contratos]
    COMPRAS -->|pedido para entrega| LOG[Logística]
    
    LOG -->|recebimento| EST[Estoque]
    LOG -->|NF de transporte| FISCAL[Fiscal]
    LOG -->|viagem com veículo| FROTAS[Frotas]
    
    CONTRATOS -->|parcelas| FIN
    CONTRATOS -->|medição aprovada| FIN
    
    FIN -->|pagamento confirmado| CTRL[Controladoria]
    FIN -->|NF vinculada| FISCAL
    
    FISCAL -->|impostos| CTRL
    
    EST -->|patrimônio| PAT[Patrimônio]
    
    FROTAS -->|custo manutenção| FIN
    FROTAS -->|veículo de obra| OBRAS[Obras]
    
    OBRAS -->|adiantamento| FIN
    OBRAS -->|apontamento HH| RH[RH]
    
    CAD[Cadastros] -.->|fornecedores| COMPRAS
    CAD -.->|itens| EST
    CAD -.->|colaboradores| RH
    CAD -.->|obras| OBRAS
    
    PMO[PMO/EGP] -.->|orçamento| CTRL
    PMO -.->|cronograma| OBRAS

    style COMPRAS fill:#10B981,color:#fff
    style FIN fill:#10B981,color:#fff
    style LOG fill:#EA580C,color:#fff
    style EST fill:#3B82F6,color:#fff
    style CONTRATOS fill:#8B5CF6,color:#fff
    style FISCAL fill:#F59E0B,color:#fff
    style CTRL fill:#14B8A6,color:#fff
    style FROTAS fill:#F43F5E,color:#fff
    style OBRAS fill:#059669,color:#fff
    style RH fill:#64748B,color:#fff
    style PAT fill:#3B82F6,color:#fff
    style CAD fill:#8B5CF6,color:#fff
    style PMO fill:#6366F1,color:#fff
```

---

## Fluxo 1: Compras → Financeiro (Requisição ao Pagamento)

O fluxo principal do sistema — da necessidade de compra ao pagamento do fornecedor.

```mermaid
flowchart TD
    A[Nova Requisição\n3 etapas] -->|cria cmp_requisicoes| B[Fila de Aprovação]
    B -->|aprovação técnica| C[Requisição Aprovada]
    C -->|inicia cotação| D[Fila de Cotações]
    D -->|comprador seleciona| E[Cotação Concluída]
    E -->|aprovação financeira| F[Emissão de Pedido]
    F -->|cria cmp_pedidos +\nfin_contas_pagar| G[Pedido Emitido]
    G -->|parcelas criadas| H[Pipeline Financeiro]
    H -->|liberação + NF| I[Pagamento Realizado]
    
    style A fill:#6366F1,color:#fff
    style G fill:#10B981,color:#fff
    style I fill:#059669,color:#fff
```

### Timeline de 7 Estágios (FluxoTimeline)

| Estágio | Status | Módulo |
|---------|--------|--------|
| 1. Requisição | rascunho → pendente → em_esclarecimento | Compras |
| 2. Validação Técnica | em_aprovacao → aprovada | Aprovações |
| 3. Cotação | em_cotacao → cotacao_enviada | Compras |
| 4. Aprovação Financeira | cotacao_aprovada | Aprovações |
| 5. Pedido | pedido_emitido → aguardando_contrato | Compras |
| 6. Entrega | em_entrega → entregue | Logística |
| 7. Pagamento | aguardando_pgto → pago | Financeiro |

### Dados que cruzam módulos

| Origem | Destino | Dados | Tabelas |
|--------|---------|-------|---------|
| Pedido emitido | Contas a Pagar | Parcelas com valor, vencimento, classe financeira, centro de custo | `cmp_pedidos` → `fin_contas_pagar` |
| NF recebida | Financeiro | Número NF, valor, CNPJ fornecedor | `fis_notas_fiscais` → `fin_contas_pagar.nf_numero` |
| Pagamento confirmado | Controladoria | Valor realizado vs orçado | `fin_contas_pagar` → DRE |

---

## Fluxo 2: Compras → Contratos (Compra Recorrente)

Quando uma requisição é recorrente ou de serviço acima de R$ 2.000, o pedido solicita um contrato.

```mermaid
flowchart LR
    A[Requisição\nrecorrente=true] --> B[Pedido Emitido]
    B -->|SolicitarContratoForm| C[Solicitação de Contrato\nSOL-CON-YYYY-XXXX]
    C --> D[Gestão de Contratos\n7 etapas]
    D --> E[Contrato Assinado]
    E -->|parcelas mensais| F[Financeiro CP]
```

### Regra de Obrigatoriedade (ADR-010)

`deveContrato = true` quando:
- Tipo = **recorrente**, OU
- Tipo = **serviço** E valor estimado > **R$ 2.000**

### Dados cruzados

| Campo | Origem | Destino |
|-------|--------|---------|
| `requisicao_origem_id` | `cmp_requisicoes.id` | `con_contratos.requisicao_origem_id` |
| `valor_mensal` | Pedido | Contrato |
| `prazo_meses` | Pedido | Contrato |

---

## Fluxo 3: Logística → Estoque (Recebimento)

Quando um pedido chega fisicamente na obra, o fluxo de recebimento alimenta o estoque.

```mermaid
flowchart TD
    A[Pedido Emitido] -->|solicitação de transporte| B[Logística\nSolicitações]
    B -->|expedição + romaneio| C[Transporte]
    C -->|chegada na obra| D[Recebimento\nRecebimentoModal]
    D -->|confere itens| E[Estoque\nest_movimentacoes]
    E -->|tipo: entrada| F[Saldo Atualizado\nest_saldos]
    
    D -->|item patrimoniável| G[Patrimônio\npat_imobilizados]
```

### Pipeline Logístico (9 etapas)

| Etapa | Status | Ação |
|-------|--------|------|
| 1 | pendente | Solicitação criada |
| 2 | aprovada | Aprovação da diretoria |
| 3 | em_separacao | Almoxarifado prepara |
| 4 | romaneio_emitido | Documento fiscal emitido |
| 5 | em_expedicao | Aguardando despacho |
| 6 | em_transito | Motorista na estrada |
| 7 | entregue | Chegou no destino |
| 8 | conferido | Conferência física OK |
| 9 | concluido | Movimentação de estoque criada |

### Viagens (agrupamento)

Múltiplas solicitações podem ser agrupadas em uma **Viagem** (`log_viagens`):
- Numeração: `LOG-V-YYYY-NNNN`
- Rota consolidada com N paradas
- Custo rateado entre solicitações
- Entrega parcial por parada

---

## Fluxo 4: Contratos → Financeiro (Medições)

Contratos geram parcelas financeiras via medições aprovadas.

```mermaid
flowchart LR
    A[Contrato Ativo] -->|medição mensal| B[con_medicoes]
    B -->|aprovação| C[Medição Aprovada]
    C -->|gera parcela| D[fin_contas_pagar]
    D -->|pagamento| E[Pago]
```

### Dados cruzados

| Campo | Origem | Destino |
|-------|--------|---------|
| `contrato_id` | `con_contratos.id` | `fin_contas_pagar.contrato_id` |
| `valor_medicao` | `con_medicoes.valor` | `fin_contas_pagar.valor` |
| `classe_financeira` | `con_contratos.classe_financeira_id` | `fin_contas_pagar.classe_financeira_id` |

---

## Fluxo 5: Fiscal → Financeiro (NF vinculada ao pagamento)

```mermaid
flowchart LR
    A[NF Recebida\nXML/PDF] -->|parse n8n| B[fis_notas_fiscais]
    B -->|vincula| C[fin_contas_pagar\nnf_numero]
    C -->|liberação| D[Pagamento\ncom NF anexa]
```

A NF é pré-requisito para liberação de pagamento em muitos casos.

---

## Fluxo 6: Frotas → Financeiro (Custos de Manutenção)

```mermaid
flowchart LR
    A[OS Manutenção\nfro_os] -->|custo peças + MO| B[Custo por Veículo]
    B -->|gera CP| C[fin_contas_pagar]
    
    D[Abastecimento\nfro_abastecimentos] -->|custo combustível| B
```

---

## Fluxo 7: Obras → Financeiro (Adiantamentos)

```mermaid
flowchart LR
    A[Adiantamento\nSolicitado] -->|aprovação| B[Adiantamento Aprovado]
    B -->|gera CP| C[fin_contas_pagar\ntipo: adiantamento]
    C -->|pagamento| D[Pago]
    D -->|prestação de contas| E[Conciliado]
```

---

## Fluxo 8: Cadastros → Todos os Módulos

O módulo de Cadastros é a **fonte de dados mestre** (master data) para todo o sistema.

```mermaid
flowchart TD
    CAD[Cadastros AI] --> F[Fornecedores\ncmp_fornecedores]
    CAD --> I[Itens\nest_itens]
    CAD --> C[Colaboradores\nrh_colaboradores]
    CAD --> O[Obras\nsys_obras]
    CAD --> CF[Classes Financeiras\nfin_classes_financeiras]
    CAD --> CC[Centros de Custo\nfin_centros_custo]
    
    F -->|select em| COMPRAS[Compras]
    F -->|select em| CONTRATOS[Contratos]
    I -->|select em| EST[Estoque]
    I -->|select em| COMPRAS
    C -->|select em| RH[RH]
    C -->|select em| OBRAS2[Obras]
    O -->|filtro global| TODOS[Todos os Módulos]
    CF -->|classificação| FIN[Financeiro]
    CC -->|alocação| FIN
```

### Enriquecimento AI

Cadastros utilizam AI para enriquecer dados:
- **CNPJ lookup**: Auto-preenche razão social, endereço, sócios
- **CEP lookup**: Auto-preenche endereço
- **MagicModal**: Criação rápida inline (AI ou manual) em qualquer módulo

---

## Fluxo 9: PMO/EGP → Controladoria (Orçamento)

```mermaid
flowchart LR
    A[PMO\nOrçamento por Obra] -->|baseline| B[Controladoria\nPlano Orçamentário]
    B -->|realizado vs orçado| C[DRE\nVariação %]
    C -->|alerta| D[Gestor\nAlerta de Desvio]
```

---

## Fluxo 10: SuperTEG → Multi-Módulo

O agente AI SuperTEG interage com múltiplos módulos:

```mermaid
flowchart TD
    ST[SuperTEG Chat] -->|parse cotação| COMPRAS[Compras\nprefill requisição]
    ST -->|consulta CNPJ| CAD[Cadastros]
    ST -->|navegação| NAV[Qualquer Página]
    ST -->|perguntas| DASH[Dashboard\nKPIs]
```

Ver [[49 - SuperTEG AI Agent]] para documentação completa.

---

## Tabela de Referência Cruzada

| Módulo Origem | Módulo Destino | Tabela Ponte | Trigger |
|--------------|---------------|-------------|---------|
| Compras | Financeiro | `fin_contas_pagar` | Emissão de pedido |
| Compras | Contratos | `con_contratos` | Compra recorrente / serviço > R$2k |
| Compras | Logística | `log_solicitacoes` | Pedido para entrega |
| Logística | Estoque | `est_movimentacoes` | Recebimento confirmado |
| Logística | Fiscal | `fis_notas_fiscais` | NF de transporte |
| Contratos | Financeiro | `fin_contas_pagar` | Medição aprovada |
| Fiscal | Financeiro | `fin_contas_pagar.nf_numero` | NF vinculada |
| Frotas | Financeiro | `fin_contas_pagar` | OS concluída |
| Obras | Financeiro | `fin_contas_pagar` | Adiantamento aprovado |
| Obras | RH | `rh_apontamentos` | Apontamento HH |
| Estoque | Patrimônio | `pat_imobilizados` | Item patrimoniável |
| PMO | Controladoria | `ctrl_orcamentos` | Baseline orçamentário |
| Cadastros | Todos | FK refs | Master data |

---

## Links

- [[01 - Arquitetura Geral]] — Visão da arquitetura
- [[11 - Fluxo Requisição]] — Detalhes do fluxo de requisição
- [[12 - Fluxo Aprovação]] — Fluxo de aprovação multi-nível
- [[20 - Módulo Financeiro]] — Pipeline financeiro
- [[21 - Fluxo Pagamento]] — Fluxo de pagamento
- [[23 - Módulo Logística e Transportes]] — Pipeline logístico
- [[27 - Módulo Contratos Gestão]] — Gestão de contratos
- [[49 - SuperTEG AI Agent]] — Agente AI
- [[45 - Mapa de Integrações]] — Integrações externas
