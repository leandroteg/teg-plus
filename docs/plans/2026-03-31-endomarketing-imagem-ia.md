# Endomarketing — Geração de Imagem por IA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adicionar modo "Gerar com IA" ao wizard de Endomarketing, usando Gemini Generate Image via n8n para produzir a imagem diretamente, mantendo o modo "Usar Template" (html2canvas) com campos manuais sem chamada de IA.

**Architecture:** Dois caminhos no wizard: (1) Template — usuário preenche campos → html2canvas → PNG; (2) IA — usuário escreve instrução → n8n novo workflow (Gemini Generate Image → Supabase Storage upload) → retorna URL → preview + Salvar/Descartar. O seletor de modo aparece como novo passo 2 no wizard existente.

**Tech Stack:** React 18, TypeScript, Tailwind 3.4, TanStack Query v5, n8n (webhook + Code node + Google Gemini Generate Image node + Supabase Storage node), Supabase Storage

---

## Contexto do Código Existente

### Arquivo principal
`frontend/src/pages/rh/Endomarketing.tsx` — componente `GerarWizard`

### Wizard atual (4 passos)
- **Step 1:** Tipo + Formato
- **Step 2:** Textarea input → botão "Gerar com IA" → chama `useGerarComunicadoIA()` → texto JSON
- **Step 3:** Editar campos do texto (titulo, subtitulo, corpo, destaques, rodape)
- **Step 4:** html2canvas → preview imagem → Download / Salvar

### Hooks relevantes (`frontend/src/hooks/useEndomarketing.ts`)
- `useGerarComunicadoIA()` — POST `/endomarketing/gerar` → retorna `{ titulo, subtitulo, corpo, destaques, rodape }`
- `useSalvarComunicado()` — INSERT em `rh_comunicados`
- `useUploadComunicadoImagem()` — upload Blob para Supabase Storage `mural-banners/comunicados/`

### State do GerarWizard
```ts
const [step, setStep] = useState(1)            // 1-4
const [tipo, setTipo] = useState<TipoComunicado>('aviso_geral')
const [formato, setFormato] = useState<FormatoComunicado>('feed')
const [inputTexto, setInputTexto] = useState('')
const [texto, setTexto] = useState<GerarComunicadoResponse>({...})
```

---

## Novos Passos do Wizard

```
Step 1: Tipo + Formato          (igual hoje)
Step 2: Seletor de modo         (NOVO — substitui o textarea)
          ↙                          ↘
Step 3a: Template               Step 3b: IA
  Preencher campos                Escrever instrução
  (titulo, subtitulo,             → Botão "Gerar Imagem"
   corpo, destaques,              → Loading spinner
   rodape) manualmente            → Imagem gerada (URL)
          ↓                          ↓
Step 4a: Preview html2canvas    Step 4b: Preview imagem URL
  Download / Salvar               Salvar ✓  Descartar ✗
```

---

## Task 1: Criar bucket `endomarketing` no Supabase

**Files:**
- Create: `supabase/069_endomarketing_storage.sql`

**Step 1: Criar migration SQL**

```sql
-- supabase/069_endomarketing_storage.sql
-- Bucket público para imagens geradas por IA do Endomarketing

insert into storage.buckets (id, name, public)
values ('endomarketing', 'endomarketing', true)
on conflict (id) do nothing;

-- RLS: leitura pública, escrita apenas autenticados
create policy "endomarketing_public_read"
  on storage.objects for select
  using (bucket_id = 'endomarketing');

create policy "endomarketing_auth_insert"
  on storage.objects for insert
  with check (bucket_id = 'endomarketing' and auth.role() = 'authenticated');

create policy "endomarketing_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'endomarketing' and auth.role() = 'authenticated');
```

**Step 2: Aplicar via Supabase MCP ou dashboard**

Se usar MCP: `mcp__402c23fe__apply_migration` com o SQL acima.
Se usar dashboard: Supabase → Storage → New Bucket → nome `endomarketing`, marcar Public.

**Step 3: Verificar**

No Supabase Dashboard: Storage → buckets → confirmar `endomarketing` aparece como público.

**Step 4: Commit**

```bash
git add supabase/069_endomarketing_storage.sql
git commit -m "feat(endomarketing): bucket supabase storage para imagens IA"
```

---

## Task 2: Adicionar hook `useGerarImagemIA`

**Files:**
- Modify: `frontend/src/hooks/useEndomarketing.ts` (append ao final)

**Step 1: Definir tipos e adicionar hook**

Adicionar ao final de `useEndomarketing.ts`:

```ts
// ── Geração de Imagem com IA ──────────────────────────────
export interface GerarImagemIAPayload {
  tipo: string
  tipo_label: string
  formato: string
  formato_label: string
  dimensoes: string
  instrucoes: string
  identidade: {
    nome_empresa: string
    slogan: string | null
    cor_primaria: string
    cor_secundaria: string
    logo_url: string | null
  }
}

export interface GerarImagemIAResponse {
  imagem_url: string
}

export function useGerarImagemIA() {
  return useMutation<GerarImagemIAResponse, Error, GerarImagemIAPayload>({
    mutationFn: async (payload) => {
      const res = await fetch(`${N8N_BASE}/endomarketing/gerar-imagem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
      const data = await res.json()
      return Array.isArray(data) ? data[0] : data
    },
  })
}
```

**Step 2: Verificar TypeScript**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: sem erros no arquivo `useEndomarketing.ts`.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useEndomarketing.ts
git commit -m "feat(endomarketing): hook useGerarImagemIA para n8n Gemini Generate Image"
```

---

## Task 3: Refatorar GerarWizard — seletor de modo (Step 2)

**Files:**
- Modify: `frontend/src/pages/rh/Endomarketing.tsx`

### 3a: Adicionar state de modo e imports

No início do componente `GerarWizard`, adicionar estado:

```ts
const [modo, setModo] = useState<'template' | 'ia' | null>(null)
```

Adicionar imports necessários (se ainda não existem):
```ts
import { ..., Wand2, LayoutTemplate } from 'lucide-react'
```

Adicionar import do novo hook:
```ts
import {
  ...,
  useGerarImagemIA,
  type GerarImagemIAPayload,
  type GerarImagemIAResponse,
} from '../../hooks/useEndomarketing'
```

Instanciar o hook dentro do componente:
```ts
const gerarImagem = useGerarImagemIA()
const [imagemGeradaUrl, setImagemGeradaUrl] = useState<string | null>(null)
```

### 3b: Atualizar labels dos steps

Substituir o array `steps` existente:

```ts
// ANTES:
const steps = [
  { n: 1, label: 'Tipo + Formato' },
  { n: 2, label: 'Informacoes' },
  { n: 3, label: 'Texto' },
  { n: 4, label: 'Imagem' },
]

// DEPOIS:
const steps = [
  { n: 1, label: 'Tipo + Formato' },
  { n: 2, label: 'Modo' },
  { n: 3, label: modo === 'ia' ? 'Instrução IA' : 'Conteúdo' },
  { n: 4, label: 'Resultado' },
]
```

### 3c: Renderizar Step 2 — seletor de modo

Substituir o bloco `{/* Step 2: Input */}` existente (linhas ~483–537) por:

```tsx
{/* Step 2: Seletor de Modo */}
{step === 2 && (
  <div className="space-y-5">
    <div>
      <p className={`text-sm font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-white'}`}>
        Como deseja criar este comunicado?
      </p>
      <p className={`text-xs mb-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
        Escolha entre montar o texto manualmente com o template visual ou deixar a IA gerar a imagem completa.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Template */}
        <button
          type="button"
          onClick={() => setModo('template')}
          className={`flex items-start gap-4 p-5 rounded-2xl border text-left transition-all ${
            modo === 'template'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : isLight
                ? 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm text-slate-700'
                : 'bg-white/[0.03] border-white/10 hover:border-indigo-500/40 text-slate-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            modo === 'template' ? 'bg-white/20' : isLight ? 'bg-indigo-50' : 'bg-indigo-500/10'
          }`}>
            <LayoutTemplate size={18} className={modo === 'template' ? 'text-white' : 'text-indigo-500'} />
          </div>
          <div>
            <p className="text-sm font-bold">Usar Template</p>
            <p className={`text-xs mt-1 leading-relaxed ${modo === 'template' ? 'text-white/70' : isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Preencha os campos de texto (título, corpo, destaques) e gere a imagem com a identidade visual configurada.
            </p>
          </div>
        </button>

        {/* IA */}
        <button
          type="button"
          onClick={() => setModo('ia')}
          className={`flex items-start gap-4 p-5 rounded-2xl border text-left transition-all ${
            modo === 'ia'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
              : isLight
                ? 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm text-slate-700'
                : 'bg-white/[0.03] border-white/10 hover:border-indigo-500/40 text-slate-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            modo === 'ia' ? 'bg-white/20' : isLight ? 'bg-violet-50' : 'bg-violet-500/10'
          }`}>
            <Wand2 size={18} className={modo === 'ia' ? 'text-white' : 'text-violet-500'} />
          </div>
          <div>
            <p className="text-sm font-bold">Gerar com IA</p>
            <p className={`text-xs mt-1 leading-relaxed ${modo === 'ia' ? 'text-white/70' : isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              Descreva o que quer comunicar e a IA gera a imagem completa com a identidade visual da empresa.
            </p>
          </div>
        </button>
      </div>
    </div>

    <div className="flex items-center justify-between">
      <button
        onClick={() => setStep(1)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
          isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
        }`}
      >
        <ArrowLeft size={15} /> Voltar
      </button>
      <button
        onClick={() => setStep(3)}
        disabled={!modo}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Próximo <ArrowRight size={15} />
      </button>
    </div>
  </div>
)}
```

**Step verificação:** Abrir `/rh/cultura` → Endomarketing → Gerar Comunicado → selecionar tipo → formato → confirmar que Step 2 mostra os dois cards de modo.

**Step commit:**

```bash
git add frontend/src/pages/rh/Endomarketing.tsx
git commit -m "feat(endomarketing): seletor de modo Template vs Gerar com IA no wizard"
```

---

## Task 4: Step 3 — Modo Template (campos manuais)

**Files:**
- Modify: `frontend/src/pages/rh/Endomarketing.tsx`

O Step 3 atual (preview/edição do texto gerado por IA) precisa ser convertido para preenchimento manual desde o início, quando `modo === 'template'`.

**Step 1: Alterar renderização do Step 3**

O bloco `{/* Step 3: Preview Texto */}` existente já renderiza os campos editáveis (titulo, subtitulo, corpo, destaques, rodape). Apenas:

1. Remover a lógica de "voltar para Step 2 vai regerar" — o Voltar simplesmente retorna ao Step 2.
2. Condicionar o Step 3 a `step === 3 && modo === 'template'`.
3. Garantir que os campos começam vazios (o state `texto` já começa com strings vazias).

Envolver o bloco atual `{step === 3 && (...)}` com a condição `modo === 'template'`:

```tsx
{/* Step 3a: Template — campos manuais */}
{step === 3 && modo === 'template' && (
  // ... conteúdo existente do Step 3 sem alterações internas ...
)}
```

O botão "Gerar Imagem" no final já chama `setStep(4)` — mantém o comportamento.

**Step verificação:** Selecionar modo Template → Step 3 mostra campos em branco para preencher. Preencher titulo → clicar "Gerar Imagem" → vai para Step 4 (html2canvas).

**Step commit:**

```bash
git add frontend/src/pages/rh/Endomarketing.tsx
git commit -m "feat(endomarketing): modo template usa campos manuais sem chamada IA"
```

---

## Task 5: Step 3b — Modo IA (instrução + gerar imagem)

**Files:**
- Modify: `frontend/src/pages/rh/Endomarketing.tsx`

**Step 1: Adicionar helper para montar payload**

Dentro do `GerarWizard`, adicionar função:

```ts
function buildImagemPayload(): GerarImagemIAPayload {
  const tipoInfo = TIPOS.find(t => t.value === tipo)!
  const fmtInfo  = FORMATOS.find(f => f.value === formato)!
  return {
    tipo,
    tipo_label: tipoInfo.label,
    formato,
    formato_label: fmtInfo.label,
    dimensoes: `${fmtInfo.w}x${fmtInfo.h}`,
    instrucoes: inputTexto,
    identidade: {
      nome_empresa: identidade.slogan ?? 'TEG Uniao Energia',
      slogan: identidade.slogan ?? null,
      cor_primaria: identidade.cor_primaria,
      cor_secundaria: identidade.cor_secundaria,
      logo_url: identidade.logo_url ?? null,
    },
  }
}
```

> Nota: `nome_empresa` virá de `identidade` quando esse campo for adicionado ao modelo (futuramente). Por ora, usar fallback hardcoded ou o slogan como referência.

**Step 2: Adicionar handler**

```ts
async function handleGerarImagemIA() {
  const result = await gerarImagem.mutateAsync(buildImagemPayload())
  setImagemGeradaUrl(result.imagem_url)
  setStep(4)
}
```

**Step 3: Renderizar Step 3b**

Adicionar após o bloco `{step === 3 && modo === 'template' && ...}`:

```tsx
{/* Step 3b: IA — instrução livre */}
{step === 3 && modo === 'ia' && (
  <div className="space-y-4">
    <div className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'glass-card'}`}>
      <label className={`text-xs font-semibold block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
        O que você quer comunicar?
      </label>
      <p className={`text-[11px] mb-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
        Descreva livremente o conteúdo. A IA vai combinar sua descrição com o tipo <strong>{TIPOS.find(t => t.value === tipo)?.label}</strong>,
        formato <strong>{FORMATOS.find(f => f.value === formato)?.label}</strong> e a identidade visual da empresa.
      </p>
      <textarea
        className={`${inp} min-h-[160px] resize-y`}
        value={inputTexto}
        onChange={e => setInputTexto(e.target.value)}
        placeholder={TIPOS.find(t => t.value === tipo)?.placeholder ?? 'Descreva o comunicado...'}
      />
      <div className="flex items-center justify-between mt-2">
        <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {inputTexto.length} caracteres
        </span>
      </div>
    </div>

    {gerarImagem.isError && (
      <div className={`p-3 rounded-xl text-xs ${isLight ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
        Erro ao gerar imagem. Verifique o workflow n8n e tente novamente.
      </div>
    )}

    <div className="flex items-center justify-between">
      <button
        onClick={() => setStep(2)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
          isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
        }`}
      >
        <ArrowLeft size={15} /> Voltar
      </button>
      <button
        onClick={handleGerarImagemIA}
        disabled={!inputTexto.trim() || gerarImagem.isPending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {gerarImagem.isPending ? (
          <>
            <Wand2 size={15} className="animate-pulse" />
            Gerando imagem...
          </>
        ) : (
          <>
            <Wand2 size={15} />
            Gerar Imagem
          </>
        )}
      </button>
    </div>
  </div>
)}
```

**Step verificação:** Selecionar modo IA → Step 3 mostra textarea. Botão "Gerar Imagem" fica desabilitado se campo vazio.

**Step commit:**

```bash
git add frontend/src/pages/rh/Endomarketing.tsx
git commit -m "feat(endomarketing): step 3 modo IA com textarea e botao gerar imagem"
```

---

## Task 6: Step 4b — Preview imagem gerada por IA + Salvar/Descartar

**Files:**
- Modify: `frontend/src/pages/rh/Endomarketing.tsx`

O Step 4 atual (html2canvas) deve ser condicional a `modo === 'template'`. Quando `modo === 'ia'`, mostrar a imagem retornada pela URL.

**Step 1: Condicionar Step 4 existente**

Envolver o bloco `{step === 4 && (...)}` atual com `modo === 'template'`:

```tsx
{/* Step 4a: Template — html2canvas preview */}
{step === 4 && modo === 'template' && (
  // ... conteúdo existente inalterado ...
)}
```

**Step 2: Adicionar handler salvar para modo IA**

```ts
async function handleSalvarImagemIA() {
  if (!imagemGeradaUrl) return
  setSaving(true)
  try {
    await salvarCom.mutateAsync({
      tipo,
      formato,
      titulo: TIPOS.find(t => t.value === tipo)?.label ?? tipo,
      subtitulo: null,
      conteudo_texto: inputTexto,
      conteudo_html: null,
      imagem_url: imagemGeradaUrl,
      largura: FORMATOS.find(f => f.value === formato)?.w ?? 1080,
      altura:  FORMATOS.find(f => f.value === formato)?.h ?? 1080,
      input_usuario: inputTexto,
    })
    setSaved(true)
  } finally {
    setSaving(false)
  }
}

function handleDescartarImagemIA() {
  setImagemGeradaUrl(null)
  setStep(3)
}
```

**Step 3: Renderizar Step 4b**

Adicionar após o bloco `{step === 4 && modo === 'template' && ...}`:

```tsx
{/* Step 4b: IA — preview imagem gerada */}
{step === 4 && modo === 'ia' && (
  <div className="space-y-4">
    {saved ? (
      <div className={`flex flex-col items-center gap-4 py-12 rounded-2xl border ${isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
        <CheckCircle2 size={48} className="text-emerald-400" />
        <p className={`text-lg font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>Comunicado salvo com sucesso!</p>
        <button
          onClick={() => {
            setSaved(false)
            setStep(1)
            setInputTexto('')
            setModo(null)
            setImagemGeradaUrl(null)
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors"
        >
          <Plus size={14} /> Novo Comunicado
        </button>
      </div>
    ) : (
      <>
        {/* Preview */}
        {imagemGeradaUrl && (
          <div className={`rounded-2xl border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            <img
              src={imagemGeradaUrl}
              alt="Comunicado gerado por IA"
              className="w-full object-contain max-h-[600px]"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDescartarImagemIA}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            <XCircle size={15} /> Descartar
          </button>

          <a
            href={imagemGeradaUrl ?? '#'}
            download={`comunicado-${tipo}-${formato}-${Date.now()}.png`}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-300 hover:bg-white/5'
            }`}
          >
            <Download size={15} /> Baixar
          </a>

          <button
            onClick={handleSalvarImagemIA}
            disabled={saving || salvarCom.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-semibold transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save size={15} /> Salvar no Histórico
              </>
            )}
          </button>
        </div>
      </>
    )}
  </div>
)}
```

**Step verificação:** Após n8n retornar URL (Task 7), confirmar que a imagem aparece no preview e os botões Descartar / Baixar / Salvar funcionam.

**Step commit:**

```bash
git add frontend/src/pages/rh/Endomarketing.tsx
git commit -m "feat(endomarketing): step 4 modo IA com preview imagem + salvar/descartar"
```

---

## Task 7: Criar workflow n8n — `Endomarketing - Gerar Imagem IA`

> **Nota:** O n8n usado é `https://teg-agents-n8n.nmmcas.easypanel.host`. Use a interface web ou a API para criar o workflow. Esta task descreve a estrutura do workflow a ser configurado manualmente ou via API.

**Step 1: Criar workflow via n8n UI**

Acesse o n8n, clique em "+ New Workflow", renomeie para `Endomarketing - Gerar Imagem IA`.

**Step 2: Adicionar nó Webhook**

- Tipo: Webhook
- HTTP Method: POST
- Path: `endomarketing/gerar-imagem`
- Response Mode: `Using 'Respond to Webhook' Node`
- Adicionar `webhookId` (UUID único, ex: `b2e9f3a1-5c6d-4e7b-8a0f-1d2e3f4a5b6c`)

**Step 3: Adicionar nó Code (JavaScript) — Montar Prompt**

```javascript
const body = $input.first().json.body ?? $input.first().json

const tipoLabel   = body.tipo_label   ?? body.tipo   ?? 'Comunicado'
const fmtLabel    = body.formato_label ?? body.formato ?? 'Feed'
const dimensoes   = body.dimensoes    ?? '1080x1080'
const instrucoes  = body.instrucoes   ?? ''
const id          = body.identidade   ?? {}

const nomeEmpresa = id.nome_empresa ?? 'TEG Uniao Energia'
const slogan      = id.slogan       ?? ''
const corPrimaria = id.cor_primaria ?? '#6366f1'
const corSecund   = id.cor_secundaria ?? '#8b5cf6'

const prompt = [
  `Gere uma imagem de comunicado corporativo interno.`,
  `Tipo: ${tipoLabel}`,
  `Formato: ${fmtLabel} (${dimensoes}px)`,
  `Empresa: ${nomeEmpresa}${slogan ? ` - "${slogan}"` : ''}`,
  `Identidade visual: cor primaria ${corPrimaria}, cor secundaria ${corSecund}.`,
  `Instrucoes: ${instrucoes}`,
  `Estilo: profissional, moderno, clean, corporativo.`,
  `Use as cores da empresa. Destaque o conteudo principal.`,
  `Texto em portugues do Brasil.`,
].join('\n')

return [{ json: { prompt, tipo: body.tipo, formato: body.formato } }]
```

**Step 4: Adicionar nó Google Gemini — Generate Image**

- Tipo: Google Gemini (nó nativo n8n)
- Operation: **Generate Image** (Imagen 3 / imagegeneration)
- Model: `imagen-3.0-generate-001` (ou o disponível)
- Prompt: `{{ $json.prompt }}`
- Conectar a saída do Code node

**Step 5: Adicionar nó Code — Preparar Upload**

```javascript
// O nó Gemini Generate Image retorna a imagem como campo binary ou base64
// Verificar qual campo contém a imagem e preparar para upload

const item = $input.first()
const tipo    = item.json.tipo    ?? 'comunicado'
const formato = item.json.formato ?? 'feed'
const ts      = Date.now()
const filename = `geradas/${tipo}_${formato}_${ts}.png`

return [{ json: { filename }, binary: item.binary }]
```

> **Atenção:** O campo binary exato depende de como o nó Gemini retorna a imagem. Checar no n8n após execução de teste. Pode ser `data`, `image`, ou outro. Ajustar o Code node conforme necessário.

**Step 6: Adicionar nó Supabase — Upload Storage**

Usar HTTP Request node (já que o nó Supabase nativo pode não suportar Storage upload):

- Tipo: HTTP Request
- Method: POST
- URL: `https://uzfjfucrinokeuwpbeie.supabase.co/storage/v1/object/endomarketing/{{ $json.filename }}`
- Authentication: Header Auth
  - Name: `Authorization`
  - Value: `Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- Headers adicionais:
  - `apikey`: `<SUPABASE_ANON_KEY>` (ou service key)
  - `Content-Type`: `image/png`
- Body: Binary data da imagem

**Step 7: Adicionar nó Code — Montar Resposta**

```javascript
const filename = $('Preparar Upload').first().json.filename
const baseUrl  = 'https://uzfjfucrinokeuwpbeie.supabase.co/storage/v1/object/public/endomarketing'
const imagemUrl = `${baseUrl}/${filename}`

return [{ json: { imagem_url: imagemUrl } }]
```

**Step 8: Adicionar nó Respond to Webhook**

- Response Code: 200
- Response Body: `{{ JSON.stringify($json) }}`

**Step 9: Salvar, ativar e testar o workflow**

Teste via curl:
```bash
curl -X POST https://teg-agents-n8n.nmmcas.easypanel.host/webhook/endomarketing/gerar-imagem \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "aviso_geral",
    "tipo_label": "Aviso Geral",
    "formato": "feed",
    "formato_label": "Feed Instagram",
    "dimensoes": "1080x1080",
    "instrucoes": "Reuniao geral na proxima segunda-feira as 9h na sala de conferencias.",
    "identidade": {
      "nome_empresa": "TEG Uniao Energia",
      "slogan": "Energia que conecta",
      "cor_primaria": "#6366f1",
      "cor_secundaria": "#8b5cf6",
      "logo_url": null
    }
  }'
```

Expected response:
```json
{ "imagem_url": "https://uzfjfucrinokeuwpbeie.supabase.co/storage/v1/object/public/endomarketing/geradas/aviso_geral_feed_1743XXXXXX.png" }
```

**Step 10: Commit de documentação do workflow ID**

Após criar e testar o workflow, anotar o ID no design doc:

```bash
# Atualizar docs/plans/2026-03-31-endomarketing-imagem-ia-design.md
# Adicionar: n8n Workflow ID: <id>
git add docs/plans/
git commit -m "docs(endomarketing): adicionar ID workflow n8n gerar imagem IA"
```

---

## Task 8: Reset do wizard ao trocar modo

**Files:**
- Modify: `frontend/src/pages/rh/Endomarketing.tsx`

Quando o usuário voltar ao Step 2 e trocar de modo, o estado anterior deve ser limpo.

**Step 1: Adicionar reset no handler de troca de modo**

Modificar os botões do seletor de modo para resetar estado ao trocar:

```tsx
onClick={() => {
  setModo('template')
  setInputTexto('')
  setTexto({ titulo: '', subtitulo: '', corpo: '', destaques: [], rodape: '' })
  setImagemGeradaUrl(null)
  setSaved(false)
}}
```

```tsx
onClick={() => {
  setModo('ia')
  setInputTexto('')
  setTexto({ titulo: '', subtitulo: '', corpo: '', destaques: [], rodape: '' })
  setImagemGeradaUrl(null)
  setSaved(false)
}}
```

**Step 2: Resetar modo ao voltar ao Step 1**

No botão Voltar do Step 2:
```tsx
onClick={() => { setStep(1); setModo(null) }}
```

**Step commit:**

```bash
git add frontend/src/pages/rh/Endomarketing.tsx
git commit -m "fix(endomarketing): reset estado ao trocar modo no wizard"
```

---

## Task 9: Push e verificação final

**Step 1: Push**

```bash
git pull --rebase && git push
```

**Step 2: Verificação completa do fluxo Template**

1. Abrir `/rh/cultura`
2. Selecionar Endomarketing → Gerar Comunicado
3. Step 1: selecionar tipo "Aniversariante" + formato "Feed"
4. Step 2: selecionar "Usar Template"
5. Step 3: preencher título "Parabéns Maria!", corpo "5 anos de empresa!", rodapé "TEG"
6. Clicar "Gerar Imagem"
7. Step 4: confirmar que o template HTML aparece renderizado via html2canvas
8. Clicar Download → confirmar que a imagem baixa

**Step 3: Verificação completa do fluxo IA**

1. Repetir steps 1-2, mas selecionar "Gerar com IA" no Step 2
2. Step 3: digitar "Aniversário da Maria, 5 anos de empresa, mensagem positiva e colorida"
3. Clicar "Gerar Imagem" → confirmar spinner/loading aparece
4. Aguardar resposta do n8n (pode levar 10-30s para geração)
5. Step 4: confirmar que a imagem gerada aparece no preview
6. Clicar "Salvar no Histórico" → confirmar toast de sucesso
7. Abrir aba Histórico → confirmar que o comunicado aparece na lista

**Step 4: Verificar Histórico**

- O card do modo IA deve mostrar a imagem thumbnail, tipo badge, data, botão Download
- O `imagem_url` salvo deve apontar para o bucket `endomarketing/geradas/`

---

## Resumo dos Arquivos Modificados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `supabase/069_endomarketing_storage.sql` | Create | Bucket `endomarketing` público |
| `frontend/src/hooks/useEndomarketing.ts` | Modify | + `useGerarImagemIA`, tipos `GerarImagemIAPayload/Response` |
| `frontend/src/pages/rh/Endomarketing.tsx` | Modify | Wizard: seletor modo, Step 3a template manual, Step 3b IA, Step 4b preview IA |
| n8n workflow (UI) | Create | `Endomarketing - Gerar Imagem IA` — webhook + Code + Gemini Generate Image + HTTP Upload + Respond |


## Links
- [[obsidian/25 - Mural de Recados]]
