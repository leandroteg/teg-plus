import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  PMOPortfolio, PMOTAP, PMOEAP, PMOTarefa,
  PMOMedicaoResumo, PMOMedicaoPeriodo, PMOMedicaoItem, PMOMedicaoItemPeriodo,
  PMOHistograma, PMOFluxoOS, PMOStatusReport,
  PMOMulta, PMOReuniao, PMOMudanca, PMOIndicadoresSnapshot,
} from '../types/pmo'

// ── Portfolio ────────────────────────────────────────────────────────────────

export function usePortfolios(filters?: { status?: string; obra_id?: string }) {
  return useQuery<PMOPortfolio[]>({
    queryKey: ['pmo-portfolios', filters],
    queryFn: async () => {
      let q = supabase
        .from('pmo_portfolio')
        .select('*, obra:sys_obras!obra_id(id, nome, codigo)')
        .order('created_at', { ascending: false })
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOPortfolio[]
    },
  })
}

export function usePortfolio(id: string | undefined) {
  return useQuery<PMOPortfolio | null>({
    queryKey: ['pmo-portfolio', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_portfolio')
        .select('*, obra:sys_obras!obra_id(id, nome, codigo)')
        .eq('id', id!)
        .single()
      if (error) return null
      return data as PMOPortfolio
    },
  })
}

export function useCriarPortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOPortfolio>) => {
      const { data, error } = await supabase
        .from('pmo_portfolio')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOPortfolio
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pmo-portfolios'] })
    },
  })
}

export function useAtualizarPortfolio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOPortfolio> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_portfolio')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOPortfolio
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-portfolios'] })
      qc.invalidateQueries({ queryKey: ['pmo-portfolio', vars.id] })
    },
  })
}

// ── TAP ──────────────────────────────────────────────────────────────────────

export function useTAP(portfolioId: string | undefined) {
  return useQuery<PMOTAP | null>({
    queryKey: ['pmo-tap', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_tap')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .single()
      if (error) return null
      return data as PMOTAP
    },
  })
}

export function useSalvarTAP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOTAP> & { portfolio_id: string }) => {
      const { data, error } = await supabase
        .from('pmo_tap')
        .upsert(payload, { onConflict: 'portfolio_id' })
        .select()
        .single()
      if (error) throw error
      return data as PMOTAP
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-tap', vars.portfolio_id] })
    },
  })
}

// ── EAP ──────────────────────────────────────────────────────────────────────

export function useEAP(portfolioId: string | undefined) {
  return useQuery<PMOEAP[]>({
    queryKey: ['pmo-eap', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_eap')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('ordem')
      if (error) return []
      return (data ?? []) as PMOEAP[]
    },
  })
}

// ── Tarefas (Cronograma) ─────────────────────────────────────────────────────

export function useTarefas(portfolioId: string | undefined, filters?: { status?: string }) {
  return useQuery<PMOTarefa[]>({
    queryKey: ['pmo-tarefas', portfolioId, filters],
    enabled: !!portfolioId,
    queryFn: async () => {
      let q = supabase
        .from('pmo_tarefas')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('ordem')
      if (filters?.status) q = q.eq('status', filters.status)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOTarefa[]
    },
  })
}

export function useCriarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOTarefa>) => {
      const { data, error } = await supabase
        .from('pmo_tarefas')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOTarefa
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-tarefas', vars.portfolio_id] })
    },
  })
}

export function useAtualizarTarefa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOTarefa> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_tarefas')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOTarefa
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-tarefas', d.portfolio_id] })
    },
  })
}

// ── Medicoes ─────────────────────────────────────────────────────────────────

export function useMedicaoResumo(portfolioId: string | undefined) {
  return useQuery<PMOMedicaoResumo | null>({
    queryKey: ['pmo-medicao-resumo', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_medicao_resumo')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .single()
      if (error) return null
      return data as PMOMedicaoResumo
    },
  })
}

export function useMedicaoPeriodos(resumoId: string | undefined) {
  return useQuery<PMOMedicaoPeriodo[]>({
    queryKey: ['pmo-medicao-periodos', resumoId],
    enabled: !!resumoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_medicao_periodo')
        .select('*')
        .eq('medicao_resumo_id', resumoId!)
        .order('periodo')
      if (error) return []
      return (data ?? []) as PMOMedicaoPeriodo[]
    },
  })
}

export function useMedicaoItens(portfolioId: string | undefined) {
  return useQuery<PMOMedicaoItem[]>({
    queryKey: ['pmo-medicao-itens', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_medicao_itens')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('numero_medicao')
      if (error) return []
      return (data ?? []) as PMOMedicaoItem[]
    },
  })
}

// ── Medicao Item Periodos ────────────────────────────────────────────────────

export function useMedicaoItemPeriodos(medicaoItemId: string | undefined) {
  return useQuery<PMOMedicaoItemPeriodo[]>({
    queryKey: ['pmo-medicao-item-periodos', medicaoItemId],
    enabled: !!medicaoItemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_medicao_item_periodo')
        .select('*')
        .eq('medicao_item_id', medicaoItemId!)
        .order('periodo')
      if (error) return []
      return (data ?? []) as PMOMedicaoItemPeriodo[]
    },
  })
}

// ── Histograma ───────────────────────────────────────────────────────────────

export function useHistograma(portfolioId: string | undefined) {
  return useQuery<PMOHistograma[]>({
    queryKey: ['pmo-histograma', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_histograma')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('semana')
      if (error) return []
      return (data ?? []) as PMOHistograma[]
    },
  })
}

// ── Fluxo OS ─────────────────────────────────────────────────────────────────

export function useFluxoOS(portfolioId?: string) {
  return useQuery<PMOFluxoOS[]>({
    queryKey: ['pmo-fluxo-os', portfolioId],
    queryFn: async () => {
      let q = supabase
        .from('pmo_fluxo_os')
        .select('*')
        .order('created_at', { ascending: false })
      if (portfolioId) q = q.eq('portfolio_id', portfolioId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOFluxoOS[]
    },
  })
}

export function useAtualizarFluxoOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOFluxoOS> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_fluxo_os')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOFluxoOS
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pmo-fluxo-os'] })
    },
  })
}

// ── Status Report ────────────────────────────────────────────────────────────

export function useStatusReports(portfolioId: string | undefined) {
  return useQuery<PMOStatusReport[]>({
    queryKey: ['pmo-status-reports', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_status_report')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('data_report', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOStatusReport[]
    },
  })
}

// ── Multas ───────────────────────────────────────────────────────────────────

export function useMultas(portfolioId?: string) {
  return useQuery<PMOMulta[]>({
    queryKey: ['pmo-multas', portfolioId],
    queryFn: async () => {
      let q = supabase
        .from('pmo_multas')
        .select('*')
        .order('created_at', { ascending: false })
      if (portfolioId) q = q.eq('portfolio_id', portfolioId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOMulta[]
    },
  })
}

// ── Reunioes ─────────────────────────────────────────────────────────────────

export function useReunioes(portfolioId?: string) {
  return useQuery<PMOReuniao[]>({
    queryKey: ['pmo-reunioes', portfolioId],
    queryFn: async () => {
      let q = supabase
        .from('pmo_reunioes')
        .select('*')
        .order('data', { ascending: false })
      if (portfolioId) q = q.eq('portfolio_id', portfolioId)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as PMOReuniao[]
    },
  })
}

// ── Mudancas ─────────────────────────────────────────────────────────────────

export function useMudancas(portfolioId: string | undefined) {
  return useQuery<PMOMudanca[]>({
    queryKey: ['pmo-mudancas', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_mudancas')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('data_solicitacao', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOMudanca[]
    },
  })
}

// ── Indicadores Snapshot ─────────────────────────────────────────────────────

export function useIndicadores(portfolioId: string | undefined) {
  return useQuery<PMOIndicadoresSnapshot[]>({
    queryKey: ['pmo-indicadores', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_indicadores_snapshot')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('data_snapshot', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOIndicadoresSnapshot[]
    },
  })
}
