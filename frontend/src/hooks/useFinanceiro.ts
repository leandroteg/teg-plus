import { useQuery } from '@tanstack/react-query'
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
export function useContasPagar(filters?: { status?: string; centro_custo?: string }) {
  return useQuery<ContaPagar[]>({
    queryKey: ['contas-pagar', filters],
    queryFn: async () => {
      let q = supabase
        .from('fin_contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: true })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.centro_custo) q = q.eq('centro_custo', filters.centro_custo)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ContaPagar[]
    },
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
      if (error) return []
      return (data ?? []) as ContaReceber[]
    },
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
