# Módulo Compras — TEG+

> Módulo: Compras | Última atualização: 2026-03-03

Documenta o ciclo completo do módulo de Compras do TEG+: desde a abertura de uma requisição de compra até a liberação do pedido para pagamento pelo financeiro.

---

## Visão Geral do Fluxo

```
Solicitante          Comprador                Aprovador          Financeiro
──────────────       ──────────────           ──────────         ──────────
1. Abre RC
   (texto livre
    ou manual)
                  2. IA classifica RC
                     (categoria, comprador,
                      itens estruturados)

                  3. Realiza cotações
                     com ≥ N fornecedores
                     (ou envia com bypass
                      + justificativa)
                                          4. Aprova/Rejeita
                                             cotação
                                             (alerta se sem
                                              mínimo forn.)

                  5. Emite Pedido de
                     Compra (PO)
                     + PDF gerado
                     + Compartilha WhatsApp
                       / E-mail                            → CP criado (Previsto)

                  6. Confirma Entrega

                  7. Libera para
                     Pagamento
                     + Anexa NF, etc.                      → CP: Aguard. Aprovação

                                                           8. Registra Pagamento
                                                              + Sobe comprovante
                                                              → CP: Pago
                                                              → PO: status_pagamento=pago
                  9. Vê comprovante
                     nos Anexos do PO ←─────────────────────────────────────────
```

---

## 1. Requisição de Compra (RC)

### Tabela: `cmp_requisicoes`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `numero` | VARCHAR | RC-AAAA-NNNNN (gerado automaticamente) |
| `solicitante_nome` | TEXT | Nome do solicitante |
| `obra_nome` | TEXT | Obra/projeto vinculado |
| `descricao` | TEXT | Descrição da necessidade |
| `justificativa` | TEXT | Motivação da compra |
| `valor_estimado` | NUMERIC | Valor estimado total |
| `urgencia` | ENUM | normal / urgente / critica |
| `status` | VARCHAR | Ver estados abaixo |
| `alcada_nivel` | INT | Nível de aprovação requerido |
| `categoria` | VARCHAR | Categoria de material |
| `comprador_id` | UUID | Comprador responsável |

### Estados da RC

```
rascunho → pendente → em_aprovacao → aprovada → em_cotacao
                                   → rejeitada
                                               → cotacao_enviada → cotacao_aprovada → pedido_emitido → em_entrega → entregue → aguardando_pgto → pago
                                               → cotacao_rejeitada
```

### Campos de IA (parseamento automático)

```typescript
texto_original   // texto bruto do solicitante
ai_confianca     // 0.0 a 1.0
// Preenchidos automaticamente por useAiParse():
categoria_sugerida, comprador_sugerido,
urgencia_sugerida, obra_sugerida, itens[]
```

---

## 2. Cotações

### Tabela: `cmp_cotacoes`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `requisicao_id` | UUID | RC vinculada |
| `comprador_id` | UUID | Comprador responsável |
| `status` | ENUM | pendente / em_andamento / concluida / cancelada |
| `data_limite` | DATE | Prazo para receber propostas |
| `fornecedor_selecionado_nome` | TEXT | Fornecedor vencedor |
| `valor_selecionado` | NUMERIC | Valor da proposta vencedora |
| **`sem_cotacoes_minimas`** | BOOLEAN | Bypass do mínimo de fornecedores |
| **`justificativa_sem_cotacoes`** | TEXT | Justificativa obrigatória para bypass |

### Tabela: `cmp_cotacao_fornecedores`

Cada fornecedor cotado tem uma linha com:
- `fornecedor_nome`, `fornecedor_cnpj`, `fornecedor_contato`
- `valor_total`, `prazo_entrega_dias`, `condicao_pagamento`
- `itens_precos` (JSONB array)
- `selecionado` (bool — apenas um pode ser `true`)

### Regra de mínimo de cotações

Definida por categoria (`cmp_categorias.cotacoes_regras`):

```json
{ "ate_500": 1, "501_a_2k": 2, "acima_2k": 3 }
```

**Bypass:** O comprador pode marcar "Enviar para aprovação sem todas as cotações" + justificativa obrigatória. A aprovação exibe um **banner de alerta amber** informando ao aprovador.

### RPC Helper

```sql
get_alerta_cotacao(p_requisicao_id UUID) RETURNS JSONB
-- Retorna: { "sem_cotacoes_minimas": bool, "justificativa": text }
```

---

## 3. Aprovações

### Tabela: `cmp_aprovacoes`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `requisicao_id` | UUID | RC vinculada |
| `tipo` | VARCHAR | requisicao / cotacao |
| `nivel` | INT | Nível de alçada (1, 2, 3) |
| `aprovador_nome` | TEXT | Nome do aprovador |
| `status` | ENUM | pendente / aprovada / rejeitada / expirada |
| `token` | UUID | Token para link de aprovação externo |
| `data_limite` | TIMESTAMPTZ | Expiração automática |

### Alçadas por Valor

| Nível | Limite | Aprovador |
|-------|--------|-----------|
| 1 | Até R$ 5.000 | Coordenador |
| 2 | Até R$ 50.000 | Gerente |
| 3 | Acima de R$ 50.000 | Diretor |

Configurado em `cmp_categorias.alcada1_aprovador` e `alcada1_limite`.

### Banner de Alerta (Aprovacao.tsx)

Quando `sem_cotacoes_minimas = true`, exibe antes da decisão:

```
⚠ Aprovação enviada sem o mínimo de cotações
   O comprador justificou: "..."
```

---

## 4. Pedido de Compra (PO)

### Tabela: `cmp_pedidos`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `numero_pedido` | VARCHAR | PO-AAAA-NNNNN |
| `fornecedor_nome` | TEXT | Fornecedor selecionado |
| `valor_total` | NUMERIC | Valor total do PO |
| `status` | ENUM | emitido / confirmado / em_entrega / entregue / cancelado |
| `data_pedido` | DATE | Data de emissão |
| `data_prevista_entrega` | DATE | Prazo de entrega |
| `data_entrega_real` | DATE | Confirmação de entrega |
| `nf_numero` | VARCHAR | Número da nota fiscal |
| **`status_pagamento`** | VARCHAR | liberado / pago |
| **`liberado_pagamento_em`** | TIMESTAMPTZ | Quando foi liberado |
| **`liberado_pagamento_por`** | TEXT | Quem liberou |
| **`pago_em`** | TIMESTAMPTZ | Quando foi pago |

### PDF do Pedido de Compra

Gerado 100% no browser (sem dependências externas):

- Botão **Compartilhar** (ícone Share2) em cada card
- Abre `CompartilharModal` com 3 opções:
  1. **Baixar / Imprimir PDF** — `window.open()` + HTML estilizado + `window.print()`
  2. **WhatsApp** — `https://wa.me/?text=...` com dados formatados
  3. **E-mail** — `mailto:` com subject e body pré-preenchidos

**Conteúdo do PDF:** número do PO, fornecedor, valor, RC de origem, obra, datas, NF, observações.

---

## 5. Anexos do Pedido

### Tabela: `cmp_pedidos_anexos`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `pedido_id` | UUID | PO vinculado |
| `tipo` | ENUM | nota_fiscal / comprovante_entrega / medicao / comprovante_pagamento / contrato / outro |
| `nome_arquivo` | TEXT | Nome original do arquivo |
| `url` | TEXT | URL pública no Storage |
| `mime_type` | VARCHAR | Tipo MIME do arquivo |
| `origem` | VARCHAR | **compras** (enviado pelo comprador) / **financeiro** (enviado pelo financeiro) |
| `uploaded_by_nome` | TEXT | Nome de quem enviou |
| `uploaded_at` | TIMESTAMPTZ | Data/hora do upload |
| `observacao` | TEXT | Observação opcional |

### Storage Bucket: `pedidos-anexos`

- Acesso autenticado (RLS ativa)
- Tamanho máximo: 50 MB por arquivo
- Formatos aceitos: PDF, JPEG, PNG, WebP, XLS, XLSX

### Visibilidade dos Anexos

| Onde é visto | Origem | Tipos |
|--------------|--------|-------|
| Pedidos.tsx (Compras) | compras + financeiro | Todos |
| ContasPagar.tsx (Financeiro) | compras + financeiro | Todos |

O **comprovante de pagamento** (enviado pelo financeiro) fica destacado em verde em ambas as telas.

---

## 6. Liberar para Pagamento

**Quando aparece:** `pedido.status === 'entregue' AND pedido.status_pagamento === null`

### Fluxo no modal (LiberarPagamentoModal)

1. Comprador seleciona arquivo (NF, comprovante, medição, etc.)
2. Escolhe o tipo do documento
3. Adiciona observação (opcional)
4. Clica **"Liberar para Pagamento"**

### O que acontece nos bastidores

```
useUploadAnexo() → Storage bucket + cmp_pedidos_anexos
useLiberarPagamento() → cmp_pedidos.status_pagamento = 'liberado'
                     → cmp_pedidos.liberado_pagamento_em = now()
                     → cmp_pedidos.liberado_pagamento_por = perfil.nome

TRIGGER trig_atualizar_cp_ao_liberar:
  fin_contas_pagar.status: 'previsto' → 'aguardando_aprovacao'
```

---

## 7. Triggers Automáticos (PostgreSQL)

### `trig_criar_cp_ao_emitir_pedido`

**Quando:** INSERT em `cmp_pedidos`
**O que faz:** Cria automaticamente um registro em `fin_contas_pagar` com status `'previsto'`

```sql
data_vencimento = data_prevista_entrega + 30 dias (ou today + 30)
centro_custo    = requisicao.centro_custo
descricao       = requisicao.descricao
natureza        = 'material'
```

### `trig_atualizar_cp_ao_liberar`

**Quando:** UPDATE em `cmp_pedidos` (status_pagamento muda)

| De | Para | Efeito em fin_contas_pagar |
|----|------|---------------------------|
| null | `'liberado'` | status → `'aguardando_aprovacao'` |
| qualquer | `'pago'` | status → `'pago'`, data_pagamento = today |

---

## Hooks do Módulo Compras

| Hook | Arquivo | Propósito |
|------|---------|-----------|
| `useRequisicoes` | useRequisicoes.ts | Lista e filtra RCs |
| `useAiParse` | useAiParse.ts | Parseamento IA de texto livre |
| `useCotacoes` | useCotacoes.ts | Lista cotações |
| `useCotacao` | useCotacoes.ts | Detalhe de uma cotação |
| `useSubmeterCotacao` | useCotacoes.ts | Envia cotação (c/ bypass) |
| `useAlertaCotacao` | useCotacoes.ts | RPC alerta sem mínimo |
| `useAprovacoes` | useAprovacoes.ts | Aprovações pendentes |
| `usePedidos` | usePedidos.ts | Lista pedidos (c/ status_pagamento) |
| `useAtualizarPedido` | usePedidos.ts | Confirmar entrega, etc. |
| `useLiberarPagamento` | usePedidos.ts | Sets status_pagamento='liberado' |
| `useRegistrarPagamento` | usePedidos.ts | Sets status_pagamento='pago' |
| `useAnexosPedido` | useAnexos.ts | Lista anexos de um PO |
| `useUploadAnexo` | useAnexos.ts | Upload Storage + INSERT DB |

---

## Migrations Relacionadas

| Arquivo | Conteúdo principal |
|---------|-------------------|
| `001_*.sql` → `009_*.sql` | Schema base do módulo compras |
| `010_categorias.sql` | Categorias de material com alçadas e regras |
| `012_fix_rls_perfis.sql` | Fix RLS recursiva em sys_perfis |
| `014_fluxo_pagamento.sql` | Anexos, status_pagamento, triggers, storage |

---

## Telas do Módulo

| Rota | Componente | Descrição |
|------|-----------|-----------|
| `/compras` | ModuloSelector | Seletor do módulo |
| `/requisicoes` | Requisicoes.tsx | Lista de RCs |
| `/nova-requisicao` | NovaRequisicao.tsx | Abertura de RC (AI parse) |
| `/cotacoes` | Cotacoes.tsx | Lista de cotações |
| `/cotacao/:id` | CotacaoForm.tsx | Formulário de cotação |
| `/aprovacoes` | Aprovacoes.tsx | Fila de aprovações pendentes |
| `/aprovacao/:token` | Aprovacao.tsx | Tela de decisão do aprovador |
| `/pedidos` | Pedidos.tsx | Lista de POs (+ PDF + Liberar Pgto) |

---

## Status de Implementação

### Concluído ✅

- [x] Requisição de compra (manual + AI parse)
- [x] Cotações com regras de alçada por categoria
- [x] Cotação sem mínimo de fornecedores (bypass + justificativa)
- [x] Alerta visual na tela de aprovação
- [x] Emissão de PO com geração de PDF (sem bibliotecas externas)
- [x] Compartilhamento via WhatsApp e E-mail
- [x] Auto-criação de CP (Previsto) ao emitir PO
- [x] Confirmação de entrega
- [x] Liberar para Pagamento com upload de NF/comprovante
- [x] Histórico de anexos por PO (compras + financeiro)
- [x] Status badges (Aguard. Pagamento / Pago)
- [x] Filtros por status de pagamento nos tabs

### Planejado (Futuro)

- [ ] Notificação por e-mail ao aprovador quando RC é submetida
- [ ] Notificação ao financeiro quando CP vai para aguardando_aprovacao
- [ ] Notificação ao comprador quando comprovante de pgto é enviado
- [ ] Relatório de pedidos em aberto / atrasados
- [ ] Integração direta de NF com SEFAZ (validação CNPJ)
- [ ] App mobile para aprovações
