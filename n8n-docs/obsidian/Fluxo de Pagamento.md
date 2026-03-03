# Fluxo de Pagamento — Compras → Financeiro

> Módulo: Compras + Financeiro | Última atualização: 2026-03-03

Documenta o ciclo completo de liberação e confirmação de pagamento de pedidos de compra, desde a emissão do PO até o pagamento registrado no financeiro.

---

## Visão Geral do Fluxo

```
Compras                                   Financeiro
───────────────────────────────────────   ──────────────────────────────────
1. Cotação enviada com mínimo de 3 forn.
   └─ Ou bypass com justificativa ──────▶ Alerta visível na aprovação

2. Cotação aprovada → Emitir PO ─────────▶ CP criado automaticamente (Previsto)

3. PO recebido pelo fornecedor
   └─ Comprador confirma entrega

4. Comprador "Libera para Pagamento"      ────────────────────────────────▶
   + Anexa NF / comprovante entrega              CP muda: Previsto → Aguard. Aprovação

5. Financeiro vê CP com status
   "Aguard. Aprovação"
   + Pode ver todos os anexos de compras
   + Faz upload do comprovante de pgto   ────────────────────────────────▶
   + Clica "Registrar Pagamento"                 CP muda: Aguard. Aprovação → Pago
                                                 PO: status_pagamento = 'pago'

6. Comprador vê status Pago na tela               ◀──────────────────────────────
   + Comprovante de pgto visível nos anexos
```

---

## 1. Cotação sem mínimo de fornecedores

### Frontend: CotacaoForm.tsx

Quando o comprador não atingiu o mínimo de cotações válidas, aparece uma seção adicional:

- **Checkbox:** "Enviar para aprovação sem todas as cotações"
- **Textarea (obrigatório ao marcar):** Justificativa
- O botão "Enviar para Aprovação" fica habilitado quando:
  - `validos.length >= minCot` (caminho normal), **ou**
  - `semCotacoesMinimas === true && justificativa.trim() !== ''`

### Payload enviado à API

```typescript
// NovaCotacaoPayload estendido
{
  cotacao_id: string
  fornecedores: [...]
  sem_cotacoes_minimas: true,           // novo
  justificativa_sem_cotacoes: "Urgência de obra, prazo esgotado"  // novo
}
```

### DB: cmp_cotacoes

```sql
ALTER TABLE cmp_cotacoes
  ADD COLUMN sem_cotacoes_minimas     BOOLEAN DEFAULT false,
  ADD COLUMN justificativa_sem_cotacoes TEXT;
```

### Frontend: Aprovacao.tsx

Na tela de aprovação, se `sem_cotacoes_minimas = true`, exibe um **banner amber**:

```
⚠ Aprovação enviada sem o mínimo de cotações
   Justificativa do comprador: "..."
```

O alerta é buscado via RPC `get_alerta_cotacao(p_requisicao_id)` que retorna:
```json
{ "sem_cotacoes_minimas": true, "justificativa": "..." }
```

---

## 2. PDF e Compartilhamento do Pedido de Compra

### Frontend: Pedidos.tsx — `CompartilharModal`

Cada card de pedido tem um botão **Compartilhar** (ícone `Share2`). Abre um modal com três ações:

| Ação | Implementação |
|------|---------------|
| Baixar / Imprimir PDF | `window.open()` + HTML estilizado + `window.print()` |
| WhatsApp | `https://wa.me/?text=` com mensagem formatada |
| E-mail | `mailto:` com subject e body codificados |

**Conteúdo do PDF:**
- Header com logo TEG+ (nome em texto) e número do pedido
- Fornecedor, valor total, obra
- RC de origem (número + descrição)
- Datas: emissão, prevista entrega, real (se entregue)
- NF número (se disponível)
- Observações
- Rodapé com data/hora de geração

**Não requer bibliotecas externas.** Usa apenas APIs nativas do navegador.

---

## 3. Liberar para Pagamento

### Quando aparece o botão

O botão **"Liberar para Pagamento"** fica visível no card do pedido quando:
```
pedido.status === 'entregue'
AND pedido.status_pagamento === null/undefined
```

### Modal: LiberarPagamentoModal

1. Drop-zone para upload de arquivo (NF, comprovante entrega, medição, etc.)
2. Seletor de tipo: `nota_fiscal | comprovante_entrega | medicao | outro`
3. Campo de observação (opcional)
4. Botão "Liberar para Pagamento"

### Processo ao confirmar

```
1. useUploadAnexo.mutateAsync({
     pedidoId, file, tipo, observacao, origem: 'compras'
   })
   → Upload para Storage bucket 'pedidos-anexos'
   → INSERT em cmp_pedidos_anexos

2. useLiberarPagamento.mutateAsync(pedidoId)
   → UPDATE cmp_pedidos SET
       status_pagamento = 'liberado',
       liberado_pagamento_em = now(),
       liberado_pagamento_por = perfil.nome

3. TRIGGER: trig_atualizar_cp_ao_liberar
   → UPDATE fin_contas_pagar SET status = 'aguardando_aprovacao'
     WHERE pedido_id = NEW.id AND status = 'previsto'
```

### Schema: cmp_pedidos (campos adicionados)

```sql
ALTER TABLE cmp_pedidos
  ADD COLUMN status_pagamento        VARCHAR(30) CHECK (... IN ('liberado','pago')),
  ADD COLUMN liberado_pagamento_em   TIMESTAMPTZ,
  ADD COLUMN liberado_pagamento_por  TEXT,
  ADD COLUMN pago_em                 TIMESTAMPTZ;
```

---

## 4. Auto-criação de Contas a Pagar

### Trigger: `trig_criar_cp_ao_emitir_pedido`

Ao inserir um novo pedido (INSERT em `cmp_pedidos`), o trigger cria automaticamente um registro em `fin_contas_pagar` com status **'previsto'**:

```sql
INSERT INTO fin_contas_pagar (
  pedido_id, requisicao_id, fornecedor_nome, valor_original,
  data_emissao, data_vencimento, data_vencimento_orig,
  status, centro_custo, descricao, natureza
) VALUES (
  NEW.id, NEW.requisicao_id, NEW.fornecedor_nome, NEW.valor_total,
  CURRENT_DATE,
  COALESCE(NEW.data_prevista_entrega::DATE + 30, CURRENT_DATE + 30), -- data de vencimento
  ..., 'previsto', v_req.centro_custo, v_req.descricao, 'material'
);
```

**Idempotente:** não cria duplicados se a CP já existir.

### Trigger: `trig_atualizar_cp_ao_liberar`

Atualiza `fin_contas_pagar` quando `cmp_pedidos.status_pagamento` muda:

| status_pagamento | Ação na CP |
|------------------|-----------|
| `'liberado'` | `status = 'aguardando_aprovacao'` |
| `'pago'` | `status = 'pago'`, `data_pagamento = CURRENT_DATE` |

---

## 5. Histórico de Anexos

### Tabela: `cmp_pedidos_anexos`

```sql
CREATE TABLE cmp_pedidos_anexos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id        UUID REFERENCES cmp_pedidos(id) ON DELETE CASCADE,
  tipo             VARCHAR(50) NOT NULL CHECK (tipo IN (
    'nota_fiscal', 'comprovante_entrega', 'medicao',
    'comprovante_pagamento', 'contrato', 'outro'
  )),
  nome_arquivo     TEXT NOT NULL,
  url              TEXT NOT NULL,
  tamanho_bytes    BIGINT,
  mime_type        VARCHAR(50),
  uploaded_by      UUID,    -- sys_perfis.id
  uploaded_by_nome TEXT,
  origem           VARCHAR(20) DEFAULT 'compras' CHECK (origem IN ('compras','financeiro')),
  uploaded_at      TIMESTAMPTZ DEFAULT now(),
  observacao       TEXT
);
```

### Storage Bucket: `pedidos-anexos`

- **Acesso:** Privado (autenticados via RLS)
- **Tamanho máximo:** 50 MB por arquivo
- **Tipos aceitos:** PDF, JPEG, PNG, WebP, XLS, XLSX

### Hook: useAnexos.ts

```typescript
// Listar anexos de um pedido
useAnexosPedido(pedidoId)  // polling 15s

// Upload + INSERT em cmp_pedidos_anexos
useUploadAnexo()
// Params: { pedidoId, file, tipo, observacao?, origem? }
```

### Em Compras (Pedidos.tsx)

- Seção expandível no card do pedido
- Mostra todos os anexos (compras + financeiro)
- Comprovante de pagamento tem destaque visual (bg-emerald-50)

### Em Financeiro (ContasPagar.tsx)

- Botão "Anexos" nos cards que possuem `pedido_id`
- Expansão mostra histórico completo de anexos
- Badge de origem: "Compras" (teal) / "Financeiro" (roxo)
- Upload de comprovante de pagamento direto da tela financeiro

---

## 6. Registrar Pagamento (Financeiro)

### Fluxo na ContasPagar.tsx

O botão **"Registrar Pagamento"** aparece quando:
```
cp.status IN ('aguardando_aprovacao', 'aprovado_pgto')
AND cp.status NOT IN ('pago', 'conciliado')
```

### Modal: RegistrarPgtoModal

1. Resumo da CP (fornecedor, valor)
2. Upload opcional de comprovante de pagamento
3. Campo de observação
4. Botão "Confirmar Pagamento"

### Processo ao confirmar

```
1. Se arquivo selecionado E cp.pedido_id existe:
   useUploadAnexo({ pedidoId, file, tipo: 'comprovante_pagamento', origem: 'financeiro' })

2a. Se cp.pedido_id existe:
    useRegistrarPagamento(pedidoId)
    → UPDATE cmp_pedidos SET status_pagamento='pago', pago_em=now()
    → TRIGGER: UPDATE fin_contas_pagar SET status='pago', data_pagamento=CURRENT_DATE

2b. Se cp.pedido_id é null (Omie-importado):
    useMarcarCPPago({ cpId })
    → UPDATE fin_contas_pagar SET status='pago', data_pagamento=today
```

---

## Hooks Envolvidos

| Hook | Arquivo | Propósito |
|------|---------|-----------|
| `useAlertaCotacao` | `useCotacoes.ts` | RPC get_alerta_cotacao para Aprovacao.tsx |
| `useSubmeterCotacao` | `useCotacoes.ts` | Payload ampliado com sem_cotacoes_minimas |
| `useAnexosPedido` | `useAnexos.ts` | Lista anexos por pedido (polling 15s) |
| `useUploadAnexo` | `useAnexos.ts` | Upload Storage + INSERT cmp_pedidos_anexos |
| `useLiberarPagamento` | `usePedidos.ts` | Sets status_pagamento='liberado' |
| `useRegistrarPagamento` | `usePedidos.ts` | Sets status_pagamento='pago' |
| `useMarcarCPPago` | `useFinanceiro.ts` | Update direto fin_contas_pagar.status='pago' |

---

## Migration: 014_fluxo_pagamento.sql

Execute no Supabase SQL Editor:

```bash
# Arquivo: supabase/014_fluxo_pagamento.sql
# Seções:
# 1. ALTER TABLE cmp_cotacoes (sem_cotacoes_minimas)
# 2. CREATE TABLE cmp_pedidos_anexos
# 3. ALTER TABLE cmp_pedidos (status_pagamento, liberado_pagamento_em/por, pago_em)
# 4. Storage bucket 'pedidos-anexos'
# 5. RLS policies para cmp_pedidos_anexos
# 6. TRIGGER: criar_cp_ao_emitir_pedido
# 7. TRIGGER: atualizar_cp_ao_liberar_pagamento
# 8. FUNCTION: get_alerta_cotacao(p_requisicao_id)
```

---

## Status de Implementação

### Concluído ✅

- [x] SQL migration 014_fluxo_pagamento.sql
- [x] useCotacoes.ts — useSubmeterCotacao (sem_cotacoes_minimas) + useAlertaCotacao
- [x] usePedidos.ts — useLiberarPagamento + useRegistrarPagamento
- [x] useAnexos.ts (novo arquivo)
- [x] useFinanceiro.ts — useMarcarCPPago
- [x] CotacaoForm.tsx — checkbox + justificativa + lógica de submit
- [x] Aprovacao.tsx — banner de alerta sem_cotacoes_minimas
- [x] Pedidos.tsx — PDF/Share + LiberarPagamento + AnexosList + status badges
- [x] ContasPagar.tsx — AnexosList + RegistrarPgtoModal + upload comprovante

### Pendente (próximas versões)

- [ ] E-mail automático para financeiro quando CP muda para 'aguardando_aprovacao'
- [ ] Dashboard com KPI "Pedidos aguardando pagamento"
- [ ] Notificação push quando comprovante de pagamento é anexado pelo financeiro
- [ ] Relatório de aging de pagamentos pendentes
