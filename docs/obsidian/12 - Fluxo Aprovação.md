---
title: Fluxo de Aprovação
type: processo
status: ativo
tags: [aprovação, alçada, token, workflow, multi-nível, aprovaai, multi-tipo]
criado: 2026-03-02
atualizado: 2026-03-10
relacionado: ["[[11 - Fluxo Requisição]]", "[[13 - Alçadas]]", "[[10 - n8n Workflows]]", "[[09 - Auth Sistema]]", "[[27 - Módulo Contratos Gestão]]", "[[20 - Módulo Financeiro]]"]
---

# Fluxo de Aprovação — TEG+ ERP

## Visão Geral

```mermaid
sequenceDiagram
    participant R as Requisitante
    participant N8N as n8n
    participant DB as Supabase
    participant A1 as Aprovador N1
    participant A2 as Aprovador N2

    R->>N8N: POST /compras/requisicao
    N8N->>DB: Insert requisição (status: em_aprovacao)
    N8N->>DB: Insert aprovação N1 (token: abc123)
    N8N-->>R: RC-202602-0042 criada

    Note over A1: Recebe link por email/WhatsApp
    A1->>DB: GET /aprovacao/abc123 (público)
    A1->>N8N: POST /compras/aprovacao {token, decisao: aprovada}
    N8N->>DB: Update aprovação N1 → aprovada
    N8N->>DB: Insert aprovação N2 (token: def456)

    Note over A2: Recebe link por email/WhatsApp
    A2->>N8N: POST /compras/aprovacao {token: def456, decisao: aprovada}
    N8N->>DB: Update aprovação N2 → aprovada
    N8N->>DB: Update requisição → aprovada (nível máximo atingido)
    N8N-->>R: Requisição aprovada ✅
```

---

## Determinação da Alçada

Baseada no valor total estimado da requisição:

```
valor ≤ R$ 5.000      → Nível 1 (Coordenador) — apenas 1 aprovação
valor ≤ R$ 25.000     → Nível 2 (Gerente)     — aprovação 1→2
valor ≤ R$ 100.000    → Nível 3 (Diretor)     — aprovações 1→2→3
valor > R$ 100.000    → Nível 4 (CEO)         — aprovações 1→2→3→4
```

Ver detalhes em [[13 - Alçadas]].

---

## Aprovação Multi-nível (sequencial)

### Exemplo: Requisição de R$30.000 (Alçada 3)

```
Nível 1 (Coordenador)  ──aprovado──→  Nível 2 (Gerente)  ──aprovado──→  Nível 3 (Diretor)
                                                                               │
                                                                         ──aprovado──→
                                                                         REQUISIÇÃO APROVADA ✅
```

### Regras:
- Aprovação é **sequencial** (N1 → N2 → N3 → N4)
- N2 só é criado após N1 aprovar
- **Rejeição em qualquer nível** cancela toda a cadeia
- Aprovações têm **prazo** (configurável por alçada)
- Após prazo: status `expirada` → nova aprovação pode ser criada

---

## Interface de Aprovação (pública)

URL: `https://tegplus.com.br/aprovacao/[token-uuid]`

```
┌──────────────────────────────────────────────┐
│  [Logo TEG+]    ApprovaAi                    │
│                                              │
│  REQUISIÇÃO RC-202602-0042                   │
│  ─────────────────────────                   │
│  Solicitante: João Silva                     │
│  Obra: SE Frutal                             │
│  Categoria: EPI/EPC                          │
│  Urgência: 🟡 Urgente                        │
│  Valor: R$ 250,00                            │
│                                              │
│  ITENS:                                      │
│  • 10x Capacete amarelo — R$25,00/un         │
│  • 5x Luvas de raspa — R$10,00/un            │
│                                              │
│  Observação: [_____________________________] │
│                                              │
│  [✅ APROVAR]          [❌ REJEITAR]          │
└──────────────────────────────────────────────┘
```

> Esta página é **pública** — não requer login.
> Usa token UUID único gerado por requisição/nível.

---

## Lógica n8n — Processar Aprovação

```mermaid
flowchart TD
    W[POST /compras/aprovacao\ntoken + decisao + observacao] --> FT[SELECT aprovacao\nWHERE token = ?]
    FT --> VA{Encontrado?}
    VA -->|Não| E404[Error 404\nToken inválido]
    VA -->|Sim| VE{data_limite\n< NOW?}
    VE -->|Sim| EXP[UPDATE status = expirada\nError 410]
    VE -->|Não| VP{status já\ndecidido?}
    VP -->|Sim| E409[Error 409\nJá processado]
    VP -->|Não| UPD[UPDATE aprovacao\nstatus + observacao + decidido_em]
    UPD --> DEC{decisao =\nrejeitada?}
    DEC -->|Sim| REJ[UPDATE requisicao\nstatus = rejeitada\nCancelar todos os níveis]
    DEC -->|Não| PL{Próximo\nnível existe?}
    PL -->|Sim| CRIA[INSERT apr_aprovacoes\nnivel = atual + 1\ntoken = novo UUID]
    PL -->|Não| FIN[UPDATE requisicao\nstatus = aprovada]
    REJ --> LOG[Log atividade]
    CRIA --> LOG
    FIN --> LOG
    LOG --> RESP[Respond 200]
```

---

## Token de Aprovação

```ts
// Gerado no n8n ao criar aprovação
const token = crypto.randomUUID()  // Ex: 550e8400-e29b-41d4-a716-446655440000

// Inserido na tabela
{
  requisicao_id: "...",
  aprovador_id: "uuid-do-aprovador",
  nivel: 1,
  status: "pendente",
  token: "550e8400-e29b-41d4-a716-446655440000",
  data_limite: new Date(Date.now() + 24 * 60 * 60 * 1000)  // +24h
}

// URL enviada
`https://tegplus.com.br/aprovacao/${token}`
```

---

## Prazos por Nível

| Nível | Cargo | Prazo |
|-------|-------|-------|
| 1 | Coordenador | 24 horas |
| 2 | Gerente | 24 horas |
| 3 | Diretor | 48 horas |
| 4 | CEO | 72 horas |

---

## AprovAi — Central de Aprovacoes Multi-tipo

Rota: `/aprovaai`

Interface unificada para **todas as aprovacoes** do sistema, agrupadas por tipo com cores distintas.

### 4 Tipos de Aprovacao

| Tipo | Label | Cor | Origem | Icone |
|------|-------|-----|--------|-------|
| `cotacao` | Aprovacao Compras | Azul | Cotacoes de compras | FileSearch |
| `autorizacao_pagamento` | Autorizacoes de Pagamento | Amber | Financeiro (`syncCPsParaAprovacao`) | Banknote |
| `minuta_contratual` | Minutas Contratuais | Violeta | Contratos (analise AI) | FileSignature |
| `requisicao_compra` | Validacao Tec. Requisicao de Compra | Teal | Requisicoes de compras | ShoppingCart |

### ApprovalBadge (Header Global)

Componente `ApprovalBadge` exibido no header de todos os modulos:
- Badge circular com contador de aprovacoes pendentes
- Cor teal com animacao de pulse quando ha pendencias
- Clique navega para `/aprovaai`
- Presente em `ModuloSelector.tsx` e `ModuleLayout.tsx`

### Integracao Financeiro → AprovAi

A funcao `syncCPsParaAprovacao()` em `useFinanceiro.ts`:
1. Busca CPs com `status = 'aguardando_aprovacao'` que ainda nao tem registro em `apr_aprovacoes`
2. Cria registros `apr_aprovacoes` com `tipo = 'autorizacao_pagamento'`
3. Executada automaticamente ao carregar aprovacoes pendentes no AprovAi

### Integracao Contratos → AprovAi

Minutas contratuais analisadas pela AI geram registro em `apr_aprovacoes`:
- `tipo = 'minuta_contratual'`
- Vinculado ao contrato/solicitacao
- Card violeta na tela AprovAi com dados do contrato

### Hooks

| Hook | Descricao |
|------|-----------|
| `useAprovacoesPendentes(tipo?)` | Lista aprovacoes pendentes, opcionalmente filtrada por tipo |
| `useDecisaoRequisicao()` | Aprovar/rejeitar requisicao (tipo cotacao/requisicao_compra) |
| `useDecisaoGenerica()` | Aprovar/rejeitar aprovacao generica (pagamento, minuta) |
| `useHistoricoAprovacoes(filtros)` | Historico com filtros por tipo, data, status |
| `useAprovacaoKPIs()` | KPIs: total pendentes, tempo medio, taxa aprovacao |

### KPIs e Historico

A tela AprovAi inclui:
- Cards de KPIs (total pendentes, taxa de aprovacao, tempo medio)
- Aba de historico com filtros por tipo, periodo e status
- Timeline de fluxo (`FluxoTimeline` component)

---

## Notificações (Futuro)

Atualmente: aprovadores recebem o link por **processos manuais**.

**Planejado:**
- WhatsApp via Evolution API → link de aprovação
- Email via Outlook/Microsoft 365 → link de aprovação

Ver [[17 - Roadmap]] para timeline.

---

## Links Relacionados

- [[11 - Fluxo Requisição]] — Contexto do fluxo completo
- [[13 - Alçadas]] — Regras de alçada e prazos
- [[10 - n8n Workflows]] — Workflow de processamento
- [[09 - Auth Sistema]] — Auth e rota pública /aprovacao/:token
- [[03 - Páginas e Rotas]] — Páginas Aprovacao.tsx e AprovAi.tsx
