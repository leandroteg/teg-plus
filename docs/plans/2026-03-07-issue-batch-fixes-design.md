# Design: Correção em Lote das Issues TEG+

**Data:** 2026-03-07
**Scope:** ISSUE-001 a ISSUE-008 (todos abertos)
**Aprovado por:** Leandro

---

## Agrupamento por Lote

### Lote A — Bugs Frontend (ISSUE-008, ISSUE-006)
**Arquivos:** `NovaRequisicao.tsx`, `DashboardFinanceiro.tsx`

**ISSUE-008 — Botão salvar travado:**
- Root cause: step 2 → 3 tem validação silenciosa (retorna sem feedback)
- Root cause 2: `mutation.isPending` sem timeout pode travar indefinidamente
- Fix: adicionar estado `validationError`, exibir mensagem inline; adicionar timeout de 20s na mutation

**ISSUE-006 — Filtro período não reseta:**
- Root cause: `periodo` é `useState` local que persiste entre navegações
- Fix: ler obra do localStorage/contexto, resetar `periodo` via `useEffect([obraKey])`; fallback: usar `key` baseado na rota

---

### Lote B — n8n + SQL (ISSUE-001, ISSUE-002)
**ISSUE-001 — Tokens expiram sem notificação:**
- Criar workflow n8n com Schedule Trigger (a cada hora)
- Busca aprovações `status=pendente AND data_limite < NOW()`
- Atualiza para `expirada` + notifica via WhatsApp/email

**ISSUE-002 — RPC volume alto:**
- Migration Supabase: índices compostos em `fin_contas_pagar` e `cmp_requisicoes`
- Adicionar `SET LOCAL statement_timeout = '5000'` na função `get_dashboard_financeiro`

---

### Lote C — Qualidade (ISSUE-004, ISSUE-005)
**ISSUE-004 — TypeScript strict:**
- Habilitar `"strictNullChecks": true` no tsconfig
- Corrigir erros resultantes (sem `strict: true` completo ainda)

**ISSUE-005 — Sem testes:**
- Setup Vitest + @testing-library/react
- 3 testes mínimos: `useCriarRequisicao`, `useFinanceiroDashboard`, validação do form

---

### Lote D — Enhancement (ISSUE-007)
**Chat AI — SuperTEGChat.tsx:**
- Code blocks: detectar ` ```...``` ` e renderizar com fundo mono
- Headers: detectar `## ` e `### ` nas respostas
- Session persistence: `localStorage` para histórico de até 20 mensagens

---

## Ordem de Execução
1. **Lote A** (alto impacto, baixo risco) — em paralelo com Lote B
2. **Lote B** (infra, independente) — em paralelo com Lote A
3. **Lote D** (enhancement) — após Lote A
4. **Lote C** (qualidade/config) — por último (risco maior de quebrar coisas)

---

## Não incluído neste ciclo
- ISSUE-003 (fallback n8n): requer ambiente de testes controlado, apenas documentação
- ISSUE-004 `strict: true` completo: pós lote C como fase 2
