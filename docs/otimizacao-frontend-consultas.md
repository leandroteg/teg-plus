# Otimização do fluxo de consultas do Frontend — auditoria e backlog

Data: 2026-07-09. Auditoria de 4 dimensões (fetches fora do React Query, invalidações,
polling/realtime, queries pesadas) sobre `frontend/src`.

## O que já estava bom (não mexer)

- `QueryClient` global com `staleTime: 30s`, `refetchOnWindowFocus: false` e
  `refetchIntervalInBackground: false` — polling só roda na aba ativa e visível.
- Todas as rotas de página com `lazy()` (code-splitting por rota).
- `NotificationBell` usa realtime (`sys_notif_queue`), zero polling. Nenhum componente
  global faz polling de dados por intervalo.
- Não há realtime + polling redundante para o mesmo dado.
- ~840 usos de `useQuery`; escrita raw via supabase em componentes é quase toda mutation
  (correto). `usePMO` é o modelo de invalidação correta (sempre inclui id na queryKey).

## Implementado em 2026-07-09 (frontend-only)

| Arquivo | Mudança |
|---|---|
| `hooks/usePreCadastros.ts` | Dedup N+1 (1 request por pendente, em toda página via NotificationBell) → 3 queries em lote com `.in()`; poll 60s → 120s |
| `hooks/useAprovacoes.ts` | `useDecisaoGenerica`: 18 invalidações por prefixo → invalidação escopada por `tipoAprovacao` (switch); KPIs (≈9 queries/ciclo) 60s → 180s |
| `hooks/useRequisicoes.ts` | Lista principal: `staleTime: 0` + `refetchOnMount: true` (refetch a cada remontagem) → `staleTime: 30s` |
| `hooks/useEstoque.ts` | `useBases` (monta em toda página) `staleTime: 5min`; `useMovimentacoes` com `placeholderData: keepPreviousData` |
| `pages/estoque/Movimentacoes.tsx` | Busca com debounce 350ms (`useDebouncedValue`) — antes 1 request por tecla |
| `hooks/useDebouncedValue.ts` | Novo hook reutilizável de debounce para buscas ligadas a queryKey |
| `pages/cadastros/CadastrosHome.tsx` | Count de projetos: `.select('id')` (todas as linhas) → `count: 'exact', head: true` |
| `hooks/useContratos.ts` | Dashboard RPC: poll 60s → 5min |
| `hooks/useObras.ts` | KPIs home: poll 60s → 3min |
| `hooks/useFrotas.ts` | `useTelSyncLog`: poll 60s → 5min (os syncs rodam a cada 5/15min) |
| `hooks/useCautelas.ts` | KPIs: poll 60s → 3min |
| `hooks/useAnexos.ts` | Anexos de pedido: poll 60s → 120s (uploads locais já invalidam) |
| `hooks/useRHAdmissaoFluxo.ts` | Parecer: poll para quando o dado chega; etapa-candidato 60s → 120s (docs seguem em 60s) |

## Backlog — maiores ganhos restantes (exigem RPC/mudança no servidor)

Prioridade por impacto:

1. **`useAprovacoesPendentes` (useAprovacoes.ts:125)** — ~10+ queries sequenciais no
   queryFn, repetidas a cada 60s na tela de Aprovações. Consolidar em RPC
   `get_aprovacoes_pendentes(user)`; no mínimo paralelizar blocos com `Promise.all`.
2. **`useContasPagar` (useFinanceiro.ts:81)** — loop até 50k linhas com join pesado,
   filtro/paginação 100% client-side, consumido em ~10 telas. Migrar para paginação e
   filtro server-side com `count`.
3. **`useEstoqueItens` / `useSaldos` (useEstoque.ts:108/229)** — catálogo/saldos inteiros
   (até 50k) no cliente; `useSaldos` ainda com poll 60s. Busca por termo server-side
   (já existe `useItemCatalogSearch`) e RPC para saldos/alerta de mínimo.
4. **KPIs por RPC única**: `useAprovacaoKPIs` (~9 queries), `useEstoqueKPIs` (5),
   `useFrotasKPIs` (6), `useAcompanhamentoCD` (6+).
5. **Lookups duplicados** — `sys_obras` (~12 implementações), `rh_colaboradores` (~9),
   `est_bases` (~8): consolidar em hooks canônicos (`useLookups`, `useColaboradoresAtivos`,
   `useBases`) com keys únicas e `staleTime` alto.
6. **`CPPipeline.tsx:99`** — cascata de 8+ fetches raw por CP aberto → RPC
   `fn_cp_timeline(cp_id)`; `FornecedorBankInfo` com fallback de até 6 ilike sequenciais
   por nome → resolver fornecedores em lote na listagem.
7. **Invalidações por prefixo nos módulos financeiro/frotas** — `contas-pagar` invalidado
   em ~14 mutations, `fro_veiculos` em ~15: adotar `setQueryData` cirúrgico no item
   alterado (padrão já usado em `usePreCadastros`) e ids nas keys de detalhe.
8. **Realtime para filas colaborativas** (aprovações, estoque) espelhando
   `useNotificacoes` — elimina o polling de 60s dessas telas com latência melhor.
9. **`placeholderData: keepPreviousData`** nas demais queries com filtros server-side
   (adotado em `useMovimentacoes`; era 0 ocorrências no projeto).
10. **`RHColaboradores.tsx:53`** — usa `useRHColaboradores()` sem filtros e filtra tudo
    no cliente; o hook já aceita `filtros`, basta passá-los.
