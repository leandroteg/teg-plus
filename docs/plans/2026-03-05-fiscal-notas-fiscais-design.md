# Design: Modulo Fiscal — Historico de Notas Fiscais

**Data:** 2026-03-05
**Status:** Aprovado
**Escopo:** Primeira entrega — repositorio centralizado de NFs dentro do Financeiro

---

## Contexto

A contabilidade precisa de acesso organizado as Notas Fiscais de entrada para controle de creditos PIS/COFINS. Hoje as NFs estao espalhadas: anexos nos pedidos (Compras), documentos nas CPs (Financeiro), medicoes de contratos. Nao existe visao centralizada nem forma facil de baixar em lote.

## Decisoes de Design

1. **Abordagem:** Tabela centralizada `fis_notas_fiscais` (vs VIEW ou frontend-only)
2. **Localizacao:** Dentro do modulo Financeiro em `/financeiro/notas-fiscais`
3. **Formato NFs:** PDFs do DANFE (nao XML) — precisa de parse AI via n8n
4. **Download lote:** ZIP via n8n (server-side, robusto)
5. **Escopo v1:** Sem configuracoes fiscais/tributarias (muito complexo)

## Schema: `fis_notas_fiscais`

```sql
CREATE TABLE fis_notas_fiscais (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT,
  serie             TEXT DEFAULT '1',
  chave_acesso      TEXT,
  data_emissao      DATE NOT NULL,
  data_entrada      DATE DEFAULT CURRENT_DATE,

  -- Fornecedor (denormalizado + FK)
  fornecedor_id     UUID REFERENCES fin_fornecedores(id),
  fornecedor_cnpj   TEXT,
  fornecedor_nome   TEXT,

  -- Valores
  valor_total       NUMERIC(15,2) NOT NULL,
  valor_desconto    NUMERIC(15,2) DEFAULT 0,
  valor_liquido     NUMERIC(15,2) GENERATED ALWAYS AS (valor_total - COALESCE(valor_desconto, 0)) STORED,

  -- Classificacao
  classe_id         UUID REFERENCES fin_classes_financeiras(id),
  centro_custo_id   UUID REFERENCES sys_centros_custo(id),
  empresa_id        UUID REFERENCES sys_empresas(id),
  obra_id           UUID REFERENCES sys_obras(id),

  -- Origem
  origem            TEXT NOT NULL CHECK (origem IN ('pedido','cp','contrato','avulso')),
  pedido_id         UUID REFERENCES cmp_pedidos(id),
  conta_pagar_id    UUID REFERENCES fin_contas_pagar(id),
  contrato_id       UUID REFERENCES con_contratos(id),

  -- Arquivos (Supabase Storage)
  pdf_path          TEXT,
  pdf_url           TEXT,
  xml_path          TEXT,
  xml_url           TEXT,

  -- Meta
  observacoes       TEXT,
  criado_por        UUID REFERENCES auth.users(id),
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

Indices: data_emissao, fornecedor_id, centro_custo_id, classe_id, empresa_id, origem.
RLS: SELECT/INSERT/UPDATE/DELETE para authenticated.
Storage bucket: `notas-fiscais`.

## UI: Pagina /financeiro/notas-fiscais

### Conceito: "Repositorio de Notas — organizar e baixar"

Pagina simples, limpa, foco em: **filtrar > selecionar > baixar**.

### Elementos:
- **Header:** titulo + botao "+ Upload NF"
- **Filtros inline:** Mes/Ano (seletor), Centro de Custo (dropdown), Busca textual
- **Resumo inline:** "127 notas • R$ 842.350,00" (dinamico conforme filtros)
- **Botao "Baixar ZIP":** gera ZIP das selecionadas via n8n
- **Lista checklist:** cada NF como item com checkbox
  - Linha principal: numero + fornecedor + valor
  - Linha secundaria: data + centro custo + classe + badge origem (Pedido/CP/Avulso)
  - Botao download individual do PDF

### Sem complicacao:
- Sem tabs, sem dashboard, sem graficos
- Sem configuracoes fiscais/tributarias
- Uma tela, um proposito

## Modal de Upload

1. Dropzone para PDF
2. Upload para Supabase Storage
3. n8n webhook `/fiscal/nf/parse` — AI extrai dados do PDF
4. Formulario pre-preenchido com dados extraidos
5. Usuario confirma/edita: fornecedor, valor, data, CC, classe, empresa
6. Salvar → INSERT em fis_notas_fiscais

## Fluxo de Dados

### Upload avulso:
```
PDF → Storage → n8n parse AI → dados extraidos → usuario confirma → INSERT
```

### De pedidos (v1 manual):
```
Botao "Importar NFs dos Pedidos" → busca anexos tipo nota_fiscal
→ cria registros em fis_notas_fiscais com dados do pedido
```

### Download lote:
```
Filtros aplicados → selecao → n8n /fiscal/nf/download-lote
→ busca PDFs do Storage → gera ZIP → download no browser
```

## Integracao com Financeiro

- Nova entrada no FinanceiroLayout sidebar: "Notas Fiscais" com icone FileText
- Novas rotas no App.tsx: `/financeiro/notas-fiscais`
- Hook: `useNotasFiscais.ts` (TanStack Query)
- Types: `types/fiscal.ts`

## Tecnologias

- Frontend: React + TailwindCSS (padrao TEG+)
- DB: Supabase (migration + RLS + Storage)
- Parse AI: n8n webhook + Claude/GPT-4o
- ZIP: n8n webhook server-side
- Hooks: TanStack Query v5

## Fora de escopo (v1)

- Configuracoes fiscais/tributarias
- Detalhamento PIS/COFINS por item
- CFOP, CST, NCM
- Emissao de NF-e/NFS-e
- Integracao SEFAZ
- Cancelamento/inutilizacao


## Links
- [[obsidian/29 - Módulo Fiscal]]
