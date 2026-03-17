import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { ContaPagar, LotePagamento, LoteItem } from '../types/financeiro'

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
      let q = supabase
        .from('fin_lotes_pagamento')
        .select('*')
        .order('created_at', { ascending: false })
      if (statusFilter) q = q.eq('status', statusFilter)
      const { data, error } = await q
      if (error) throw error

      const lotes = (data ?? []) as LotePagamento[]
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
      const { data: itens, error: iErr } = await supabase
        .from('fin_lote_itens')
        .select('*')
        .eq('lote_id', loteId!)
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
    refetchInterval: 10_000,
  })
}

// ── Mutation: Criar lote ─────────────────────────────────────────────────────

export function useCriarLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cpIds,
      cps,
      criadoPor,
      observacao,
    }: {
      cpIds: string[]
      cps?: ContaPagar[]
      criadoPor: string
      observacao?: string
    }) => {
      // If cps not provided, fetch them
      let cpList = cps ?? []
      if (cpList.length === 0 && cpIds.length > 0) {
        const { data } = await supabase
          .from('fin_contas_pagar')
          .select('id, valor_original')
          .in('id', cpIds)
        cpList = (data ?? []) as ContaPagar[]
      }

      // 1. Generate lote number
      const { data: numData } = await supabase.rpc('generate_numero_lote')
      const numeroLote = (numData as string) || `LP-${Date.now()}`

      const valorTotal = cpList
        .filter(c => cpIds.includes(c.id))
        .reduce((s, c) => s + (c.valor_original ?? 0), 0)

      // 2. Insert lote
      const { data: lote, error: lErr } = await supabase
        .from('fin_lotes_pagamento')
        .insert({
          numero_lote: numeroLote,
          criado_por: criadoPor,
          valor_total: valorTotal,
          qtd_itens: cpIds.length,
          status: 'montando',
          observacao,
        })
        .select()
        .single()
      if (lErr) throw lErr

      // 3. Insert itens
      const itens = cpIds.map(cpId => {
        const cp = cpList.find(c => c.id === cpId)
        return {
          lote_id: lote.id,
          cp_id: cpId,
          valor: cp?.valor_original ?? 0,
        }
      })
      const { error: iErr } = await supabase
        .from('fin_lote_itens')
        .insert(itens)
      if (iErr) throw iErr

      // 4. Set lote_id + status on CPs
      const { error: uErr } = await supabase
        .from('fin_contas_pagar')
        .update({ lote_id: lote.id, status: 'em_lote' })
        .in('id', cpIds)
      if (uErr) console.warn('Aviso: lote_id não atualizado nas CPs:', uErr.message)

      return lote as LotePagamento
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

      // 3. Create apr_aprovacoes record for the batch
      const nivel = lote.valor_total > 100000 ? 4 : lote.valor_total > 25000 ? 3 : lote.valor_total > 5000 ? 2 : 1
      const aprovadorNome = lote.valor_total > 25000 ? 'Laucidio' : 'Welton'
      const loteData = new Date().toLocaleDateString('pt-BR')
      const entidadeNumero = `${lote.numero_lote} • ${loteData} • ${lote.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`

      await supabase
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

export function useCPsParaPagamento() {
  return useQuery<ContaPagar[]>({
    queryKey: ['cps-para-pagamento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_contas_pagar')
        .select(SELECT_CP)
        .eq('status', 'aprovado_pgto')
        .order('data_vencimento', { ascending: true })
      if (error) throw error
      return (data ?? []) as ContaPagar[]
    },
    refetchInterval: 15_000,
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

// ── Mutation: Remover item do lote (quando montando) ─────────────────────────

export function useRemoverItemLote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, cpId }: { itemId: string; cpId: string }) => {
      // 1. Delete item
      const { error } = await supabase
        .from('fin_lote_itens')
        .delete()
        .eq('id', itemId)
      if (error) throw error

      // 2. Clear lote_id from CP
      await supabase
        .from('fin_contas_pagar')
        .update({ lote_id: null })
        .eq('id', cpId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lote-detalhe'] })
      qc.invalidateQueries({ queryKey: ['lotes-pagamento'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
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
