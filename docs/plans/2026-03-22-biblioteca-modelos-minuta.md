# Biblioteca de Modelos de Minuta — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Padronizar 27 categorias de contrato em 12 grupos, vincular modelos de minuta com upload de template a cada grupo, e permitir seleção de template na elaboração de minuta.

**Architecture:** Migration-first approach. Alterar banco (nova coluna + constraint), depois types, depois frontend. Aproveitar a aba Modelos existente (`ModelosContrato.tsx`) e a tabela `con_modelos_contrato`.

**Tech Stack:** Supabase (migration SQL), React + TypeScript, Supabase Storage (upload), TanStack Query (hooks)

**Design Doc:** `docs/plans/2026-03-22-biblioteca-modelos-minuta-design.md`

---

### Task 1: Migration — Adicionar colunas em con_modelos_contrato e alterar con_solicitacoes

**Files:**
- Create: `supabase/046_grupos_contrato.sql`

**Step 1: Escrever a migration**

```sql
-- 046_grupos_contrato.sql
-- Padronizar tipos de contrato em 12 grupos + biblioteca de modelos

-- ── 1. Adicionar colunas em con_modelos_contrato ─────────────────────────────
ALTER TABLE con_modelos_contrato
  ADD COLUMN IF NOT EXISTS grupo_contrato TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_url TEXT,
  ADD COLUMN IF NOT EXISTS versao INT DEFAULT 1;

-- ── 2. Adicionar grupo_contrato e subtipo em con_solicitacoes ───────────────
ALTER TABLE con_solicitacoes
  ADD COLUMN IF NOT EXISTS grupo_contrato TEXT,
  ADD COLUMN IF NOT EXISTS subtipo_contrato TEXT;

-- ── 3. Migrar dados existentes: categoria_contrato → grupo_contrato ─────────
UPDATE con_solicitacoes SET grupo_contrato = CASE
  WHEN categoria_contrato IN ('locacao','locacao_imovel_alojamento','locacao_imovel_canteiro','locacao_imovel_deposito') THEN 'locacao_imovel'
  WHEN categoria_contrato = 'locacao_veiculos' THEN 'locacao_veiculos'
  WHEN categoria_contrato IN ('locacao_equipamentos','locacao_ferramental') THEN 'locacao_equipamentos'
  WHEN categoria_contrato = 'pj_pessoa_fisica' THEN 'equipe_pj'
  WHEN categoria_contrato = 'prestacao_servico' THEN 'prestacao_servicos'
  WHEN categoria_contrato IN ('vigilancia_monitoramento','software_ti','contabilidade','internet_telefonia','servicos_medicos','seguros') THEN 'servico_recorrente'
  WHEN categoria_contrato IN ('fornecimento','aquisicao_equipamentos','aquisicao_ferramental','aquisicao_imovel','aquisicao_veiculos') THEN 'aquisicao'
  WHEN categoria_contrato IN ('subcontratacao','empreitada') THEN 'subcontratacao_empreitada'
  WHEN categoria_contrato IN ('consultoria','juridico_advocacia') THEN 'consultoria_juridico'
  WHEN categoria_contrato IN ('alimentacao_restaurante','hospedagem','frete_transportes') THEN 'apoio_operacional'
  WHEN categoria_contrato = 'seguros' THEN 'seguros'
  ELSE 'outro'
END
WHERE grupo_contrato IS NULL;

-- Subtipo = valor original quando relevante
UPDATE con_solicitacoes SET subtipo_contrato = categoria_contrato
WHERE grupo_contrato IS NOT NULL AND categoria_contrato != grupo_contrato;

-- ── 4. Tornar grupo_contrato NOT NULL com default ───────────────────────────
ALTER TABLE con_solicitacoes
  ALTER COLUMN grupo_contrato SET NOT NULL,
  ALTER COLUMN grupo_contrato SET DEFAULT 'outro';

-- ── 5. Adicionar CHECK constraint no grupo_contrato ─────────────────────────
ALTER TABLE con_solicitacoes
  ADD CONSTRAINT chk_grupo_contrato CHECK (grupo_contrato IN (
    'locacao_imovel','locacao_veiculos','locacao_equipamentos',
    'equipe_pj','prestacao_servicos','servico_recorrente',
    'aquisicao','subcontratacao_empreitada','consultoria_juridico',
    'apoio_operacional','seguros','outro'
  ));

-- ── 6. Remover constraint antiga de categoria_contrato ──────────────────────
ALTER TABLE con_solicitacoes DROP CONSTRAINT IF EXISTS con_solicitacoes_categoria_contrato_check;

-- ── 7. CHECK no grupo_contrato de modelos ───────────────────────────────────
ALTER TABLE con_modelos_contrato
  ADD CONSTRAINT chk_modelo_grupo_contrato CHECK (grupo_contrato IN (
    'locacao_imovel','locacao_veiculos','locacao_equipamentos',
    'equipe_pj','prestacao_servicos','servico_recorrente',
    'aquisicao','subcontratacao_empreitada','consultoria_juridico',
    'apoio_operacional','seguros','outro'
  ));
```

**Step 2: Aplicar a migration via Supabase MCP**

Run: `mcp__402c23fe-4707-49e1-a558-76f47f37d917__apply_migration` com project_id `uzfjfucrinokeuwpbeie`, name `046_grupos_contrato`

**Step 3: Verificar migração**

Run: `SELECT grupo_contrato, count(*) FROM con_solicitacoes GROUP BY grupo_contrato`

**Step 4: Commit**

```bash
git add supabase/046_grupos_contrato.sql
git commit -m "feat(contratos): migration padronizar 12 grupos de contrato + biblioteca modelos"
```

---

### Task 2: Types — Substituir CategoriaContrato por GrupoContrato

**Files:**
- Modify: `frontend/src/types/contratos.ts:302-318`

**Step 1: Substituir types**

Substituir `CategoriaContrato` (lines 306-317) por:

```typescript
export type GrupoContrato =
  | 'locacao_imovel' | 'locacao_veiculos' | 'locacao_equipamentos'
  | 'equipe_pj' | 'prestacao_servicos' | 'servico_recorrente'
  | 'aquisicao' | 'subcontratacao_empreitada' | 'consultoria_juridico'
  | 'apoio_operacional' | 'seguros' | 'outro'
```

Na interface `Solicitacao` (onde referencia `categoria_contrato`), adicionar:
```typescript
grupo_contrato: GrupoContrato
subtipo_contrato?: string
```

Manter `categoria_contrato` como campo legado opcional para não quebrar código existente.

**Step 2: Atualizar ModeloContrato interface em `useContratos.ts:630-644`**

Adicionar ao interface:
```typescript
grupo_contrato: GrupoContrato | null
arquivo_url: string | null
versao: number
```

**Step 3: Criar constante GRUPO_CONTRATO_OPTIONS compartilhada**

Criar em `frontend/src/constants/contratos.ts`:

```typescript
import type { GrupoContrato } from '../types/contratos'

export const GRUPO_CONTRATO_OPTIONS: { value: GrupoContrato; label: string; subtipos?: { value: string; label: string }[] }[] = [
  { value: 'locacao_imovel', label: 'Locação de Imóvel', subtipos: [
    { value: 'alojamento', label: 'Alojamento' },
    { value: 'canteiro', label: 'Canteiro de Obras' },
    { value: 'deposito', label: 'Depósito' },
  ]},
  { value: 'locacao_veiculos', label: 'Locação de Veículos' },
  { value: 'locacao_equipamentos', label: 'Locação de Equipamentos/Máquinas', subtipos: [
    { value: 'equipamentos', label: 'Equipamentos' },
    { value: 'ferramental', label: 'Ferramental' },
  ]},
  { value: 'equipe_pj', label: 'Equipe PJ' },
  { value: 'prestacao_servicos', label: 'Prestação de Serviços', subtipos: [
    { value: 'terceiros', label: 'Terceiros' },
    { value: 'pontual', label: 'Pontual' },
  ]},
  { value: 'servico_recorrente', label: 'Serviço Recorrente', subtipos: [
    { value: 'vigilancia', label: 'Vigilância e Monitoramento' },
    { value: 'ti', label: 'Software e TI' },
    { value: 'contabilidade', label: 'Contabilidade' },
    { value: 'telefonia', label: 'Internet e Telefonia' },
    { value: 'medicos', label: 'Serviços Médicos' },
  ]},
  { value: 'aquisicao', label: 'Aquisição', subtipos: [
    { value: 'equipamentos', label: 'Equipamentos' },
    { value: 'veiculos', label: 'Veículos' },
    { value: 'imovel', label: 'Imóvel' },
    { value: 'ferramental', label: 'Ferramental' },
  ]},
  { value: 'subcontratacao_empreitada', label: 'Subcontratação / Empreitada', subtipos: [
    { value: 'subcontratacao', label: 'Subcontratação' },
    { value: 'empreitada', label: 'Empreitada' },
  ]},
  { value: 'consultoria_juridico', label: 'Consultoria / Jurídico', subtipos: [
    { value: 'consultoria', label: 'Consultoria' },
    { value: 'advocacia', label: 'Advocacia' },
  ]},
  { value: 'apoio_operacional', label: 'Apoio Operacional', subtipos: [
    { value: 'alimentacao', label: 'Alimentação / Restaurante' },
    { value: 'hospedagem', label: 'Hospedagem' },
    { value: 'frete', label: 'Frete / Transportes' },
  ]},
  { value: 'seguros', label: 'Seguros' },
  { value: 'outro', label: 'Outro' },
]
```

**Step 4: Corrigir imports em arquivos que usam CategoriaContrato**

Buscar todos os usos de `CategoriaContrato` e substituir por `GrupoContrato`.

**Step 5: Commit**

```bash
git add frontend/src/types/contratos.ts frontend/src/constants/contratos.ts frontend/src/hooks/useContratos.ts
git commit -m "feat(contratos): types GrupoContrato + constante GRUPO_CONTRATO_OPTIONS"
```

---

### Task 3: NovaSolicitacao — Substituir categorias por grupos

**Files:**
- Modify: `frontend/src/pages/contratos/NovaSolicitacao.tsx`

**Step 1: Substituir CATEGORIA_OPTIONS por import da constante**

Remover o array `CATEGORIA_OPTIONS` (lines 61-89).
Importar `GRUPO_CONTRATO_OPTIONS` de `../../constants/contratos`.

**Step 2: Substituir state e form**

Trocar `categoriaContrato` / `setCategoriaContrato` por `grupoContrato` / `setGrupoContrato`.
Adicionar state `subtipoContrato` / `setSubtipoContrato`.

No JSX do Step 2 (line ~613), substituir o select de categoria por:
- Select de grupo (12 opções)
- Select de subtipo (dinâmico baseado no grupo selecionado, só aparece se o grupo tem subtipos)

**Step 3: Atualizar handleSubmit**

Onde envia `categoria_contrato`, enviar `grupo_contrato` e `subtipo_contrato`.

**Step 4: Verificar build**

Run: `cd frontend && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add frontend/src/pages/contratos/NovaSolicitacao.tsx
git commit -m "feat(contratos): NovaSolicitacao usa 12 grupos padronizados"
```

---

### Task 4: ModelosContrato — Adicionar grupo + upload de arquivo

**Files:**
- Modify: `frontend/src/pages/contratos/ModelosContrato.tsx`
- Modify: `frontend/src/hooks/useContratos.ts`

**Step 1: Adicionar campo grupo_contrato no ModeloForm**

No form, adicionar select de `grupo_contrato` usando `GRUPO_CONTRATO_OPTIONS`.
Incluir no `handleSubmit` e no `onSave` payload.

**Step 2: Adicionar upload de arquivo template**

Adicionar input file (aceita PDF/DOCX).
No submit, fazer upload para Supabase Storage `contratos-anexos/modelos/{modelo_id}/{filename}`.
Salvar `arquivo_url` retornada no modelo.

**Step 3: Adicionar hook useUploadModeloTemplate em useContratos.ts**

```typescript
export function useUploadModeloTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ modeloId, file }: { modeloId: string; file: File }) => {
      const path = `modelos/${modeloId}/${file.name}`
      const { error: upErr } = await supabase.storage
        .from('contratos-anexos')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage
        .from('contratos-anexos')
        .getPublicUrl(path)
      const { error } = await supabase
        .from('con_modelos_contrato')
        .update({ arquivo_url: publicUrl })
        .eq('id', modeloId)
      if (error) throw error
      return publicUrl
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['con-modelos'] }),
  })
}
```

**Step 4: Adicionar filtro por grupo na listagem**

Na página principal de Modelos, adicionar filtro/select no topo para filtrar modelos por grupo.

**Step 5: Commit**

```bash
git add frontend/src/pages/contratos/ModelosContrato.tsx frontend/src/hooks/useContratos.ts
git commit -m "feat(contratos): Modelos com grupo de contrato e upload de template"
```

---

### Task 5: PreparaMinuta — Seleção de modelo/template

**Files:**
- Modify: `frontend/src/pages/contratos/PreparaMinuta.tsx`
- Modify: `frontend/src/hooks/useSolicitacoes.ts` (se necessário)

**Step 1: Buscar modelos disponíveis pelo grupo da solicitação**

Na PreparaMinuta, usar `useModelosContrato()` e filtrar pelo `grupo_contrato` da solicitação carregada.

**Step 2: Adicionar UI de seleção de template**

Antes do formulário de minuta, mostrar seção "Biblioteca de Modelos":
- Lista cards dos modelos disponíveis para o grupo
- Cada card mostra: nome, versão, preview do arquivo
- Botão "Usar como base" em cada card

**Step 3: Ao selecionar modelo, copiar arquivo como minuta**

Quando o usuário clica "Usar como base":
1. Copiar `arquivo_url` do modelo para storage da solicitação
2. Criar registro em `con_minutas` com `tipo = 'modelo'` e `arquivo_url` da cópia
3. Invalidar query de minutas

**Step 4: Commit**

```bash
git add frontend/src/pages/contratos/PreparaMinuta.tsx
git commit -m "feat(contratos): PreparaMinuta mostra biblioteca de modelos por grupo"
```

---

### Task 6: Atualizar referências legadas + SolicitacaoDetalhe

**Files:**
- Modify: `frontend/src/pages/contratos/SolicitacaoDetalhe.tsx`
- Modify: `frontend/src/pages/contratos/GestaoContratos.tsx`
- Modify: qualquer arquivo que use `categoria_contrato`

**Step 1: SolicitacaoDetalhe — mostrar grupo + subtipo**

No CATEGORIA_LABEL mapping, substituir por labels dos novos grupos.
Onde exibe "Categoria:", mostrar "Grupo: Locação de Imóvel — Alojamento".

**Step 2: GestaoContratos — filtros**

Se existirem filtros por categoria, atualizar para filtrar por `grupo_contrato`.

**Step 3: Buscar e atualizar qualquer referência restante**

Grep por `categoria_contrato` e `CategoriaContrato` no frontend e ajustar.

**Step 4: Build final**

Run: `cd frontend && npx tsc --noEmit && npm run build`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(contratos): atualizar referências legadas para grupo_contrato"
```

---

### Task 7: Push + Deploy

**Step 1: Push**

```bash
git push origin main
```

**Step 2: Verificar deploy no Vercel**

Verificar build em https://teg-plus.vercel.app


## Links
- [[obsidian/27 - Módulo Contratos Gestão]]
