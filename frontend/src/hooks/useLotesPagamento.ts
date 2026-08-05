import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { ContaPagar, LotePagamento, LoteItem } from '../types/financeiro'
import { valorAPagarCP } from '../types/financeiro'

const SELECT_CP = `
  *,
  pedido:cmp_pedidos!pedido_id(numero_pedido, status, data_pedido, data_prevista_entrega, status_pagamento),
  requisicao:cmp_requisicoes!requisicao_id(numero, descricao, obra_nome, categoria, centro_custo, classe_financeira, projeto_id)
`

type ConfigKey = 'n8n_webhook_url' | 'cp_remessa_webhook_url' | 'cp_remessa_status_webhook_url'

type RemessaStatusResult = {
  remessaId: string
  status: string
  dataPagamento?: string
  payload?: Record<string, unknown>
  message?: string
}

async function getFinanceiroConfig(keys: ConfigKey[]) {
  const { data, error } = await supabase
    .from('sys_config')
    .select('chave, valor')
    .in('chave', keys)

  if (error) throw error

  const cfg: Partial<Record<ConfigKey, string>> = {}
  for (const row of data ?? []) {
    cfg[row.chave as ConfigKey] = row.valor ?? ''
  }
  return cfg
}

function buildEndpointUrl(primary?: string, fallbackBase?: string, fallbackPath?: string) {
  if (primary) return primary
  if (!fallbackBase || !fallbackPath) return ''
  return `${fallbackBase.replace(/\/$/, '')}${fallbackPath}`
}

function extractRemessaId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null
  const source = payload as Record<string, unknown>
  const value = source.remessaId ?? source.remessa_id ?? source.id ?? source.codigo ?? null
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeRemessaStatusResults(payload: unknown): RemessaStatusResult[] {
  if (!payload || typeof payload !== 'object') return []

  const source = payload as Record<string, unknown>
  const rawList = Array.isArray(source.results)
    ? source.results
    : Array.isArray(source.remessas)
      ? source.remessas
      : Array.isArray(source.data)
        ? source.data
        : []

  const results = rawList
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const remessaId = extractRemessaId(record)
      const status = String(record.status ?? record.situacao ?? record.resultado ?? '').trim().toLowerCase()
      if (!remessaId || !status) return null
      return {
        remessaId,
        status,
        dataPagamento: typeof record.dataPagamento === 'string'
          ? record.dataPagamento
          : typeof record.data_pagamento === 'string'
            ? record.data_pagamento
            : undefined,
        payload: record,
        message: typeof record.message === 'string'
          ? record.message
          : typeof record.erro === 'string'
            ? record.erro
            : typeof record.error === 'string'
              ? record.error
              : undefined,
      } satisfies RemessaStatusResult
    })
    .filter((item): item is RemessaStatusResult => !!item)

  if (results.length > 0) return results

  const remessaId = extractRemessaId(source)
  const status = String(source.status ?? source.situacao ?? source.resultado ?? '').trim().toLowerCase()
  if (!remessaId || !status) return []

  return [{
    remessaId,
    status,
    dataPagamento: typeof source.dataPagamento === 'string'
      ? source.dataPagamento
      : typeof source.data_pagamento === 'string'
        ? source.data_pagamento
        : undefined,
    payload: source,
    message: typeof source.message === 'string'
      ? source.message
      : typeof source.erro === 'string'
        ? source.erro
        : typeof source.error === 'string'
          ? source.error
          : undefined,
  }]
}

// ── Query: Lista de lotes ────────────────────────────────────────────────────

export function useLotesPagamento(statusFilter?: string) {
  return useQuery<LotePagamento[]>({
    queryKey: ['lotes-pagamento', statusFilter],
    queryFn: async () => {
      // PostgREST capa em 1000 — paginar no cliente
      const PAGE = 1000
      const lotes: LotePagamento[] = []
      for (let from = 0; from < 50_000; from += PAGE) {
        let q = supabase
          .from('fin_lotes_pagamento')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1)
        if (statusFilter) q = q.eq('status', statusFilter)
        const { data, error } = await q
        if (error) throw error
        const batch = (data ?? []) as LotePagamento[]
        lotes.push(...batch)
        if (batch.length < PAGE) break
      }
      const loteIds = lotes.map(lote => lote.id)

      if (loteIds.length === 0) return lotes

      const { data: aprovacoes } = await supabase
        .from('apr_aprovacoes')
        .select('entidade_id, aprovador_nome, status, created_at')
        .eq('modulo', 'fin')
        .eq('tipo_aprovacao', 'autorizacao_pagamento')
        .in('entidade_id', loteIds)
        .order('created_at', { ascending: false })

      const aprovacaoPorLote = new Map<string, { aprovador_nome?: string; status?: string }>()
      for (const aprovacao of aprovacoes ?? []) {
        const entidadeId = aprovacao.entidade_id as string | undefined
        if (!entidadeId || aprovacaoPorLote.has(entidadeId)) continue
        aprovacaoPorLote.set(entidadeId, {
          aprovador_nome: aprovacao.aprovador_nome as string | undefined,
          status: aprovacao.status as string | undefined,
        })
      }

      return lotes.map(lote => {
        const aprovacao = aprovacaoPorLote.get(lote.id)
        return {
          ...lote,
          aprovador_nome: aprovacao?.aprovador_nome,
          aprovacao_status: aprovacao?.status,
        }
      })
    },
    retry: false,
  })
}

// ── Query: Lote por ID com itens + CP join ───────────────────────────────────

export function useLoteById(loteId?: string) {
  return useQuery<LotePagamento & { itens: (LoteItem & { cp: ContaPagar })[] }>({
    queryKey: ['lote-detalhe', loteId],
    queryFn: async () => {
      // 1. Fetch lote
      const { data: lote, error: lErr } = await supabase
        .from('fin_lotes_pagamento')
        .select('*')
        .eq('id', loteId!)
        .single()
      if (lErr) throw lErr

      // 2. Fetch itens
      // Ordena pela numeração do lote (mig 228: 1..N, do menor valor para o
      // maior) — é a ordem que o Financeiro leva para o banco. created_at
      // continua como desempate para lote antigo ainda sem ordem.
      const { data: itens, error: iErr } = await supabase
        .from('fin_lote_itens')
        .select('*')
        .eq('lote_id', loteId!)
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
      if (iErr) throw iErr

      // 3. Fetch CPs for each item
      const cpIds = (itens ?? []).map(i => i.cp_id)
      let cps: ContaPagar[] = []
      if (cpIds.length > 0) {
        const { data: cpData } = await supabase
          .from('fin_contas_pagar')
          .select(SELECT_CP)
          .in('id', cpIds)
        cps = (cpData ?? []) as ContaPagar[]
      }

      const cpMap = new Map(cps.map(c => [c.id, c]))
      const enriched = (itens ?? []).map(item => ({
        ...item,
        cp: cpMap.get(item.cp_id) as ContaPagar,
      }))

      return { ...lote, itens: enriched } as LotePagamento & { itens: (LoteItem & { cp: ContaPagar })[] }
    },
    enabled: !!loteId,
    // Só faz poll enquanto o lote está em pagamento (aguardando baixa); para nos estados finais.
    refetchInterval: (query) => query.state.data?.status === 'em_pagamento' ? 10_000 : false,
  })
}

// ── Comentários por título do lote (mig 229) ─────────────────────────────────
// Esclarecimento item a item: o do lote inteiro devolve tudo por causa de uma
// linha só. Chaveado por cp_id (não pelo id do fin_lote_itens) porque a
// aprovação parcial apaga o item e recria noutro lote — o histórico do título
// tem que sobreviver a isso.

export interface LoteItemComentario {
  id: string
  cp_id: string
  lote_id: string | null
  texto: string
  autor_nome: string
  autor_papel: 'aprovador' | 'financeiro'
  created_at: string
}

/** Comentários de vários títulos de uma vez, agrupados por cp_id. */
export function useComentariosItens(cpIds: string[]) {
  const key = [...cpIds].sort().join(',')
  return useQuery<Record<string, LoteItemComentario[]>>({
    queryKey: ['lote-item-comentarios', key],
    enabled: cpIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_lote_item_comentarios')
        .select('*')
        .in('cp_id', cpIds)
        .order('created_at', { ascending: true })
      if (error) throw error
      const porCp: Record<string, LoteItemComentario[]> = {}
      for (const row of (data ?? []) as LoteItemComentario[]) {
        ;(porCp[row.cp_id] ??= []).push(row)
      }
      return porCp
    },
    staleTime: 15_000,
  })
}

export function useComentarItemLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpId, loteId, texto }: { cpId: string; loteId?: string | null; texto: string }) => {
      // RPC SECURITY DEFINER: fin_lote_item_comentarios só aceita escrita por
      // ela. O aprovador não tem o módulo financeiro e um insert direto do
      // cliente seria barrado pela RLS sem avisar ninguém.
      const { data, error } = await supabase.rpc('fin_lote_item_comentar', {
        p_cp_id: cpId,
        p_lote_id: loteId ?? null,
        p_texto: texto,
      })
      if (error) throw new Error(error.message)
      return data as LoteItemComentario
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-item-comentarios'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
    },
  })
}

// ── Mutation: Criar lote ─────────────────────────────────────────────────────

export function useCriarLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cpIds,
      criadoPor,
      observacao,
    }: {
      cpIds: string[]
      cps?: ContaPagar[]
      criadoPor: string
      observacao?: string
    }) => {
      // Busca sempre do banco: o valor a pagar precisa de desconto, juros/multa,
      // imposto retido e adiantamento abatido — não só do valor_original.
      const { data } = await supabase
        .from('fin_contas_pagar')
        .select('id, valor_original, empresa_id, valor_desconto, valor_juros_multa, imposto_valor, imposto_deduzir, valor_adiantamento_abatido')
        .in('id', cpIds)
      const cpList = (data ?? []) as Array<{ id: string; empresa_id: string | null } & Parameters<typeof valorAPagarCP>[0]>

      // Um lote só, mesmo com empresas pagadoras diferentes (pedido do user
      // 04/ago). Antes a seleção mista era quebrada em um lote por empresa, o
      // que multiplicava aprovações para um pagamento só.
      const { data: numData } = await supabase.rpc('generate_numero_lote')
      const numeroLote = (numData as string) || `LP-${Date.now()}`

      // O lote paga o valor LÍQUIDO (original − desconto + juros/multa −
      // imposto retido − adiantamento abatido), o mesmo número que a lista e
      // o card do título mostram. Usar valor_original mandava para pagamento
      // a face do título, ignorando desconto negociado e retenção.
      const valorTotal = cpList.reduce((s, c) => s + valorAPagarCP(c), 0)

      // Empresa do lote só quando todos os títulos são da mesma; misto fica
      // nulo e a tela mostra "várias empresas".
      const empresas = new Set(cpList.map(c => c.empresa_id ?? 'sem_empresa'))
      const empresaUnica = empresas.size === 1 ? cpList[0]?.empresa_id ?? null : null

      const { data: lote, error: lErr } = await supabase
        .from('fin_lotes_pagamento')
        .insert({
          numero_lote: numeroLote,
          criado_por: criadoPor,
          valor_total: valorTotal,
          qtd_itens: cpList.length,
          status: 'montando',
          observacao,
          empresa_id: empresaUnica,
        })
        .select()
        .single()
      if (lErr) throw lErr

      const { error: iErr } = await supabase
        .from('fin_lote_itens')
        .insert(cpList.map(cp => ({ lote_id: lote.id, cp_id: cp.id, valor: valorAPagarCP(cp) })))
      if (iErr) throw iErr

      const { error: uErr } = await supabase
        .from('fin_contas_pagar')
        .update({ lote_id: lote.id, status: 'em_lote' })
        .in('id', cpList.map(cp => cp.id))
      if (uErr) console.warn('Aviso: lote_id não atualizado nas CPs:', uErr.message)

      return [lote as LotePagamento]
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
    },
  })
}

// ── Mutation: Enviar lote para aprovação ──────────────────────────────────────

export function useEnviarLoteAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      loteId,
      lote,
    }: {
      loteId: string
      lote: LotePagamento
    }) => {
      // 1. Update lote status
      const { error } = await supabase
        .from('fin_lotes_pagamento')
        .update({ status: 'enviado_aprovacao', updated_at: new Date().toISOString() })
        .eq('id', loteId)
      if (error) throw error

      // 2. CPs already have status 'em_lote' from useCriarLote — no change needed
      // (keeping lote_id reference intact)

      // 3. Cancela aprovacoes pendentes/esclarecimento anteriores do mesmo lote
      await supabase
        .from('apr_aprovacoes')
        .update({ status: 'rejeitada', data_decisao: new Date().toISOString() })
        .eq('entidade_id', loteId)
        .in('status', ['pendente', 'esclarecimento'])

      // 4. Create apr_aprovacoes record for the batch
      const nivel = lote.valor_total > 100000 ? 4 : lote.valor_total > 25000 ? 3 : lote.valor_total > 5000 ? 2 : 1
      // Decisão da Diretoria 03/ago/2026: Welton saiu da aprovação financeira
      // (fica só em validação técnica e Compras) — Laucídio aprova todas as faixas.
      const aprovadorNome = 'Laucidio'
      const loteData = new Date().toLocaleDateString('pt-BR')
      const entidadeNumero = `${lote.numero_lote} • ${loteData} • ${lote.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`

      const { error: aprovacaoErr } = await supabase
        .from('apr_aprovacoes')
        .insert({
          modulo: 'fin',
          tipo_aprovacao: 'autorizacao_pagamento',
          entidade_id: loteId,
          entidade_numero: entidadeNumero,
          aprovador_nome: aprovadorNome,
          aprovador_email: '',
          nivel,
          status: 'pendente',
          observacao: `Lote de pagamento ${lote.numero_lote} — ${lote.qtd_itens} itens — ${lote.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          data_limite: new Date(Date.now() + 72 * 3600_000).toISOString(),
        })

      // Sem esta checagem o lote virava 'enviado_aprovacao' e o AprovAí ficava
      // vazio: a RLS barrava o INSERT (mig 223) e ninguém ficava sabendo.
      // Volta o lote pra montagem — melhor reenviar do que dar por enviado.
      if (aprovacaoErr) {
        await supabase
          .from('fin_lotes_pagamento')
          .update({ status: 'montando', updated_at: new Date().toISOString() })
          .eq('id', loteId)
        throw new Error(`O lote não foi enviado: falha ao criar a aprovação (${aprovacaoErr.message})`)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
    },
  })
}

// ── Mutation: Decidir item individual do lote ────────────────────────────────

export function useDecidirItemLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      itemId,
      loteId,
      decisao,
      decidido_por,
      observacao,
    }: {
      itemId: string
      loteId: string
      decisao: 'aprovado' | 'rejeitado'
      decidido_por: string
      observacao?: string
    }) => {
      // 1. Update item decision
      const { error } = await supabase
        .from('fin_lote_itens')
        .update({
          decisao,
          decidido_por,
          decidido_em: new Date().toISOString(),
          observacao,
        })
        .eq('id', itemId)
      if (error) throw error

      // 2. Recalculate lote status via RPC
      const { data: newStatus } = await supabase.rpc('rpc_resolver_lote_status', {
        p_lote_id: loteId,
      })

      return newStatus as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
    },
  })
}

// ── Mutation: Decidir TODOS os itens pendentes do lote ───────────────────────

export function useDecidirLoteCompleto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      loteId,
      decisao,
      decidido_por,
    }: {
      loteId: string
      decisao: 'aprovado' | 'rejeitado'
      decidido_por: string
    }) => {
      // 1. Batch update all pending items
      const { error } = await supabase
        .from('fin_lote_itens')
        .update({
          decisao,
          decidido_por,
          decidido_em: new Date().toISOString(),
        })
        .eq('lote_id', loteId)
        .eq('decisao', 'pendente')
      if (error) throw error

      // 2. Resolve lote status
      const { data: newStatus } = await supabase.rpc('rpc_resolver_lote_status', {
        p_lote_id: loteId,
      })

      return newStatus as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
    },
  })
}

// ── Query: CPs prontas para pagamento (aprovado_pgto) ────────────────────────

export function useCPsParaPagamento(statuses: string[] = ['aprovado_pgto']) {
  const key = [...statuses].sort().join(',')
  return useQuery<ContaPagar[]>({
    queryKey: ['cps-para-pagamento', key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_contas_pagar')
        .select(SELECT_CP)
        .in('status', statuses)
        .order('data_vencimento', { ascending: true })
      if (error) throw error
      return (data ?? []) as ContaPagar[]
    },
    refetchInterval: 60_000,
  })
}

// ── Mutation: Registrar pagamento em batch ───────────────────────────────────

export function useRegistrarPagamentoBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cpIds,
      dataPagamento,
    }: {
      cpIds: string[]
      dataPagamento?: string
    }) => {
      const { data, error } = await supabase.rpc('rpc_registrar_pagamento_batch', {
        p_cp_ids: cpIds,
        p_data_pagamento: dataPagamento ?? new Date().toISOString().slice(0, 10),
      })
      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
    },
  })
}

// ── Sincroniza qtd/valor do lote a partir dos itens reais ────────────────────

async function syncLoteTotais(loteId: string) {
  const { data: itens } = await supabase
    .from('fin_lote_itens')
    .select('valor')
    .eq('lote_id', loteId)
  const rows = itens ?? []
  const valorTotal = rows.reduce((s, i) => s + Number((i as { valor?: number }).valor ?? 0), 0)
  await supabase
    .from('fin_lotes_pagamento')
    .update({ valor_total: valorTotal, qtd_itens: rows.length, updated_at: new Date().toISOString() })
    .eq('id', loteId)
}

// ── Mutation: Remover item do lote (quando montando) ─────────────────────────

export function useRemoverItemLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, cpId, loteId }: { itemId: string; cpId: string; loteId?: string }) => {
      // 1. Delete item
      const { error } = await supabase
        .from('fin_lote_itens')
        .delete()
        .eq('id', itemId)
      if (error) throw error

      // 2. CP volta pra fila de Confirmados (antes ficava orfa com status em_lote)
      await supabase
        .from('fin_contas_pagar')
        .update({ lote_id: null, status: 'confirmado' })
        .eq('id', cpId)

      // 3. Recalcula totais do lote
      if (loteId) await syncLoteTotais(loteId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
    },
  })
}

// ── Mutation: Adicionar CPs confirmadas a um lote em montagem ────────────────

export function useAdicionarItensLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loteId, cps }: { loteId: string; cps: { id: string; valor_original: number }[] }) => {
      if (cps.length === 0) return

      const { error } = await supabase
        .from('fin_lote_itens')
        .insert(cps.map(cp => ({ lote_id: loteId, cp_id: cp.id, valor: valorAPagarCP(cp) })))
      if (error) throw error

      await supabase
        .from('fin_contas_pagar')
        .update({ lote_id: loteId, status: 'em_lote' })
        .in('id', cps.map(cp => cp.id))

      // O lote aceita empresas diferentes (pedido do user 04/ago). O empresa_id
      // do lote virou rótulo: vale enquanto todos os títulos forem da mesma
      // empresa e zera assim que a mistura acontece.
      const { data: cpRows } = await supabase
        .from('fin_contas_pagar')
        .select('empresa_id')
        .eq('lote_id', loteId)
      const empresas = new Set((cpRows ?? []).map(c => (c as any).empresa_id ?? 'sem'))
      await supabase
        .from('fin_lotes_pagamento')
        .update({ empresa_id: empresas.size === 1 ? ((cpRows?.[0] as any)?.empresa_id ?? null) : null })
        .eq('id', loteId)

      await syncLoteTotais(loteId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
    },
  })
}

// ── Mutation: Devolver lote em aprovacao para edicao (financeiro) ────────────
// Nunca editar sob os olhos do aprovador: o lote volta pra 'montando' e a
// pendencia no AprovAi expira. Depois de editar, "Enviar para Aprovacao" recria.

export function useDevolverLoteEdicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loteId }: { loteId: string }) => {
      const { error } = await supabase
        .from('fin_lotes_pagamento')
        .update({ status: 'montando', updated_at: new Date().toISOString() })
        .eq('id', loteId)
        .eq('status', 'enviado_aprovacao')
      if (error) throw error

      await supabase
        .from('apr_aprovacoes')
        .update({ status: 'expirada', data_decisao: new Date().toISOString() })
        .eq('entidade_id', loteId)
        .in('status', ['pendente', 'esclarecimento'])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
    },
  })
}

// ── Mutation: Desfazer lote (títulos voltam para Confirmados) ───────────────
// RPC mig 213: valida estágio, recusa se algum título já foi pago/está em
// pagamento, expira a aprovação pendente e mantém o lote como 'cancelado'
// (o número já circulou — não se apaga).

export function useDesfazerLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loteId, motivo }: { loteId: string; motivo?: string }) => {
      const { data, error } = await supabase.rpc('fin_lote_desfazer', {
        p_lote_id: loteId,
        p_motivo: motivo ?? null,
      })
      if (error) throw new Error(error.message)
      return data as { lote: string; titulos_liberados: number }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
    },
  })
}

export function useEnviarRemessaPagamentoBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpIds }: { cpIds: string[] }) => {
      if (cpIds.length === 0) return { remessaId: '', updated: 0 }

      const cfg = await getFinanceiroConfig(['n8n_webhook_url', 'cp_remessa_webhook_url'])
      const webhookUrl = buildEndpointUrl(
        cfg.cp_remessa_webhook_url,
        cfg.n8n_webhook_url,
        '/financeiro/cp/remessa/enviar',
      )

      if (!webhookUrl) {
        throw new Error('Configure o webhook de remessa em sys_config antes de enviar.')
      }

      const { data: cps, error: cpError } = await supabase
        .from('fin_contas_pagar')
        .select(SELECT_CP)
        .in('id', cpIds)
      if (cpError) throw cpError

      const contas = (cps ?? []) as ContaPagar[]
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'teg-frontend',
          cpIds,
          contas,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof payload?.message === 'string' ? payload.message : `HTTP ${response.status}`
        throw new Error(message)
      }
      if (payload?.accepted === false || payload?.success === false) {
        const message = typeof payload?.message === 'string' ? payload.message : 'Remessa recusada pelo endpoint'
        throw new Error(message)
      }

      const remessaId = extractRemessaId(payload) ?? `REM-${Date.now()}`

      // Se o n8n/Omie já atualizou o Supabase diretamente (success: true com incluidos)
      // não precisamos de RPC adicional — apenas invalidamos as queries
      const incluidos = typeof payload?.incluidos === 'number' ? payload.incluidos : cpIds.length

      return { remessaId, updated: incluidos, incluidos, erros: payload?.erros ?? 0 }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
    },
  })
}

export function useSincronizarRemessasPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cps }: { cps?: ContaPagar[] } = {}) => {
      const pendentes = (cps ?? []).filter(cp => cp.status === 'em_pagamento' && !!cp.remessa_id)
      if (pendentes.length === 0) return { processed: 0, confirmed: 0, errors: 0 }

      const cfg = await getFinanceiroConfig(['n8n_webhook_url', 'cp_remessa_status_webhook_url'])
      const statusUrl = buildEndpointUrl(
        cfg.cp_remessa_status_webhook_url,
        cfg.n8n_webhook_url,
        '/financeiro/cp/remessa/status',
      )

      if (!statusUrl) return { processed: 0, confirmed: 0, errors: 0 }

      const response = await fetch(statusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'teg-frontend',
          remessaIds: pendentes.map(cp => cp.remessa_id),
          cpIds: pendentes.map(cp => cp.id),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof payload?.message === 'string' ? payload.message : `HTTP ${response.status}`
        throw new Error(message)
      }

      const results = normalizeRemessaStatusResults(payload)
      let processed = 0
      let confirmed = 0
      let errors = 0

      for (const result of results) {
        const { data, error } = await supabase.rpc('rpc_processar_retorno_cp_remessa', {
          p_remessa_id: result.remessaId,
          p_status: result.status,
          p_payload: result.payload ?? {},
          p_data_pagamento: result.dataPagamento ?? new Date().toISOString().slice(0, 10),
          p_obs: result.message ?? null,
        })
        if (error) throw error

        const affected = Number(data ?? 0)
        processed += affected
        if (affected > 0) {
          if (['confirmada', 'confirmado', 'pago', 'sucesso', 'success'].includes(result.status)) confirmed += affected
          if (['erro', 'error', 'falha', 'failed', 'rejeitada', 'rejeitado'].includes(result.status)) errors += affected
        }
      }

      return { processed, confirmed, errors }
    },
    onSuccess: result => {
      if ((result?.processed ?? 0) === 0) return
      qc.invalidateQueries({ queryKey: ['cps-para-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
    },
  })
}
