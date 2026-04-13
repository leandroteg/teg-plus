# Recebimento — Compras ↔ Estoque ↔ Patrimonial Integration

**Date:** 2026-03-07
**Status:** Approved
**Scope:** One-click receiving flow that auto-creates estoque entries + patrimonial suggestions

---

## Problem

Compras, Estoque, and Patrimonial operate 100% independently. When a PO is delivered, nothing happens automatically — almoxarife must manually create stock entries, and patrimonial assets are registered separately with no link to the purchase.

## Solution

New `cmp_recebimentos` + `cmp_recebimento_itens` tables. A single confirm click from the receiver triggers a DB function that atomically:
1. Creates `est_movimentacoes` entries (tipo=entrada)
2. Updates `est_saldos`
3. If patrimonial → creates pending `pat_imobilizados` suggestion
4. Updates PO status (parcial vs total)

## Receiving Personas

- **Obra** → almoxarife
- **Escritório** → comprador
- **Serviço** → gestor/engenheiro/supervisor

## Data Model

### New: cmp_recebimentos
- id, pedido_id (FK), base_id (FK est_bases), recebido_por (FK sys_usuarios)
- nf_numero, nf_chave, data_recebimento, observacao

### New: cmp_recebimento_itens
- id, recebimento_id (FK), requisicao_item_id (FK), item_estoque_id (FK nullable)
- descricao, quantidade_esperada, quantidade_recebida, valor_unitario
- lote, numero_serie, data_validade
- tipo_destino: 'consumo' | 'patrimonial'

### Modified tables
- est_movimentacoes → add recebimento_item_id (FK nullable)
- pat_imobilizados → add recebimento_item_id (FK nullable)

### PO Status Flow (updated)
emitido → confirmado → parcialmente_recebido → entregue → pago

## DB Trigger: fn_processar_recebimento()

On INSERT to cmp_recebimento_itens:
1. INSERT est_movimentacoes (tipo=entrada) + UPDATE est_saldos
2. If patrimonial → INSERT pat_imobilizados (status=pendente_registro)
3. Recalc PO status (partial vs full)

## UX

### Compras (Pedidos page)
- "Receber" button on POs with status confirmado/em_entrega/parcialmente_recebido
- Opens form with items pre-filled, quantity adjustable, patrimonial checkbox

### Estoque (dashboard)
- Entries from POs show badge "PO-XXXX" in movimentacoes list

### Patrimonial
- Items with status=pendente_registro shown prominently
- Gestor completes: vida_util, taxa_depreciacao, numero_patrimonio, responsavel


## Links
- [[obsidian/22 - Módulo Estoque e Patrimonial]]
- [[obsidian/23 - Módulo Logística e Transportes]]
