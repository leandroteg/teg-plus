# Cadastros AI-Powered — Design Document

**Data:** 2026-03-05
**Abordagem:** C — Magic Modal (Modais CRUD com toggle AI/Manual)
**Status:** Aprovado

---

## 1. Visao Geral

Modulo unificado de Cadastros (master data) para todas as entidades base do TEG+ ERP.
Acesso via icone de engrenagem "Configuracoes" presente em TODOS os modulos (sidebar desktop + bottom nav mobile).
Nao tem entrada na mandala — e transversal.

### Entidades

| Entidade | Tabela DB | Status Atual | Acao |
|---|---|---|---|
| Fornecedores | cmp_fornecedores | Lista read-only | Adicionar CRUD + AI |
| Itens | est_itens | CRUD com modal | Migrar + AI |
| Classes Financeiras | fin_classes_financeiras (NOVA) | Sem master table | Criar tabela + CRUD |
| Centros de Custo | sys_centros_custo (NOVA) | Sem master table | Criar tabela + CRUD |
| Obras/Projetos | sys_obras | Sem UI | Criar CRUD + AI |
| Colaboradores | rh_colaboradores (NOVA) | Placeholder | Criar tabela + CRUD + AI |

---

## 2. Acesso — Engrenagem em Todos os Modulos

### Desktop (sidebar)
- Adicionar item "Cadastros" com icone Settings (engrenagem) na NAV de CADA layout:
  - FinanceiroLayout, EstoqueLayout, LogisticaLayout, FrotasLayout, RHLayout, ContratosLayout, Layout (Compras)
- Posicao: ultimo item do NAV, antes do theme toggle
- Estilo: mesma cor do modulo ativo (emerald no financeiro, blue no estoque, etc.)
- Rota: `/cadastros`

### Mobile (bottom nav)
- Adicionar icone de engrenagem como ultimo item no bottom nav de cada layout
- Se bottom nav ja tem 6 itens, substituir o menos usado ou usar "more" menu
- Alternativa: engrenagem no mobile header (ao lado do avatar)

### CadastrosLayout
- Layout proprio com sidebar violet
- NAV: Home, Fornecedores, Itens, Classes, C.Custo, Obras, Colaboradores
- Botao "Voltar" no header retorna ao modulo anterior (history.back)

---

## 3. Magic Modal — Componente Central

### Estrutura
```
MagicModal<T>
  props:
    title: string
    entity: 'fornecedor' | 'item' | 'classe' | 'centro_custo' | 'obra' | 'colaborador'
    fields: FieldConfig[]
    initialData?: Partial<T>
    onSave: (data: T) => Promise<void>
    onClose: () => void
    aiEnabled?: boolean  // default true para fornecedores, itens, obras, colaboradores
```

### Modo AI (default para novos cadastros)
1. **Drop Zone** (AiDropZone component)
   - Drag & drop de arquivos (PDF, imagens, CSV)
   - Campo de colagem (paste text/CNPJ/CPF)
   - Camera button no mobile
   - Aceita: PDF, PNG, JPG, CSV, texto
2. **Processamento**
   - Skeleton animation nos campos
   - Barra de progresso indeterminada
   - Timeout: 30s com fallback message
3. **Resultado com confianca**
   - Cada campo mostra ConfidenceField:
     - Verde (>90%): borda-l-emerald-400
     - Amarelo (70-90%): borda-l-amber-400, bg-amber-50
     - Vermelho (<70%): borda-l-rose-400, bg-rose-50
   - Campos sao editaveis
   - Botao "Salvar" ativo

### Modo Manual (default para edicoes)
- Formulario tradicional
- Autocomplete inteligente em campos de texto (busca na base)
- CNPJ: auto-busca ReceitaWS ao digitar 14 digitos
- CEP: auto-busca ViaCEP ao digitar 8 digitos
- Selects com busca (obra, departamento)

### Transicao Adaptativa
- Se modal abre em modo AI e usuario clica num campo -> transicao suave para Manual
- Se esta em Manual e arrasta arquivo -> transicao para AI, processa e volta
- Estado preservado entre transicoes

---

## 4. Banco de Dados — Novas Tabelas

### Migration 025_cadastros_master.sql

```sql
-- fin_classes_financeiras
CREATE TABLE fin_classes_financeiras (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  descricao   text NOT NULL,
  tipo        text CHECK (tipo IN ('receita', 'despesa', 'ambos')) DEFAULT 'ambos',
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- sys_centros_custo
CREATE TABLE sys_centros_custo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  descricao   text NOT NULL,
  obra_id     uuid REFERENCES sys_obras(id),
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- rh_colaboradores
CREATE TABLE rh_colaboradores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  cpf             text UNIQUE,
  cargo           text,
  departamento    text,
  obra_id         uuid REFERENCES sys_obras(id),
  email           text,
  telefone        text,
  data_admissao   date,
  ativo           boolean NOT NULL DEFAULT true,
  foto_url        text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

Todas com RLS + policy authenticated + triggers updated_at.

---

## 5. Pipeline AI

### Fluxo
```
Input (arquivo/texto/CNPJ) -> AiDropZone -> detecta tipo
  -> CNPJ? -> n8n webhook "cnpj-lookup" -> ReceitaWS + ViaCEP
  -> CPF?  -> n8n webhook "cpf-parse"
  -> PDF/Img? -> n8n webhook "ai-cadastro-parse" -> Claude Vision
  -> CSV/Texto? -> n8n webhook "ai-cadastro-parse" -> Claude Text
  -> Resultado: { fields: { [key]: { value, confidence } } }
  -> ConfidenceField preenche formulario
```

### n8n Webhook: ai-cadastro-parse
- Endpoint: POST /webhook/ai-cadastro-parse
- Input: { entity_type, input_type, content, base64?, filename? }
- Output: { fields: Record<string, { value: any; confidence: number }>, detected_entity?: string }

### Fallback (sem n8n)
- CNPJ: fetch ReceitaWS diretamente
- CEP: fetch ViaCEP diretamente
- Texto: regex patterns basicos (CNPJ, CPF, email, telefone)

---

## 6. Arquivos

### Novos componentes
- `components/CadastrosLayout.tsx` — sidebar violet, NAV 7 itens
- `components/MagicModal.tsx` — modal generico com AI/Manual toggle
- `components/AiDropZone.tsx` — drop zone com drag, paste, camera
- `components/ConfidenceField.tsx` — input com indicador confianca

### Novas paginas
- `pages/cadastros/CadastrosHome.tsx` — cards overview + stats + ultimos
- `pages/cadastros/FornecedoresCad.tsx` — lista + magic modal
- `pages/cadastros/ItensCad.tsx` — lista + magic modal
- `pages/cadastros/ClassesFinanceiras.tsx` — lista + modal simples
- `pages/cadastros/CentrosCusto.tsx` — lista + modal simples
- `pages/cadastros/ObrasCad.tsx` — lista + magic modal
- `pages/cadastros/ColaboradoresCad.tsx` — lista + magic modal

### Novos hooks/types
- `hooks/useCadastros.ts` — queries + mutations para todas entidades
- `types/cadastros.ts` — tipos novos (ClasseFinanceira, CentroCusto, Colaborador)

### Arquivos modificados
- `App.tsx` — adicionar rotas /cadastros/*
- Todos os *Layout.tsx — adicionar link "Cadastros" no NAV
- `hooks/useFinanceiro.ts` — atualizar useDistinctClasse/CentroCusto para usar master tables

---

## 7. Cor & Identidade

- Primaria: violet
- Active link: bg-violet-50 text-violet-700 border-violet-200
- Dark: bg-violet-500/15 text-violet-300 border-violet-500/25
- AI gradient: from-violet-500 to-indigo-500
- Confianca: emerald (>90%), amber (70-90%), rose (<70%)

---

## 8. CadastrosHome — Dashboard

Cards por entidade com:
- Icone + contagem total
- Delta da semana (+N esta semana)
- Botao "Novo" que abre Magic Modal direto
- "Ultimos cadastros" — timeline com 5 ultimos de todas entidades

---

## 9. Entidades Simples vs Completas

### Simples (sem AI mode, modal compacto)
- Classes Financeiras: codigo, descricao, tipo (receita/despesa/ambos), ativo
- Centros de Custo: codigo, descricao, obra_id, ativo

### Completas (com AI mode)
- Fornecedores: ~15 campos, CNPJ lookup, PDF parse
- Itens: ~10 campos, CSV import, catalogo parse
- Obras: ~8 campos, contrato parse
- Colaboradores: ~10 campos, CPF lookup, curriculo parse
