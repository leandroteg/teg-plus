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

// ── Fornecedor por ID (Issue #36: dados bancarios/PIX) ──────────────────────
export function useFornecedorById(fornecedorId?: string | null) {
  return useQuery<Fornecedor | null>({
    queryKey: ['fornecedor', fornecedorId],
    queryFn: async () => {
      if (!fornecedorId) return null
      const { data, error } = await supabase
        .from('cmp_fornecedores')
        .select('*')
        .eq('id', fornecedorId)
        .single()
      if (error) return null
      return data as Fornecedor
    },
    enabled: !!fornecedorId,
    staleTime: 300_000,
  })
}

// ── Confirmar CP: previsto → confirmado ─────────────────────────────────
export function useConfirmarCP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ cpIds }: { cpIds: string[] }) => {
      const { error } = await supabase
        .from('fin_contas_pagar')
        .update({ status: 'confirmado' })
        .in('id', cpIds)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['financeiro-dashboard'] })
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
      const { data, error } = await supabase
        .from('fin_centros_custo')
        .select('nome')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []).map(r => r.nome).filter(Boolean)
    },
    staleTime: 60_000,
  })
}

export function useDistinctClasseFinanceira() {
  return useQuery<string[]>({
    queryKey: ['distinct-classe-financeira'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_classes_financeiras')
        .select('nome')
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return (data ?? []).map(r => r.nome).filter(Boolean)
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
