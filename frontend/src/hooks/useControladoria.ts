import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  CtrlOrcamento,
  CtrlOrcamentoLinha,
  CtrlDRE,
  CtrlKPISnapshot,
  CtrlCenario,
  CtrlAlertaDesvio,
} from '../types/controladoria'

// ── Orcamentos ────────────────────────────────────────────────────────────────

export function useOrcamentos(filters?: { obra_id?: string; status?: string }) {
  return useQuery<CtrlOrcamento[]>({
    queryKey: ['ctrl-orcamentos', filters],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_orcamentos')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('ano', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.status) q = q.eq('status', filters.status)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlOrcamento[]
    },
  })
}

export function useOrcamento(id?: string) {
  return useQuery<CtrlOrcamento | null>({
    queryKey: ['ctrl-orcamento', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('ctrl_orcamentos')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .eq('id', id)
        .single()
      if (error) return null
      return data as CtrlOrcamento
    },
    enabled: !!id,
  })
}

export function useOrcamentoLinhas(orcamentoId?: string) {
  return useQuery<CtrlOrcamentoLinha[]>({
    queryKey: ['ctrl-orcamento-linhas', orcamentoId],
    queryFn: async () => {
      if (!orcamentoId) return []
      const { data, error } = await supabase
        .from('ctrl_orcamento_linhas')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('categoria')
        .order('mes', { ascending: true })
      if (error) return []
      return (data ?? []) as CtrlOrcamentoLinha[]
    },
    enabled: !!orcamentoId,
  })
}

export function useSalvarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orcamento: Partial<CtrlOrcamento> & { obra_id: string; ano: number }) => {
      const { error } = await supabase
        .from('ctrl_orcamentos')
        .upsert(orcamento, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ctrl-orcamentos'] })
      qc.invalidateQueries({ queryKey: ['ctrl-orcamento'] })
    },
  })
}

// ── DRE ───────────────────────────────────────────────────────────────────────

export function useDRE(filters?: { obra_id?: string; ano?: number }) {
  return useQuery<CtrlDRE[]>({
    queryKey: ['ctrl-dre', filters],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_dre')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.ano) q = q.eq('ano', filters.ano)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlDRE[]
    },
  })
}

export function useDREConsolidado() {
  return useQuery<Record<string, unknown>[]>({
    queryKey: ['ctrl-dre-consolidado'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_ctrl_dre_consolidado')
        .select('*')
      if (error) return []
      return (data ?? []) as Record<string, unknown>[]
    },
  })
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export function useKPIs(filters?: { obra_id?: string; tipo?: string }) {
  return useQuery<CtrlKPISnapshot[]>({
    queryKey: ['ctrl-kpis', filters],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_kpis_snapshot')
        .select('*')
        .order('data_snapshot', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.tipo) q = q.eq('tipo', filters.tipo)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlKPISnapshot[]
    },
  })
}

// ── Cenarios ──────────────────────────────────────────────────────────────────

export function useCenarios(obraId?: string) {
  return useQuery<CtrlCenario[]>({
    queryKey: ['ctrl-cenarios', obraId],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_cenarios')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('created_at', { ascending: false })
      if (obraId) q = q.eq('obra_id', obraId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlCenario[]
    },
  })
}

export function useSalvarCenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cenario: Partial<CtrlCenario> & { nome: string; tipo: string }) => {
      const { error } = await supabase
        .from('ctrl_cenarios')
        .upsert(cenario, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ctrl-cenarios'] })
    },
  })
}

// ── Alertas de Desvio ─────────────────────────────────────────────────────────

export function useAlertasDesvio(filters?: { obra_id?: string; severidade?: string; resolvido?: boolean }) {
  return useQuery<CtrlAlertaDesvio[]>({
    queryKey: ['ctrl-alertas', filters],
    queryFn: async () => {
      let q = supabase
        .from('ctrl_alertas_desvio')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('created_at', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.severidade) q = q.eq('severidade', filters.severidade)
      if (filters?.resolvido !== undefined) q = q.eq('resolvido', filters.resolvido)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as CtrlAlertaDesvio[]
    },
  })
}

export function useMarcarAlertaLido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ctrl_alertas_desvio')
        .update({ lido: true })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ctrl-alertas'] })
    },
  })
}

// ── Views ─────────────────────────────────────────────────────────────────────

export function useCustoPorObra() {
  return useQuery<Record<string, unknown>[]>({
    queryKey: ['ctrl-custo-por-obra'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vw_ctrl_custo_por_obra')
        .select('*')
      if (error) return []
      return (data ?? []) as Record<string, unknown>[]
    },
  })
}
