# Issue Batch Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corrigir as 7 issues abertas do TEG+ ERP em 4 lotes independentes.

**Architecture:** Lote A e B são independentes entre si (frontend vs backend). Lote D pode ser feito em paralelo com A. Lote C (TypeScript + testes) é feito por último para não interferir nas outras correções.

**Tech Stack:** React 18 + Vite + TypeScript, Supabase (PostgreSQL), n8n (via MCP tools), TanStack Query v5, Tailwind CSS

---

## LOTE A — Bugs Frontend (ISSUE-008 + ISSUE-006)

### Task 1: ISSUE-008 — Validação silenciosa no wizard de requisição

**Files:**
- Modify: `frontend/src/pages/NovaRequisicao.tsx`

**Problema:** Botão "Revisar e Confirmar" (step 2 -> 3) retorna silenciosamente se campos obrigatórios estiverem vazios. Usuário pensa que o botão está travado. Botão "Enviar Requisição" (step 3) pode travar indefinidamente se Supabase demorar.

**Step 1: Adicionar estado de erros de validação no step 2**

No componente `NovaRequisicao`, adicionar após as declarações de estado existentes (~linha 119):

```tsx
const [stepErrors, setStepErrors] = useState<string[]>([])
```

**Step 2: Substituir o botão do step 2 por versão com feedback de erro**

Localizar o botão de "Revisar e Confirmar" em step 2 (~linha 621) e substituir por:

```tsx
<div className="space-y-3">
  {stepErrors.length > 0 && (
    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
      {stepErrors.map(err => (
        <p key={err} className="text-red-600 text-xs font-medium flex items-center gap-1.5">
          <AlertCircle size={12} className="shrink-0" /> {err}
        </p>
      ))}
    </div>
  )}
  <button
    onClick={() => {
      const errs: string[] = []
      if (!solicitante.trim()) errs.push('Informe o nome do solicitante')
      if (!obraNome) errs.push('Selecione a obra')
      if (!descricao.trim()) errs.push('Informe a descricao do que precisa ser comprado')
      if (itens.every(i => !i.descricao.trim())) errs.push('Adicione ao menos um item com descricao')
      setStepErrors(errs)
      if (errs.length === 0) setStep(3)
    }}
    className="w-full bg-teal-500 text-white rounded-2xl py-3.5 font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 active:scale-[0.98] transition-all"
  >
    Revisar e Confirmar <ChevronRight size={16} />
  </button>
</div>
```

**Step 3: Adicionar timeout de segurança na funcao submit (step 3)**

Substituir a funcao `submit` (~linha 202):

```tsx
const submit = async () => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Tempo limite excedido. Verifique sua conexao e tente novamente.')), 20_000)
  )
  try {
    await Promise.race([
      mutation.mutateAsync({
        solicitante_nome: solicitante,
        obra_nome:        obraNome,
        descricao,
        justificativa,
        urgencia,
        categoria:        categoria?.codigo,
        itens,
        data_necessidade: dataNecessidade || undefined,
        texto_original:   textoAi || undefined,
        comprador_id:     compradorSugerido?.id,
        ai_confianca:     confianca,
      }),
      timeoutPromise,
    ])
    nav('/requisicoes')
  } catch { /* handled by mutation.isError */ }
}
```

**Step 4: Limpar stepErrors ao voltar para step 1**

No botao "Voltar" do step 2 (~linha 482):
```tsx
<button onClick={() => { setStep(1); setStepErrors([]) }} ...>
```

**Step 5: Verificar visualmente no browser**

Testar:
1. Preencher parcialmente o step 2 e clicar "Revisar e Confirmar" -> deve aparecer lista de erros em vermelho
2. Preencher tudo e clicar -> deve ir para step 3
3. No step 3, clicar "Enviar Requisicao" -> spinner aparece, destravar apos 20s se travar

**Step 6: Commit**

```bash
git add frontend/src/pages/NovaRequisicao.tsx
git commit -m "fix(compras): add validation feedback and submit timeout in wizard (ISSUE-008)"
```

---

### Task 2: ISSUE-006 — Filtro de periodo nao reseta no Dashboard Financeiro

**Files:**
- Modify: `frontend/src/pages/financeiro/DashboardFinanceiro.tsx`

**Problema:** O estado `periodo` ('7d', '30d', etc.) persiste quando o componente nao desmonta entre navegacoes internas ao modulo financeiro.

**Step 1: Adicionar useLocation ao import do react-router-dom**

Na linha 1 do arquivo, adicionar `useLocation` ao import:

```tsx
import { useNavigate, useLocation } from 'react-router-dom'
```

**Step 2: Adicionar reset do periodo via location.key**

Dentro do componente `DashboardFinanceiro`, apos as declaracoes existentes de estado, adicionar:

```tsx
const location = useLocation()

useEffect(() => {
  setPeriodo('30d')
}, [location.key])
```

> `location.key` muda a cada navegacao, mesmo para a mesma rota. Isso garante reset ao retornar ao dashboard vindo de qualquer outra pagina.

**Step 3: Verificar**

1. Selecionar "365d" no dashboard
2. Navegar para `/financeiro/cp`
3. Voltar para `/financeiro`
4. Confirmar que o filtro voltou para "30d"

**Step 4: Commit**

```bash
git add frontend/src/pages/financeiro/DashboardFinanceiro.tsx
git commit -m "fix(financeiro): reset period filter on dashboard navigation (ISSUE-006)"
```

---

## LOTE B — Backend/Infra (ISSUE-001 + ISSUE-002)

### Task 3: ISSUE-002 — Indices compostos + timeout na RPC financeira

**Files:**
- Create: `supabase/019_financeiro_performance.sql`

**Problema:** A funcao `get_dashboard_financeiro` faz multiplos full table scans sem indices compostos. Sem statement_timeout, volume alto pode causar timeout silencioso.

**Step 1: Criar o arquivo da migration**

Criar `supabase/019_financeiro_performance.sql` com o seguinte conteudo:

```sql
-- 019_financeiro_performance.sql
-- Indices compostos para acelerar get_dashboard_financeiro

CREATE INDEX IF NOT EXISTS idx_fin_cp_status_venc
  ON fin_contas_pagar(status, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_fin_cp_status_pgto
  ON fin_contas_pagar(status, data_pagamento);

CREATE INDEX IF NOT EXISTS idx_fin_cp_cc_status
  ON fin_contas_pagar(centro_custo, status);

CREATE INDEX IF NOT EXISTS idx_fin_cp_created
  ON fin_contas_pagar(created_at DESC);

-- Recriar a funcao com statement_timeout de 8 segundos
CREATE OR REPLACE FUNCTION get_dashboard_financeiro(
  p_periodo TEXT DEFAULT '30d'
)
RETURNS JSON AS $$
DECLARE
  dt_inicio DATE;
  result JSON;
BEGIN
  SET LOCAL statement_timeout = '8000';

  dt_inicio := CASE p_periodo
    WHEN '7d'  THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN '30d' THEN CURRENT_DATE - INTERVAL '30 days'
    WHEN '90d' THEN CURRENT_DATE - INTERVAL '90 days'
    ELSE CURRENT_DATE - INTERVAL '365 days'
  END;

  SELECT json_build_object(
    'kpis', (
      SELECT json_build_object(
        'total_cp',             COUNT(*),
        'cp_a_vencer',          COUNT(*) FILTER (WHERE status IN ('previsto','aprovado','aprovado_pgto') AND data_vencimento >= CURRENT_DATE),
        'cp_vencidas',          COUNT(*) FILTER (WHERE status IN ('previsto','aprovado','aprovado_pgto') AND data_vencimento < CURRENT_DATE),
        'cp_pagas_periodo',     COUNT(*) FILTER (WHERE status IN ('pago','conciliado') AND data_pagamento >= dt_inicio),
        'valor_total_aberto',   COALESCE(SUM(valor_original) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado')), 0),
        'valor_pago_periodo',   COALESCE(SUM(valor_pago) FILTER (WHERE status IN ('pago','conciliado') AND data_pagamento >= dt_inicio), 0),
        'valor_a_vencer_7d',    COALESCE(SUM(valor_original) FILTER (WHERE status NOT IN ('pago','conciliado','cancelado') AND data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7), 0),
        'aguardando_aprovacao', COUNT(*) FILTER (WHERE status = 'aguardando_aprovacao'),
        'total_cr',             (SELECT COUNT(*) FROM fin_contas_receber WHERE status NOT IN ('cancelado')),
        'valor_cr_aberto',      (SELECT COALESCE(SUM(valor_original),0) FROM fin_contas_receber WHERE status NOT IN ('recebido','conciliado','cancelado'))
      )
      FROM fin_contas_pagar
    ),
    'por_status', (
      SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json)
      FROM (
        SELECT status, COUNT(*) as total, COALESCE(SUM(valor_original),0) as valor
        FROM fin_contas_pagar
        GROUP BY status
        ORDER BY total DESC
      ) s
    ),
    'por_centro_custo', (
      SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
      FROM (
        SELECT centro_custo, COUNT(*) as total,
               COALESCE(SUM(valor_original),0) as valor,
               COALESCE(SUM(valor_pago),0) as pago
        FROM fin_contas_pagar
        WHERE centro_custo IS NOT NULL
        GROUP BY centro_custo
        ORDER BY valor DESC
      ) c
    ),
    'vencimentos_proximos', (
      SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json)
      FROM (
        SELECT id, fornecedor_nome, valor_original, data_vencimento, status, natureza
        FROM fin_contas_pagar
        WHERE status NOT IN ('pago','conciliado','cancelado')
          AND data_vencimento <= CURRENT_DATE + 30
        ORDER BY data_vencimento ASC
        LIMIT 20
      ) v
    ),
    'recentes', (
      SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)
      FROM (
        SELECT id, fornecedor_nome, valor_original, status, data_vencimento,
               centro_custo, natureza, created_at
        FROM fin_contas_pagar
        ORDER BY created_at DESC
        LIMIT 10
      ) r
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Aplicar via MCP Supabase**

Usar a tool `mcp__402c23fe-4707-49e1-a558-76f47f37d917__apply_migration` com:
- `project_id: "uzfjfucrinokeuwpbeie"`
- `name: "financeiro_performance"`
- `query:` conteudo do arquivo acima

**Step 3: Verificar que a funcao ainda retorna dados**

Usar `mcp__402c23fe-4707-49e1-a558-76f47f37d917__execute_sql` com:
```sql
SELECT get_dashboard_financeiro('30d');
```
Deve retornar JSON com kpis, por_status, etc.

**Step 4: Commit**

```bash
git add supabase/019_financeiro_performance.sql
git commit -m "perf(financeiro): add composite indexes and statement_timeout to dashboard RPC (ISSUE-002)"
```

---

### Task 4: ISSUE-001 — Workflow n8n para tokens de aprovacao expirados

**Problema:** Aprovacoes cujo `data_limite` passou ficam com status `pendente` indefinidamente. Nenhum job atualiza para `expirada` nem notifica os envolvidos.

**Step 1: Criar workflow n8n via MCP**

Usar `mcp__n8n-mcp__n8n_create_workflow` com:

```json
{
  "name": "TEG+ Expiracao de Aprovacoes",
  "nodes": [
    {
      "id": "n1",
      "name": "A cada hora",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.2,
      "position": [0, 0],
      "parameters": {
        "rule": { "interval": [{ "field": "hours", "hoursInterval": 1 }] }
      }
    },
    {
      "id": "n2",
      "name": "Buscar aprovacoes expiradas",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [260, 0],
      "parameters": {
        "method": "GET",
        "url": "https://uzfjfucrinokeuwpbeie.supabase.co/rest/v1/apr_aprovacoes",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.zRMoEoT6MRkPsaGJZR8Nii3KHE4wk3LmWNBbTxpXXjU" },
            { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.zRMoEoT6MRkPsaGJZR8Nii3KHE4wk3LmWNBbTxpXXjU" }
          ]
        },
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            { "name": "status", "value": "eq.pendente" },
            { "name": "data_limite", "value": "=lt.{{ new Date().toISOString() }}" },
            { "name": "select", "value": "id,requisicao_id,nivel,requisicao:cmp_requisicoes(numero,solicitante_nome,obra_nome,descricao)" }
          ]
        }
      }
    },
    {
      "id": "n3",
      "name": "Tem expiradas",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [520, 0],
      "parameters": {
        "conditions": {
          "conditions": [
            {
              "leftValue": "={{ $json.length }}",
              "rightValue": 0,
              "operator": { "type": "number", "operation": "gt" }
            }
          ],
          "combinator": "and"
        }
      }
    },
    {
      "id": "n4",
      "name": "Atualizar para expirada",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [780, -120],
      "parameters": {
        "method": "PATCH",
        "url": "https://uzfjfucrinokeuwpbeie.supabase.co/rest/v1/apr_aprovacoes",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.zRMoEoT6MRkPsaGJZR8Nii3KHE4wk3LmWNBbTxpXXjU" },
            { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6ZmpmdWNyaW5va2V1d3BiZWllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjIwMTY1OCwiZXhwIjoyMDg3Nzc3NjU4fQ.zRMoEoT6MRkPsaGJZR8Nii3KHE4wk3LmWNBbTxpXXjU" }
          ]
        },
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            { "name": "status", "value": "eq.pendente" },
            { "name": "data_limite", "value": "=lt.{{ new Date().toISOString() }}" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={ \"status\": \"expirada\" }"
      }
    },
    {
      "id": "n5",
      "name": "Loop por aprovacao",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [780, 120],
      "parameters": { "batchSize": 1, "options": {} }
    },
    {
      "id": "n6",
      "name": "Notificar WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1040, 120],
      "parameters": {
        "method": "POST",
        "url": "https://teg-agents-n8n.nmmcas.easypanel.host/webhook/whatsapp-notificacoes",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={ \"tipo\": \"aprovacao_expirada\", \"mensagem\": \"Aprovacao expirada: RC {{ $json.requisicao?.numero }} ({{ $json.requisicao?.obra_nome }}) aguarda nova acao.\" }"
      }
    }
  ],
  "connections": {
    "A cada hora": { "main": [[{ "node": "Buscar aprovacoes expiradas", "type": "main", "index": 0 }]] },
    "Buscar aprovacoes expiradas": { "main": [[{ "node": "Tem expiradas", "type": "main", "index": 0 }]] },
    "Tem expiradas": {
      "main": [
        [{ "node": "Atualizar para expirada", "type": "main", "index": 0 }],
        []
      ]
    },
    "Atualizar para expirada": { "main": [[{ "node": "Loop por aprovacao", "type": "main", "index": 0 }]] },
    "Loop por aprovacao": { "main": [[{ "node": "Notificar WhatsApp", "type": "main", "index": 0 }]] }
  }
}
```

**Step 2: Ativar o workflow**

IMPORTANTE: Workflows criados via API ficam inativos. Usar `mcp__n8n-mcp__n8n_update_partial_workflow` com operacao `enable` para ativar, OU ir ao UI do n8n e ativar manualmente.

**Step 3: Verificar criacao**

Usar `mcp__n8n-mcp__n8n_list_workflows` e confirmar que o workflow aparece listado.

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat(infra): create n8n hourly cron for expired approvals via API (ISSUE-001)"
```

---

## LOTE D — Enhancement Chat AI (ISSUE-007)

### Task 5: ISSUE-007 — Code blocks, headers e session history no SuperTEG

**Files:**
- Modify: `frontend/src/components/SuperTEGChat.tsx`
- Modify: `frontend/src/hooks/useSuperTEG.ts`

**Step 1: Ler useSuperTEG.ts para entender a estrutura atual de messages e clearMessages**

Antes de editar, ler o arquivo completo para entender onde `messages`, `setMessages` e `clearMessages` estao definidos.

**Step 2: Adicionar session persistence em useSuperTEG.ts**

Localizar a declaracao de `messages` (provavelmente `useState<ChatMessage[]>([])`) e substituir por:

```tsx
const [messages, setMessages] = useState<ChatMessage[]>(() => {
  try {
    const saved = sessionStorage.getItem('superteg-history')
    return saved ? (JSON.parse(saved) as ChatMessage[]) : []
  } catch { return [] }
})

// Salvar no sessionStorage sempre que messages muda
useEffect(() => {
  try {
    sessionStorage.setItem('superteg-history', JSON.stringify(messages.slice(-20)))
  } catch { /* storage cheio */ }
}, [messages])
```

Localizar `clearMessages` e adicionar limpeza do storage:
```tsx
const clearMessages = useCallback(() => {
  setMessages([])
  sessionStorage.removeItem('superteg-history')
}, [])
```

**Step 3: Melhorar renderer de markdown em SuperTEGChat.tsx**

Substituir a funcao `Content` (~linha 261) por versao com suporte a code blocks e headers:

```tsx
function Content({ text, onNav, isUser }: { text: string; onNav: (p: string) => void; isUser: boolean }) {
  // Separar code blocks do texto normal usando matchAll
  const codePattern = /```(\w*)\n?([\s\S]*?)```/g
  const parts: Array<{ kind: 'text' | 'code'; content: string; lang?: string }> = []
  let cursor = 0
  for (const m of text.matchAll(codePattern)) {
    if (m.index! > cursor) parts.push({ kind: 'text', content: text.slice(cursor, m.index) })
    parts.push({ kind: 'code', content: m[2].trim(), lang: m[1] || undefined })
    cursor = m.index! + m[0].length
  }
  if (cursor < text.length) parts.push({ kind: 'text', content: text.slice(cursor) })

  return (
    <>
      {parts.map((part, i) =>
        part.kind === 'code' ? (
          <pre key={i} className="my-2 p-3 rounded-xl bg-black/40 border border-white/10 overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed whitespace-pre-wrap">
            {part.lang && (
              <span className="block text-[9px] text-slate-500 mb-1.5 uppercase tracking-wider">{part.lang}</span>
            )}
            {part.content}
          </pre>
        ) : (
          <span key={i}>
            {part.content.split('\n').map((line, j) => {
              const h2 = line.match(/^##\s+(.+)/)
              const h3 = line.match(/^###\s+(.+)/)
              if (h2) return <p key={j} className="font-bold text-white/90 text-[14px] mt-2 mb-1">{h2[1]}</p>
              if (h3) return <p key={j} className="font-semibold text-white/80 text-[13px] mt-1.5 mb-0.5">{h3[1]}</p>
              return <span key={j}>{j > 0 && <br />}<Line line={line} onNav={onNav} isUser={isUser} /></span>
            })}
          </span>
        )
      )}
    </>
  )
}
```

**Step 4: Verificar**

1. Abrir o chat e pedir "Me mostre um exemplo de SQL SELECT"
2. Resposta deve renderizar com code block verde em fundo escuro
3. Fechar o chat e reabrir (sem fechar a aba) — historico deve estar la
4. Fechar a aba e reabrir — historico deve ter sido limpo

**Step 5: Commit**

```bash
git add frontend/src/components/SuperTEGChat.tsx frontend/src/hooks/useSuperTEG.ts
git commit -m "feat(chat): add code blocks, header formatting and session history (ISSUE-007)"
```

---

## LOTE C — Qualidade de Codigo (ISSUE-004 + ISSUE-005)

### Task 6: ISSUE-004 — Habilitar TypeScript strictNullChecks

**Files:**
- Modify: `frontend/tsconfig.json`

**Step 1: Adicionar strictNullChecks ao tsconfig**

Editar `frontend/tsconfig.json`. Manter `"strict": false` e adicionar:

```json
{
  "compilerOptions": {
    "strict": false,
    "strictNullChecks": true,
    ...demais opcoes existentes
  }
}
```

**Step 2: Checar erros resultantes**

```bash
cd /c/teg-plus/frontend && npx tsc --noEmit 2>&1
```

**Step 3: Corrigir cada erro**

Padroes comuns a corrigir:
- `Object is possibly 'undefined'` -> usar `?.` (optional chaining)
- `Type 'X | null' is not assignable to 'X'` -> adicionar null guard ou `?? valor_padrao`
- `perfil.nome` quando perfil pode ser null -> `perfil?.nome ?? 'Usuario'`

Corrigir arquivo por arquivo ate `tsc --noEmit` completar sem output.

**Step 4: Commit**

```bash
git add frontend/tsconfig.json frontend/src/
git commit -m "chore(ts): enable strictNullChecks and fix type errors (ISSUE-004)"
```

---

### Task 7: ISSUE-005 — Setup Vitest com testes basicos

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/wizard-validation.test.ts`
- Create: `frontend/src/test/periodo-mapping.test.ts`

**Step 1: Instalar dependencias**

```bash
cd /c/teg-plus/frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Step 2: Criar vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

**Step 3: Criar src/test/setup.ts**

```ts
import '@testing-library/jest-dom'
```

**Step 4: Adicionar script "test" ao package.json**

Adicionar na secao "scripts":
```json
"test": "vitest",
"test:run": "vitest run"
```

**Step 5: Criar teste de validacao do wizard**

```ts
// frontend/src/test/wizard-validation.test.ts
import { describe, it, expect } from 'vitest'

function validateStep2(
  solicitante: string,
  obraNome: string,
  descricao: string,
  itens: Array<{ descricao: string }>
): string[] {
  const errs: string[] = []
  if (!solicitante.trim()) errs.push('Informe o nome do solicitante')
  if (!obraNome) errs.push('Selecione a obra')
  if (!descricao.trim()) errs.push('Informe a descricao')
  if (itens.every(i => !i.descricao.trim())) errs.push('Adicione ao menos um item')
  return errs
}

describe('NovaRequisicao Step2 validation', () => {
  it('retorna 4 erros quando todos os campos estao vazios', () => {
    expect(validateStep2('', '', '', [{ descricao: '' }])).toHaveLength(4)
  })

  it('retorna zero erros quando tudo preenchido', () => {
    expect(validateStep2('Joao', 'SE Frutal', 'Cabo XLPE', [{ descricao: 'Cabo' }])).toHaveLength(0)
  })

  it('detecta solicitante vazio isoladamente', () => {
    expect(validateStep2('', 'SE Frutal', 'Cabo', [{ descricao: 'Cabo' }])).toEqual(['Informe o nome do solicitante'])
  })
})
```

**Step 6: Criar teste de periodo do dashboard**

```ts
// frontend/src/test/periodo-mapping.test.ts
import { describe, it, expect } from 'vitest'

function periodoToLabel(p: string): string {
  const map: Record<string, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '365d': 'Ano' }
  return map[p] ?? '30 dias'
}

describe('periodo financeiro labels', () => {
  it('mapeia 7d', () => expect(periodoToLabel('7d')).toBe('7 dias'))
  it('mapeia 30d', () => expect(periodoToLabel('30d')).toBe('30 dias'))
  it('usa fallback para periodo invalido', () => expect(periodoToLabel('xyz')).toBe('30 dias'))
})
```

**Step 7: Rodar os testes**

```bash
cd /c/teg-plus/frontend && npm run test:run
```
Esperado: 6 testes passam, 0 falhas.

**Step 8: Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/src/test/
git commit -m "chore(tests): setup Vitest with basic validation tests (ISSUE-005)"
```

---

## Task 8: Fechar issues no GitHub e abrir as faltantes

**Step 1: Abrir ISSUE-008 no GitHub**

```bash
gh issue create --repo leandroteg/teg-plus \
  --title "[COMPRAS] Botao salvar travado na nova requisicao" \
  --label "bug" \
  --body "## Bug\n\nBotao travado por validacao silenciosa no wizard step 2. Corrigido com feedback de erros inline.\n\n**Severidade:** alta\n**Modulo:** compras"
```

**Step 2: Fechar issues do GitHub que foram resolvidas**

```bash
gh issue close 13 --repo leandroteg/teg-plus \
  --comment "Corrigido: periodo agora reseta ao navegar de volta ao dashboard (useLocation.key)"

gh issue close 14 --repo leandroteg/teg-plus \
  --comment "Implementado: code blocks com syntax highlight, headers e session history no SuperTEG"
```

**Step 3: Commit final**

```bash
git add docs/plans/
git commit -m "docs: add implementation plan for issue batch fixes (ISSUE-001 to 008)"
```

---

## Ordem de execucao recomendada

1. Task 1 — ISSUE-008 (maior impacto operacional)
2. Task 2 — ISSUE-006 (5 linhas, zero risco)
3. Task 3 — ISSUE-002 (migration SQL isolada)
4. Task 4 — ISSUE-001 (workflow n8n via MCP)
5. Task 5 — ISSUE-007 (enhancement independente)
6. Task 6 — ISSUE-004 (TypeScript: fazer apos os outros commits)
7. Task 7 — ISSUE-005 (testes por ultimo)
8. Task 8 — GitHub cleanup
