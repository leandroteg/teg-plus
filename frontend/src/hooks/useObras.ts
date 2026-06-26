// ─────────────────────────────────────────────────────────────────────────────
// hooks/useObras.ts — Modulo Obras (Apontamentos, RDO, Adiantamentos, etc.)
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  ObraFrente,
  ObraApontamento,
  ObraRDO,
  ObraAdiantamento,
  ObraPrestacaoContas,
  ObraEquipe,
  ObraMobilizacao,
  ObraPlanejamentoEquipe,
  ColaboradorAtivo,
  PapelEquipe,
} from '../types/obras'

// Sugere o papel na obra a partir do cargo/departamento do RH.
// Topografo conta como encarregado (leva Time). Seguranca (QSMA/TST) -> apoio.
export function papelSugerido(cargo?: string | null, departamento?: string | null): PapelEquipe {
  const c = (cargo ?? '').toUpperCase()
  const d = (departamento ?? '').toUpperCase()
  if (/ENGENHEIR/.test(c)) return (/SEGURAN/.test(c) || d === 'QSMA' || d === 'TST') ? 'apoio' : 'engenheiro'
  if (/SUPERVISOR/.test(c)) return 'supervisor'
  if (/ENCARREGAD|MESTRE|TOPOGRAF/.test(c)) return 'encarregado'
  if (d === 'QSMA' || d === 'TST' || /SEGURAN/.test(c)) return 'apoio'
  return 'time'
}

// ── Frentes ──────────────────────────────────────────────────────────────────

export function useObrasFrentes(obraId?: string) {
  return useQuery<ObraFrente[]>({
    queryKey: ['obr-frentes', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obr_frentes')
        .select('*')
        .eq('obra_id', obraId!)
        .order('nome')
      if (error) return []
      return (data ?? []) as ObraFrente[]
    },
  })
}

// ── Obras com Projeto (lookup p/ agrupar Projeto > Obra) ─────────────────────

export interface ObraComProjeto {
  id: string
  nome: string
  codigo: string
  status: string
  projeto_id?: string
  projeto_nome?: string
  projeto_codigo?: string
}

export function useObrasComProjeto() {
  return useQuery<ObraComProjeto[]>({
    queryKey: ['obras-com-projeto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_obras')
        .select('id, nome, codigo, status, pmo_projeto_id, projeto:pmo_projetos!pmo_projeto_id(id, nome, codigo)')
        .neq('status', 'concluida')
        .order('nome')
      if (error) return []
      return ((data ?? []) as any[]).map(o => ({
        id: o.id,
        nome: o.nome,
        codigo: o.codigo,
        status: o.status,
        projeto_id: o.pmo_projeto_id ?? undefined,
        projeto_nome: o.projeto?.nome ?? undefined,
        projeto_codigo: o.projeto?.codigo ?? undefined,
      })) as ObraComProjeto[]
    },
    staleTime: 300_000,
  })
}

// ── Apontamentos ─────────────────────────────────────────────────────────────

export function useApontamentos(filters?: { obra_id?: string; status?: string }) {
  return useQuery<ObraApontamento[]>({
    queryKey: ['obr-apontamentos', filters],
    queryFn: async () => {
      let q = supabase
        .from('obr_apontamentos')
        .select('*, obra:sys_obras!obra_id(id, nome), frente:obr_frentes!frente_id(id, nome)')
        .order('data_apontamento', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.status) q = q.eq('status', filters.status)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ObraApontamento[]
    },
  })
}

export function useCriarApontamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ObraApontamento>) => {
      const { data, error } = await supabase
        .from('obr_apontamentos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ObraApontamento
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-apontamentos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useAtualizarApontamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ObraApontamento> & { id: string }) => {
      const { error } = await supabase
        .from('obr_apontamentos')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-apontamentos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useExcluirApontamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('obr_apontamentos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-apontamentos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

// ── RDO (Relatorio Diario de Obra) ──────────────────────────────────────────

export function useRDOs(filters?: { obra_id?: string }) {
  return useQuery<ObraRDO[]>({
    queryKey: ['obr-rdos', filters],
    queryFn: async () => {
      let q = supabase
        .from('obr_rdo')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('data', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ObraRDO[]
    },
  })
}

export function useCriarRDO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ObraRDO>) => {
      const { data, error } = await supabase
        .from('obr_rdo')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ObraRDO
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-rdos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useAtualizarRDO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ObraRDO> & { id: string }) => {
      const { error } = await supabase
        .from('obr_rdo')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-rdos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useExcluirRDO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('obr_rdo').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-rdos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

// ── Adiantamentos ────────────────────────────────────────────────────────────

export function useAdiantamentos(filters?: { obra_id?: string; status?: string }) {
  return useQuery<ObraAdiantamento[]>({
    queryKey: ['obr-adiantamentos', filters],
    queryFn: async () => {
      let q = supabase
        .from('obr_adiantamentos')
        .select('*, obra:sys_obras!obra_id(id, nome), solicitante:sys_perfis!solicitante_id(id, nome)')
        .order('data_solicitacao', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.status) q = q.eq('status', filters.status)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ObraAdiantamento[]
    },
  })
}

export function useCriarAdiantamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ObraAdiantamento>) => {
      const { data, error } = await supabase
        .from('obr_adiantamentos')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ObraAdiantamento
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-adiantamentos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useAtualizarAdiantamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ObraAdiantamento> & { id: string }) => {
      const { error } = await supabase
        .from('obr_adiantamentos')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-adiantamentos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useAprovarAdiantamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      aprovado_por,
      valor_aprovado,
    }: {
      id: string
      aprovado_por: string
      valor_aprovado: number
    }) => {
      const { error } = await supabase
        .from('obr_adiantamentos')
        .update({
          status: 'aprovado',
          aprovado_por,
          valor_aprovado,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-adiantamentos'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

// ── Prestacao de Contas ──────────────────────────────────────────────────────

export function usePrestacaoContas(filters?: {
  obra_id?: string
  status?: string
  categoria?: string
}) {
  return useQuery<ObraPrestacaoContas[]>({
    queryKey: ['obr-prestacao', filters],
    queryFn: async () => {
      let q = supabase
        .from('obr_prestacao_contas')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('data_gasto', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.categoria) q = q.eq('categoria', filters.categoria)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ObraPrestacaoContas[]
    },
  })
}

export function useCriarPrestacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ObraPrestacaoContas>) => {
      const { data, error } = await supabase
        .from('obr_prestacao_contas')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ObraPrestacaoContas
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-prestacao'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useAprovarPrestacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      aprovador_id,
    }: {
      id: string
      aprovador_id: string
    }) => {
      const { error } = await supabase
        .from('obr_prestacao_contas')
        .update({
          status: 'aprovada',
          aprovador_id,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-prestacao'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useRejeitarPrestacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      aprovador_id,
      motivo_rejeicao,
    }: {
      id: string
      aprovador_id: string
      motivo_rejeicao: string
    }) => {
      const { error } = await supabase
        .from('obr_prestacao_contas')
        .update({
          status: 'rejeitada',
          aprovador_id,
          aprovado_em: new Date().toISOString(),
          motivo_rejeicao,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-prestacao'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

// ── Equipes ──────────────────────────────────────────────────────────────────

export function useEquipes(obraId?: string) {
  return useQuery<ObraEquipe[]>({
    queryKey: ['obr-equipes', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obr_equipes')
        .select('*, frente:obr_frentes!frente_id(id, nome)')
        .eq('obra_id', obraId!)
        .order('colaborador_nome')
      if (error) return []
      return (data ?? []) as ObraEquipe[]
    },
  })
}

// ── Mobilizacoes ─────────────────────────────────────────────────────────────

export function useMobilizacoes(filters?: { obra_id?: string }) {
  return useQuery<ObraMobilizacao[]>({
    queryKey: ['obr-mobilizacoes', filters],
    queryFn: async () => {
      let q = supabase
        .from('obr_mobilizacoes')
        .select('*, obra:sys_obras!obra_id(id, nome)')
        .order('created_at', { ascending: false })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ObraMobilizacao[]
    },
  })
}

export function useCriarMobilizacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ObraMobilizacao>) => {
      const { data, error } = await supabase
        .from('obr_mobilizacoes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ObraMobilizacao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-mobilizacoes'] })
    },
  })
}

// ── Planejamento de Equipe (integrado EGP) ──────────────────────────────────

export function usePlanejamentoEquipe(filters?: {
  obra_id?: string
  status?: string
  categoria?: string
  papel?: PapelEquipe
}) {
  return useQuery<ObraPlanejamentoEquipe[]>({
    queryKey: ['obr-plan-equipe', filters],
    queryFn: async () => {
      let q = supabase
        .from('obr_planejamento_equipe')
        .select('*, obra:sys_obras!obra_id(id, nome), portfolio:pmo_portfolio!portfolio_id(id, nome_obra, numero_osc), tarefa:pmo_tarefas!tarefa_id(id, nome), colaborador:rh_colaboradores!colaborador_id(id, nome, cargo, foto_url, departamento)')
        .order('data_inicio', { ascending: true })
      if (filters?.obra_id) q = q.eq('obra_id', filters.obra_id)
      if (filters?.status) q = q.eq('status', filters.status)
      if (filters?.categoria) q = q.eq('categoria', filters.categoria)
      if (filters?.papel) q = q.eq('papel', filters.papel)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ObraPlanejamentoEquipe[]
    },
  })
}

// Colaboradores ativos do RH (headcount) — pessoas alocaveis na Equipe.
export function useColaboradoresAtivos() {
  return useQuery<ColaboradorAtivo[]>({
    queryKey: ['rh-colaboradores-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rh_colaboradores')
        .select('id, nome, cargo, departamento, setor, base_id, foto_url, tipo_contrato, base:est_bases!base_id(nome)')
        .eq('ativo', true)
        .order('nome')
      if (error) return []
      return ((data ?? []) as any[]).map(c => ({
        id: c.id,
        nome: c.nome,
        cargo: c.cargo ?? undefined,
        departamento: c.departamento ?? undefined,
        setor: c.setor ?? undefined,
        base_id: c.base_id ?? undefined,
        base_nome: c.base?.nome ?? undefined,
        foto_url: c.foto_url ?? undefined,
        tipo_contrato: c.tipo_contrato ?? undefined,
        papel_sugerido: papelSugerido(c.cargo, c.departamento),
      })) as ColaboradorAtivo[]
    },
    staleTime: 300_000,
  })
}

export function useExcluirPlanEquipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // Membros do Time desse lider voltam ao pool (lider_id -> null via FK ON DELETE SET NULL).
      const { error } = await supabase.from('obr_planejamento_equipe').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-plan-equipe'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

// Move uma lideranca para outra obra. Se for encarregado, leva o Time junto
// (cascade no obra_id de todas as alocacoes com lider_id = ele).
export function useMoverLiderTime() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ alocacaoId, obraId }: { alocacaoId: string; obraId: string }) => {
      const nowIso = new Date().toISOString()
      const { error: e1 } = await supabase
        .from('obr_planejamento_equipe')
        .update({ obra_id: obraId, updated_at: nowIso })
        .eq('id', alocacaoId)
      if (e1) throw e1
      // Time vai junto
      const { error: e2 } = await supabase
        .from('obr_planejamento_equipe')
        .update({ obra_id: obraId, updated_at: nowIso })
        .eq('lider_id', alocacaoId)
      if (e2) throw e2
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-plan-equipe'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useCriarPlanEquipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ObraPlanejamentoEquipe>) => {
      const { data, error } = await supabase
        .from('obr_planejamento_equipe')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data as ObraPlanejamentoEquipe
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-plan-equipe'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

export function useAtualizarPlanEquipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<ObraPlanejamentoEquipe> & { id: string }) => {
      const { error } = await supabase
        .from('obr_planejamento_equipe')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['obr-plan-equipe'] })
      qc.invalidateQueries({ queryKey: ['obr-kpis'] })
    },
  })
}

// ── KPIs (for ObrasHome dashboard) ───────────────────────────────────────────

export interface ObrasKPIs {
  apontamentos_hoje: number
  rdos_pendentes: number
  adiantamentos_abertos: number
  prestacoes_pendentes: number
}

export function useObrasKPIs() {
  return useQuery<ObrasKPIs>({
    queryKey: ['obr-kpis'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0]

      const [apontRes, rdoRes, adiantRes, prestRes] = await Promise.all([
        supabase
          .from('obr_apontamentos')
          .select('id', { count: 'exact' })
          .eq('data_apontamento', hoje),
        supabase
          .from('obr_rdo')
          .select('id', { count: 'exact' })
          .eq('status', 'rascunho'),
        supabase
          .from('obr_adiantamentos')
          .select('id', { count: 'exact' })
          .in('status', ['solicitado', 'aprovado', 'parcial']),
        supabase
          .from('obr_prestacao_contas')
          .select('id', { count: 'exact' })
          .in('status', ['pendente', 'em_analise']),
      ])

      return {
        apontamentos_hoje: apontRes.count ?? 0,
        rdos_pendentes: rdoRes.count ?? 0,
        adiantamentos_abertos: adiantRes.count ?? 0,
        prestacoes_pendentes: prestRes.count ?? 0,
      }
    },
    refetchInterval: 60_000,
  })
}
