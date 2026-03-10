import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  ContaPagar, ContaReceber, Fornecedor,
  FinanceiroDashboardData, FinanceiroKPIs,
} from '../types/financeiro'

const EMPTY_KPIS: FinanceiroKPIs = {
  total_cp: 0, cp_a_vencer: 0, cp_vencidas: 0, cp_pagas_periodo: 0,
  valor_total_aberto: 0, valor_pago_periodo: 0, valor_a_vencer_7d: 0,
  aguardando_aprovacao: 0, total_cr: 0, valor_cr_aberto: 0,
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export function useFinanceiroDashboard(periodo = '30d') {
  return useQuery<FinanceiroDashboardData>({
    queryKey: ['financeiro-dashboard', periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_financeiro', {
        p_periodo: periodo,
      })
      if (error) {
        // Fallback: tabela pode não existir ainda
        return { kpis: EMPTY_KPIS, por_status: [], por_centro_custo: [], vencimentos_proximos: [], recentes: [] }
      }
      return data as FinanceiroDashboardData
    },
    refetchInterval: 30_000,
  })
}

// ── Contas a Pagar ───────────────────────────────────────────────────────────
const SELECT_CP = `
  *,
  pedido:cmp_pedidos!pedido_id(numero_pedido, status, data_pedido, data_prevista_entrega, status_pagamento),
  requisicao:cmp_requisicoes!requisicao_id(numero, descricao, obra_nome, categoria, centro_custo, classe_financeira, projeto_id)
`

export function useContasPagar(filters?: { status?: string; centro_custo?: string }) {
  return useQuery<ContaPagar[]>({
    queryKey: ['contas-pagar', filters],
    queryFn: async () => {
      let q = supabase
        .from('fin_contas_pagar')
        .select(SELECT_CP)
        .order('data_vencimento', { ascending: true })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.centro_custo) q = q.eq('centro_custo', filters.centro_custo)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as ContaPagar[]
    },
    retry: false,
  })
}

// ── Contas a Receber ─────────────────────────────────────────────────────────
export function useContasReceber() {
  return useQuery<ContaReceber[]>({
    queryKey: ['contas-receber'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_contas_receber')
        .select('*')
        .order('data_vencimento', { ascending: true })
      if (error) throw error
      return (data ?? []) as ContaReceber[]
    },
    retry: false,
  })
}

// ── Fornecedores ─────────────────────────────────────────────────────────────
export function useFornecedores() {
  return useQuery<Fornecedor[]>({
    queryKey: ['fornecedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cmp_fornecedores')
        .select('*')
        .order('razao_social')
      if (error) return []
      return (data ?? []) as Fornecedor[]
    },
  })
}

// ── Aprovar Pagamento (AP): aguardando_aprovacao → aprovado_pgto ──────────
// Autorização de Pagamento: o financeiro aprova a CP para pagamento efetivo.

export function useAprovarPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpId, aprovadorNome }: { cpId: string; aprovadorNome?: string }) => {
      const nome = aprovadorNome ?? 'Financeiro'

      // 1. Update CP status
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({
          status: 'aprovado_pgto',
          aprovado_por: nome,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', cpId)
      if (error) throw error

      // 2. Resolve any pending apr_aprovacoes for this CP
      await supabase
        .from('apr_aprovacoes')
        .update({
          status: 'aprovada',
          data_decisao: new Date().toISOString(),
        })
        .eq('entidade_id', cpId)
        .eq('tipo_aprovacao', 'autorizacao_pagamento')
        .eq('status', 'pendente')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
    },
  })
}

// ── Solicitar Aprovação de Pagamento: cria registro em apr_aprovacoes ─────
// Deve ser chamado quando uma CP entra em status aguardando_aprovacao.
export function useSolicitarAprovacaoPagamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpId }: { cpId: string }) => {
      // Busca dados da CP
      const { data: cp } = await supabase
        .from('fin_contas_pagar')
        .select('id, fornecedor_nome, valor_original, numero_documento, descricao, centro_custo')
        .eq('id', cpId)
        .single()

      if (!cp) throw new Error('CP nao encontrada')

      const valor = cp.valor_original ?? 0
      const nivel = valor > 100000 ? 4 : valor > 25000 ? 3 : valor > 5000 ? 2 : 1
      const aprovadorNome = valor > 25000 ? 'Laucidio' : 'Welton'

      // Verifica se ja existe aprovacao pendente para esta CP
      const { data: existing } = await supabase
        .from('apr_aprovacoes')
        .select('id')
        .eq('entidade_id', cpId)
        .eq('tipo_aprovacao', 'autorizacao_pagamento')
        .eq('status', 'pendente')
        .limit(1)

      if (existing && existing.length > 0) return // Ja existe

      const { error } = await supabase
        .from('apr_aprovacoes')
        .insert({
          modulo: 'fin',
          tipo_aprovacao: 'autorizacao_pagamento',
          entidade_id: cpId,
          entidade_numero: cp.numero_documento ?? '',
          aprovador_nome: aprovadorNome,
          aprovador_email: '',
          nivel,
          status: 'pendente',
          observacao: `Autorizacao pagamento — ${cp.fornecedor_nome} — ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
          data_limite: new Date(Date.now() + 72 * 3600_000).toISOString(),
        })

      if (error) console.warn('Aviso: apr_aprovacoes nao criado para CP:', error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aprovacoes-pendentes'] })
      qc.invalidateQueries({ queryKey: ['aprovacoes-kpis'] })
    },
  })
}

// ── Sync CPs pendentes → apr_aprovacoes (garante visibilidade no AprovAi) ──
// Cria registros apr_aprovacoes para CPs aguardando_aprovacao que ainda nao tem.
export async function syncCPsParaAprovacao() {
  // 1. Busca CPs aguardando_aprovacao
  const { data: cps } = await supabase
    .from('fin_contas_pagar')
    .select('id, fornecedor_nome, valor_original, numero_documento')
    .eq('status', 'aguardando_aprovacao')

  if (!cps || cps.length === 0) return 0

  // 2. Busca quais ja tem apr_aprovacoes pendentes
  const { data: existing } = await supabase
    .from('apr_aprovacoes')
    .select('entidade_id')
    .eq('tipo_aprovacao', 'autorizacao_pagamento')
    .eq('status', 'pendente')
    .in('entidade_id', cps.map(c => c.id))

  const existingIds = new Set((existing ?? []).map(e => e.entidade_id))
  const missing = cps.filter(cp => !existingIds.has(cp.id))

  if (missing.length === 0) return 0

  // 3. Cria registros faltantes
  const inserts = missing.map(cp => {
    const valor = cp.valor_original ?? 0
    const nivel = valor > 100000 ? 4 : valor > 25000 ? 3 : valor > 5000 ? 2 : 1
    return {
      modulo: 'fin',
      tipo_aprovacao: 'autorizacao_pagamento',
      entidade_id: cp.id,
      entidade_numero: cp.numero_documento ?? '',
      aprovador_nome: valor > 25000 ? 'Laucidio' : 'Welton',
      aprovador_email: '',
      nivel,
      status: 'pendente',
      observacao: `Autorizacao pagamento — ${cp.fornecedor_nome} — ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      data_limite: new Date(Date.now() + 72 * 3600_000).toISOString(),
    }
  })

  const { error } = await supabase.from('apr_aprovacoes').insert(inserts)
  if (error) console.warn('Aviso: sync CPs → apr_aprovacoes falhou:', error.message)
  return missing.length
}

// ── Marcar CP como Pago ────────────────────────────────────────────────────
// Atualiza diretamente fin_contas_pagar quando não há pedido vinculado,
// ou quando o financeiro quer forçar status independente do fluxo de compras.

export function useMarcarCPPago() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpId, dataPagamento }: { cpId: string; dataPagamento?: string }) => {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({
          status: 'pago',
          data_pagamento: dataPagamento ?? new Date().toISOString().split('T')[0],
        })
        .eq('id', cpId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contas-pagar'] }),
  })
}

// ── Classificação em lote (CP) ────────────────────────────────────────────
export function useClassificarCPBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ids,
      centro_custo,
      classe_financeira,
      projeto_id,
    }: {
      ids: string[]
      centro_custo?: string
      classe_financeira?: string
      projeto_id?: string
    }) => {
      const updates: Record<string, string | undefined> = {}
      if (centro_custo !== undefined) updates.centro_custo = centro_custo
      if (classe_financeira !== undefined) updates.classe_financeira = classe_financeira
      if (projeto_id !== undefined) updates.projeto_id = projeto_id
      if (Object.keys(updates).length === 0) return

      const { error } = await supabase
        .from('fin_contas_pagar')
        .update(updates)
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// ── Conciliar em lote (CP) ────────────────────────────────────────────────
export function useConciliarCPBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'conciliado' })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// ── Classificação em lote (CR) ────────────────────────────────────────────
export function useClassificarCRBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      ids,
      centro_custo,
      classe_financeira,
      projeto_id,
    }: {
      ids: string[]
      centro_custo?: string
      classe_financeira?: string
      projeto_id?: string
    }) => {
      const updates: Record<string, string | undefined> = {}
      if (centro_custo !== undefined) updates.centro_custo = centro_custo
      if (classe_financeira !== undefined) updates.classe_financeira = classe_financeira
      if (projeto_id !== undefined) updates.projeto_id = projeto_id
      if (Object.keys(updates).length === 0) return

      const { error } = await supabase
        .from('fin_contas_receber')
        .update(updates)
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// ── Conciliar em lote (CR) ────────────────────────────────────────────────
export function useConciliarCRBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const { error } = await supabase
        .from('fin_contas_receber')
        .update({ status: 'conciliado' })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
    },
  })
}

// ── Valores distintos para autocomplete ───────────────────────────────────
export function useDistinctCentroCusto() {
  return useQuery<string[]>({
    queryKey: ['distinct-centro-custo'],
    queryFn: async () => {
      const { data: cp } = await supabase
        .from('fin_contas_pagar')
        .select('centro_custo')
        .not('centro_custo', 'is', null)
        .limit(500)
      const { data: cr } = await supabase
        .from('fin_contas_receber')
        .select('centro_custo')
        .not('centro_custo', 'is', null)
        .limit(500)
      const all = [...(cp ?? []), ...(cr ?? [])]
      const unique = [...new Set(all.map(r => r.centro_custo).filter(Boolean))] as string[]
      return unique.sort()
    },
    staleTime: 60_000,
  })
}

export function useDistinctClasseFinanceira() {
  return useQuery<string[]>({
    queryKey: ['distinct-classe-financeira'],
    queryFn: async () => {
      const { data: cp } = await supabase
        .from('fin_contas_pagar')
        .select('classe_financeira')
        .not('classe_financeira', 'is', null)
        .limit(500)
      const { data: cr } = await supabase
        .from('fin_contas_receber')
        .select('classe_financeira')
        .not('classe_financeira', 'is', null)
        .limit(500)
      const all = [...(cp ?? []), ...(cr ?? [])]
      const unique = [...new Set(all.map(r => r.classe_financeira).filter(Boolean))] as string[]
      return unique.sort()
    },
    staleTime: 60_000,
  })
}

export function useObras() {
  return useQuery<{ id: string; nome: string; codigo: string }[]>({
    queryKey: ['obras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_obras')
        .select('id, nome, codigo')
        .order('nome')
      if (error) return []
      return data ?? []
    },
    staleTime: 300_000,
  })
}
