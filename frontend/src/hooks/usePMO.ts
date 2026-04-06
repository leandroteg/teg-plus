import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  PMOPortfolio, PMOTAP, PMOEAP, PMOTarefa,
  PMOMedicaoResumo, PMOMedicaoPeriodo, PMOMedicaoItem, PMOMedicaoItemPeriodo,
  PMOHistograma, PMOFluxoOS, PMOStatusReport,
  PMOMulta, PMOReuniao, PMOMudanca, PMOIndicadoresSnapshot,
  PMOStakeholder, PMOComunicacao, PMOOrcamento, PMORisco,
  PMOPlanoAcao, PMOEntregavel, PMODocumento, PMOAvancoFisico,
  PMOLicaoAprendida, PMOAceite, PMODesmobilizacao,
} from '../types/pmo'

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

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

// ── AI Generation Hooks ─────────────────────────────────────────────────────

export function useGerarTAPIA() {
  return useMutation({
    mutationFn: async (payload: {
      portfolio_id: string
      obra_nome: string
      numero_osc?: string
      resumo_osc?: string
      tipo_osc?: string
    }) => {
      const res = await fetch(`${N8N_BASE}/egp/gerar-tap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erro ao gerar TAP via IA')
      return res.json().catch(() => ({})) as Promise<Partial<PMOTAP>>
    },
  })
}

export function useGerarEAPIA() {
  return useMutation({
    mutationFn: async (payload: {
      portfolio_id: string
      obra_nome: string
      tap_dados?: Partial<PMOTAP>
    }) => {
      const res = await fetch(`${N8N_BASE}/egp/gerar-eap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erro ao gerar EAP via IA')
      return res.json().catch(() => ([])) as Promise<Partial<PMOEAP>[]>
    },
  })
}

export function useGerarCronogramaIA() {
  return useMutation({
    mutationFn: async (payload: {
      portfolio_id: string
      obra_nome: string
      eap_itens?: PMOEAP[]
      tap_dados?: Partial<PMOTAP>
    }) => {
      const res = await fetch(`${N8N_BASE}/egp/gerar-cronograma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Erro ao gerar cronograma via IA')
      return res.json().catch(() => ([])) as Promise<Partial<PMOTarefa>[]>
    },
  })
}

// ── Stakeholders ────────────────────────────────────────────────────────────

export function useStakeholders(portfolioId: string | undefined) {
  return useQuery<PMOStakeholder[]>({
    queryKey: ['pmo-stakeholders', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_stakeholders')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOStakeholder[]
    },
  })
}

export function useCriarStakeholder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOStakeholder>) => {
      const { data, error } = await supabase
        .from('pmo_stakeholders')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOStakeholder
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-stakeholders', vars.portfolio_id] })
    },
  })
}

export function useAtualizarStakeholder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOStakeholder> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_stakeholders')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOStakeholder
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-stakeholders', d.portfolio_id] })
    },
  })
}

export function useDeletarStakeholder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_stakeholders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-stakeholders', vars.portfolio_id] })
    },
  })
}

// ── Comunicação ─────────────────────────────────────────────────────────────

export function useComunicacao(portfolioId: string | undefined) {
  return useQuery<PMOComunicacao[]>({
    queryKey: ['pmo-comunicacao', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_comunicacao')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOComunicacao[]
    },
  })
}

export function useCriarComunicacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOComunicacao>) => {
      const { data, error } = await supabase
        .from('pmo_comunicacao')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOComunicacao
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-comunicacao', vars.portfolio_id] })
    },
  })
}

export function useAtualizarComunicacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOComunicacao> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_comunicacao')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOComunicacao
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-comunicacao', d.portfolio_id] })
    },
  })
}

export function useDeletarComunicacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_comunicacao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-comunicacao', vars.portfolio_id] })
    },
  })
}

// ── Orçamento ───────────────────────────────────────────────────────────────

export function useOrcamento(portfolioId: string | undefined) {
  return useQuery<PMOOrcamento[]>({
    queryKey: ['pmo-orcamento', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_orcamento')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOOrcamento[]
    },
  })
}

export function useCriarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOOrcamento>) => {
      const { data, error } = await supabase
        .from('pmo_orcamento')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOOrcamento
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-orcamento', vars.portfolio_id] })
    },
  })
}

export function useAtualizarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOOrcamento> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_orcamento')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOOrcamento
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-orcamento', d.portfolio_id] })
    },
  })
}

export function useDeletarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_orcamento').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-orcamento', vars.portfolio_id] })
    },
  })
}

// ── Riscos EGP ──────────────────────────────────────────────────────────────

export function useRiscosEGP(portfolioId: string | undefined) {
  return useQuery<PMORisco[]>({
    queryKey: ['pmo-riscos', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_riscos')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMORisco[]
    },
  })
}

export function useCriarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMORisco>) => {
      const { data, error } = await supabase
        .from('pmo_riscos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMORisco
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-riscos', vars.portfolio_id] })
    },
  })
}

export function useAtualizarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMORisco> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_riscos')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMORisco
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-riscos', d.portfolio_id] })
    },
  })
}

export function useDeletarRisco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_riscos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-riscos', vars.portfolio_id] })
    },
  })
}

// ── Plano de Ação ───────────────────────────────────────────────────────────

export function usePlanoAcao(portfolioId: string | undefined) {
  return useQuery<PMOPlanoAcao[]>({
    queryKey: ['pmo-plano-acao', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_plano_acao')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOPlanoAcao[]
    },
  })
}

export function useCriarAcao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOPlanoAcao>) => {
      const { data, error } = await supabase
        .from('pmo_plano_acao')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOPlanoAcao
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-plano-acao', vars.portfolio_id] })
    },
  })
}

export function useAtualizarAcao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOPlanoAcao> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_plano_acao')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOPlanoAcao
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-plano-acao', d.portfolio_id] })
    },
  })
}

export function useDeletarAcao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_plano_acao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-plano-acao', vars.portfolio_id] })
    },
  })
}

// ── Entregáveis ─────────────────────────────────────────────────────────────

export function useEntregaveis(portfolioId: string | undefined) {
  return useQuery<PMOEntregavel[]>({
    queryKey: ['pmo-entregaveis', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_entregaveis')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOEntregavel[]
    },
  })
}

export function useCriarEntregavel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOEntregavel>) => {
      const { data, error } = await supabase
        .from('pmo_entregaveis')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOEntregavel
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-entregaveis', vars.portfolio_id] })
    },
  })
}

export function useAtualizarEntregavel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOEntregavel> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_entregaveis')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOEntregavel
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-entregaveis', d.portfolio_id] })
    },
  })
}

export function useDeletarEntregavel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_entregaveis').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-entregaveis', vars.portfolio_id] })
    },
  })
}

// ── Documentos EGP ──────────────────────────────────────────────────────────

export function useDocumentosEGP(portfolioId: string | undefined) {
  return useQuery<PMODocumento[]>({
    queryKey: ['pmo-documentos', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_documentos')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMODocumento[]
    },
  })
}

export function useCriarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMODocumento>) => {
      const { data, error } = await supabase
        .from('pmo_documentos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMODocumento
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-documentos', vars.portfolio_id] })
    },
  })
}

export function useAtualizarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMODocumento> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_documentos')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMODocumento
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-documentos', d.portfolio_id] })
    },
  })
}

export function useDeletarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_documentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-documentos', vars.portfolio_id] })
    },
  })
}

// ── Avanço Físico ───────────────────────────────────────────────────────────

export function useAvancoFisico(portfolioId: string | undefined) {
  return useQuery<PMOAvancoFisico[]>({
    queryKey: ['pmo-avanco-fisico', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_avanco_fisico')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOAvancoFisico[]
    },
  })
}

export function useCriarAvanco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOAvancoFisico>) => {
      const { data, error } = await supabase
        .from('pmo_avanco_fisico')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOAvancoFisico
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-avanco-fisico', vars.portfolio_id] })
    },
  })
}

export function useDeletarAvanco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_avanco_fisico').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-avanco-fisico', vars.portfolio_id] })
    },
  })
}

// ── Lições Aprendidas ───────────────────────────────────────────────────────

export function useLicoesAprendidas(portfolioId: string | undefined) {
  return useQuery<PMOLicaoAprendida[]>({
    queryKey: ['pmo-licoes', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_licoes_aprendidas')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMOLicaoAprendida[]
    },
  })
}

export function useCriarLicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOLicaoAprendida>) => {
      const { data, error } = await supabase
        .from('pmo_licoes_aprendidas')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMOLicaoAprendida
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-licoes', vars.portfolio_id] })
    },
  })
}

export function useAtualizarLicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOLicaoAprendida> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_licoes_aprendidas')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOLicaoAprendida
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-licoes', d.portfolio_id] })
    },
  })
}

export function useDeletarLicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_licoes_aprendidas').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-licoes', vars.portfolio_id] })
    },
  })
}

// ── Aceite ──────────────────────────────────────────────────────────────────

export function useAceite(portfolioId: string | undefined) {
  return useQuery<PMOAceite | null>({
    queryKey: ['pmo-aceite', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_aceite')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .single()
      if (error) return null
      return data as PMOAceite
    },
  })
}

export function useSalvarAceite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMOAceite> & { portfolio_id: string }) => {
      const { data, error } = await supabase
        .from('pmo_aceite')
        .upsert(payload, { onConflict: 'portfolio_id' })
        .select()
        .single()
      if (error) throw error
      return data as PMOAceite
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-aceite', vars.portfolio_id] })
    },
  })
}

export function useAtualizarAceite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMOAceite> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_aceite')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMOAceite
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-aceite', d.portfolio_id] })
    },
  })
}

// ── Desmobilização ──────────────────────────────────────────────────────────

export function useDesmobilizacao(portfolioId: string | undefined) {
  return useQuery<PMODesmobilizacao[]>({
    queryKey: ['pmo-desmobilizacao', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pmo_desmobilizacao')
        .select('*')
        .eq('portfolio_id', portfolioId!)
        .order('created_at', { ascending: false })
      if (error) return []
      return (data ?? []) as PMODesmobilizacao[]
    },
  })
}

export function useCriarDesmob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<PMODesmobilizacao>) => {
      const { data, error } = await supabase
        .from('pmo_desmobilizacao')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as PMODesmobilizacao
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-desmobilizacao', vars.portfolio_id] })
    },
  })
}

export function useAtualizarDesmob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PMODesmobilizacao> & { id: string }) => {
      const { data, error } = await supabase
        .from('pmo_desmobilizacao')
        .update(payload)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PMODesmobilizacao
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['pmo-desmobilizacao', d.portfolio_id] })
    },
  })
}

export function useDeletarDesmob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, portfolio_id }: { id: string; portfolio_id: string }) => {
      const { error } = await supabase.from('pmo_desmobilizacao').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pmo-desmobilizacao', vars.portfolio_id] })
    },
  })
}
