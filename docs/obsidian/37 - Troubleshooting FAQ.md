---
title: Troubleshooting FAQ
type: dev-guide
status: ativo
tags: [troubleshooting, faq, erros, debug, solucoes]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[35 - Onboarding DEV]]", "[[06 - Supabase]]", "[[09 - Auth Sistema]]", "[[15 - Deploy e GitHub]]"]
---

# 🔧 Troubleshooting & FAQ — TEG+ ERP

---

## Git

### `fatal: Unable to create '.git/index.lock': File exists`

**Causa**: Processo git travou e deixou lock file.

```bash
rm -f .git/index.lock
```

### `error: failed to push some refs`

**Causa**: Branch remota está à frente.

```bash
git pull --rebase origin main
# resolver conflitos se houver
git push
```

---

## Datas e Timezone

### Data aparece 1 dia antes (ex: 08/04 vira 07/04)

**Causa**: `new Date("2026-04-08")` interpreta como UTC midnight. Em BRT (UTC-3), mostra dia anterior.

**Solução**: Sempre usar `T12:00:00` para date-only strings:

```typescript
// ❌ Bug
new Date("2026-04-08")  // → 07/04 em BRT

// ✅ Correto
new Date("2026-04-08T12:00:00")  // → 08/04 em qualquer timezone BR
```

Ver [[ADR-001 - Timezone BRT]] para contexto completo.

---

## Supabase

### `JWT expired` / Token expirado

**Causa**: Sessão expirou (padrão: 1h).

**Solução**: O sistema já faz refresh automático via `onAuthStateChange`. Se persistir:
1. Limpar localStorage do browser
2. Fazer login novamente
3. Verificar se `supabase.auth.getSession()` retorna sessão válida

### `new row violates row-level security policy`

**Causa**: RLS policy bloqueando a operação.

**Checklist**:
1. Usuário está autenticado? (`auth.uid()` retorna valor?)
2. Usuário tem a role necessária? (ver `sys_usuarios.perfil_tipo`)
3. Policy existe para a operação? (`SELECT/INSERT/UPDATE/DELETE`)
4. Filtro de obra está correto? (muitas policies filtram por `obra_id`)

```sql
-- Verificar policies de uma tabela
SELECT * FROM pg_policies WHERE tablename = 'sua_tabela';
```

### `relation "xxx" does not exist`

**Causa**: Migration não foi aplicada.

```bash
# Verificar migrations pendentes
supabase db diff

# Aplicar migration específica
supabase db push
```

Ou aplicar diretamente via SQL Editor no dashboard Supabase.

---

## n8n Workflows

### Webhook retorna 404

**Checklist**:
1. Workflow está **ativo** no n8n?
2. URL do webhook está correta em `.env`?
3. Método HTTP correto? (POST vs GET)
4. n8n está rodando? Verificar EasyPanel

### Workflow executou mas dados não aparecem

1. Verificar execução no n8n (aba Executions)
2. Checar se houve erro em algum nó
3. Verificar se o Supabase service_role key está configurado no n8n
4. Conferir se a tabela destino existe e tem as colunas esperadas

---

## Frontend / React

### Tela branca após deploy

1. Abrir DevTools (F12) → Console
2. Geralmente é erro de import ou variável de ambiente faltando
3. Verificar se `.env` de produção tem todas as variáveis

### `useQuery` não atualiza após mutation

**Causa**: Cache do TanStack Query não invalidado.

```typescript
// Após mutation, invalidar a query:
const queryClient = useQueryClient()

const mutation = useMutation({
  mutationFn: criarItem,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items'] })
  }
})
```

### Componente renderiza infinitamente

**Causa comum**: Objeto/array criado no render passado como dependência de `useEffect`.

```typescript
// ❌ Bug — filtros é recriado a cada render
const filtros = { obra: obraId, status: 'ativo' }
useEffect(() => { buscar(filtros) }, [filtros]) // loop infinito

// ✅ Correto — useMemo
const filtros = useMemo(() => ({ obra: obraId, status: 'ativo' }), [obraId])
```

---

## PWA / Mobile

### AprovAi não mostra botão Voltar

**Histórico**: Já corrigido (issue #200). O botão agora aparece sempre, com comportamento adaptativo:
- Browser normal: `navigate(-1)` (volta na história)
- PWA standalone: `navigate('/')` (volta ao início)

### Push notifications não chegam

1. Usuário permitiu notificações no browser?
2. Service worker está registrado?
3. Token de push está salvo no banco?

---

## Erros comuns por módulo

### Compras — "Contrato obrigatório" aparece quando não deveria

**Regra**: `deveContrato` só é `true` quando:
- Tipo = recorrente, OU
- Tipo = serviço E valor > R$ 2.000

Verificar se `cat_tipo` e `valor_estimado` estão corretos na requisição.

### Contratos — Resumo Executivo vazio na aprovação

**Checklist**:
1. `con_resumos_executivos` tem registro para o contrato?
2. n8n workflow de análise AI executou?
3. Campos `objeto_resumo`, `riscos`, `oportunidades` preenchidos?

### Financeiro — Omie sync falhou

1. Verificar credenciais Omie no n8n
2. API Omie tem rate limit (3 req/s) — verificar se não bateu
3. Conferir mapeamento de campos entre TEG+ e Omie

---

## Performance

### Dashboard demora > 5s para carregar

1. Verificar se queries usam índices (ver `EXPLAIN ANALYZE`)
2. Filtro de data/obra está sendo enviado?
3. TanStack Query está cacheando? (`staleTime` configurado?)

### Tabela com muitos registros trava

- Implementar paginação server-side (`.range()` no Supabase)
- Não trazer `SELECT *` — selecionar apenas colunas necessárias

---

## Links

- [[35 - Onboarding DEV]]
- [[06 - Supabase]]
- [[09 - Auth Sistema]]
- [[10 - n8n Workflows]]
- [[15 - Deploy e GitHub]]
- [[43 - Runbook de Incidentes]]
