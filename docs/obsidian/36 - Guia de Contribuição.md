---
title: Guia de Contribuição
type: dev-guide
status: ativo
tags: [contributing, git, pr, code-review, convencoes]
criado: 2026-04-08
relacionado: ["[[00 - TEG+ INDEX]]", "[[15 - Deploy e GitHub]]", "[[35 - Onboarding DEV]]", "[[42 - Estratégia de Testes]]"]
---

# 📐 Guia de Contribuição — TEG+ ERP

---

## Branch Naming

```
<tipo>/<issue>-<descricao-curta>
```

| Tipo | Quando usar | Exemplo |
|------|-------------|---------|
| `feat/` | Nova funcionalidade | `feat/issue-210-filtro-contratos` |
| `fix/` | Correção de bug | `fix/issue-198-timezone-dates` |
| `refactor/` | Refatoração sem mudança de comportamento | `refactor/hooks-logistica` |
| `docs/` | Apenas documentação | `docs/adr-supabase` |
| `chore/` | Config, deps, CI | `chore/update-tanstack` |

---

## Commits

### Formato (Conventional Commits)

```
<tipo>(<escopo>): <mensagem curta>

<corpo opcional — explique o "porquê">
```

### Exemplos

```
fix(contratos): corrigir timezone em datas date-only

Datas "YYYY-MM-DD" eram parseadas como UTC, causando -1 dia em BRT.
Solução: sufixo T12:00:00 em todas as formatações.

Closes #198
```

```
feat(logistica): adicionar agrupamento por viagem no transporte
```

### Tipos válidos

| Tipo | Descrição |
|------|-----------|
| `feat` | Nova feature |
| `fix` | Bug fix |
| `refactor` | Refatoração |
| `docs` | Documentação |
| `style` | Formatação (sem lógica) |
| `test` | Testes |
| `chore` | Manutenção, deps |
| `perf` | Performance |

---

## Pull Requests

### Tamanho ideal

- **< 400 linhas** alteradas
- Se maior, divida em PRs menores
- 1 PR = 1 responsabilidade

### Template de PR

```markdown
## Resumo
<!-- 1-3 bullets do que muda -->

## Motivação
<!-- Por que essa mudança é necessária? Link da issue -->

## Como testar
- [ ] Passo 1
- [ ] Passo 2
- [ ] Verificar que X funciona

## Screenshots (se UI)
<!-- Antes/depois -->

## Checklist
- [ ] Funciona no mobile (PWA)
- [ ] Sem erros no console
- [ ] Docs atualizadas (se aplicável)
- [ ] Sem credenciais hardcoded
```

### Code Review Checklist

O reviewer deve verificar:

- [ ] Código segue os padrões do projeto
- [ ] Sem `any` desnecessário no TypeScript
- [ ] Hooks usam padrão existente (`useXxx`)
- [ ] Queries Supabase usam `.throwOnError()` onde necessário
- [ ] Sem `console.log` esquecido
- [ ] Datas usam `T12:00:00` para date-only strings (ver [[ADR-001 - Timezone BRT]])
- [ ] RLS policies consideradas para novas tabelas
- [ ] Componentes seguem padrão de [[04 - Componentes]]

---

## Padrões de Código

### TypeScript

```typescript
// ✅ Correto — tipos explícitos em props
interface CardProps {
  titulo: string
  valor: number
  onClick?: () => void
}

// ❌ Evitar — any
const data: any = await supabase.from('tabela').select('*')

// ✅ Correto — tipo inferido do schema
const { data } = await supabase
  .from('cmp_requisicoes')
  .select('id, numero, status')
  .throwOnError()
```

### Hooks customizados

```typescript
// Padrão: useNomeDaAcao()
// Retorna: { data, isLoading, error } ou mutation
export function useListarContratos(filtros: FiltroContrato) {
  return useQuery({
    queryKey: ['contratos', filtros],
    queryFn: () => buscarContratos(filtros),
  })
}
```

### Formatação de datas

```typescript
// ⚠️ SEMPRE usar T12:00:00 para date-only
const safeDate = (d: string) =>
  new Date(d.length === 10 ? d + 'T12:00:00' : d)

// Formatação padrão BR
const fmtData = (d: string) =>
  safeDate(d).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
```

---

## Estrutura de Arquivos

Ao criar novos módulos, seguir a estrutura existente:

```
src/pages/<modulo>/
├── <Modulo>Index.tsx        → Página principal / lista
├── <Modulo>Detalhe.tsx      → Detalhe de um item
├── Novo<Modulo>.tsx         → Formulário de criação
└── components/              → Componentes específicos do módulo

src/hooks/
├── use<Modulo>.ts           → Queries e mutations do módulo

src/types/
├── <modulo>.ts              → Tipos TypeScript do módulo
```

---

## O que NÃO fazer

- ❌ Push direto na `main`
- ❌ Commitar `.env`, credenciais, tokens
- ❌ PRs com 1000+ linhas
- ❌ `// @ts-ignore` sem justificativa em comentário
- ❌ Queries Supabase sem filtro de obra quando aplicável
- ❌ `useEffect` para coisas que `useQuery` já resolve

---

## Links

- [[35 - Onboarding DEV]]
- [[15 - Deploy e GitHub]]
- [[04 - Componentes]]
- [[05 - Hooks Customizados]]
- [[40 - ADRs Index]]
- [[42 - Estratégia de Testes]]
