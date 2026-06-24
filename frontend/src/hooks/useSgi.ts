import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  SgiDocumento, StatusDocumento, TipoDocumento, CriarDocumentoPayload,
  SgiRegistro, SgiAcao, SgiObjetivo, SgiMeta, SgiCheckin,
} from '../types/sgi'

const QK = {
  documentos: (f?: unknown) => ['sgi_documentos', f],
  documento:  (id: string)  => ['sgi_documento', id],
}

// ── Documentos (Padronização) ─────────────────────────────────────────────────
export function useDocumentos(filtros?: { status?: StatusDocumento; tipo?: TipoDocumento }) {
  return useQuery({
    queryKey: QK.documentos(filtros),
    queryFn: async () => {
      let q = supabase.from('sgi_documentos').select('*').order('created_at', { ascending: false })
      if (filtros?.status) q = q.eq('status', filtros.status)
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as SgiDocumento[]
    },
  })
}

export function useCriarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CriarDocumentoPayload) => {
      const { data: codigo } = await supabase.rpc('sgi_proximo_codigo_documento', { p_tipo: payload.tipo })
      const { data, error } = await supabase
        .from('sgi_documentos')
        .insert({ ...payload, codigo: codigo ?? null })
        .select()
        .single()
      if (error) throw error
      return data as SgiDocumento
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sgi_documentos'] }),
  })
}

export function useAtualizarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<SgiDocumento> & { id: string }) => {
      const { data, error } = await supabase
        .from('sgi_documentos')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as SgiDocumento
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['sgi_documentos'] })
      qc.invalidateQueries({ queryKey: ['sgi_documento', d.id] })
    },
  })
}

// ── KPIs do Painel ────────────────────────────────────────────────────────────
export function useSgiKPIs() {
  return useQuery({
    queryKey: ['sgi_kpis'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const lim30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      const [docsR, regR, acoesR] = await Promise.all([
        supabase.from('sgi_documentos').select('id, status, proxima_revisao'),
        supabase.from('sgi_registros').select('id, status_pdca'),
        supabase.from('sgi_acoes').select('id, status, prazo'),
      ])
      const docs = (docsR.data ?? []) as { status: string; proxima_revisao: string | null }[]
      const regs = (regR.data ?? []) as { status_pdca: string }[]
      const acoes = (acoesR.data ?? []) as { status: string; prazo: string | null }[]
      return {
        total: docs.length,
        vigentes: docs.filter(d => d.status === 'vigente').length,
        emFluxo: docs.filter(d => ['rascunho', 'em_revisao', 'em_aprovacao'].includes(d.status)).length,
        obsoletos: docs.filter(d => d.status === 'obsoleto').length,
        revisaoVencendo: docs.filter(d => d.proxima_revisao && d.proxima_revisao >= today && d.proxima_revisao <= lim30).length,
        revisaoVencida: docs.filter(d => d.proxima_revisao && d.proxima_revisao < today && d.status === 'vigente').length,
        ncsAbertas: regs.filter(r => r.status_pdca !== 'encerrado').length,
        acoesAtrasadas: acoes.filter(a => a.prazo && a.prazo < today && (a.status === 'aberta' || a.status === 'em_execucao')).length,
      }
    },
  })
}

// ── Melhoria Contínua (registros / ações) ─────────────────────────────────────
export function useRegistros(filtros?: { status_pdca?: string }) {
  return useQuery({
    queryKey: ['sgi_registros', filtros],
    queryFn: async () => {
      let q = supabase.from('sgi_registros').select('*').order('created_at', { ascending: false })
      if (filtros?.status_pdca) q = q.eq('status_pdca', filtros.status_pdca)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as SgiRegistro[]
    },
  })
}
export function useCriarRegistro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SgiRegistro>) => {
      const { data: codigo } = await supabase.rpc('sgi_proximo_codigo_registro')
      const { data, error } = await supabase.from('sgi_registros').insert({ ...payload, codigo: codigo ?? null }).select().single()
      if (error) throw error
      return data as SgiRegistro
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sgi_registros'] }); qc.invalidateQueries({ queryKey: ['sgi_kpis'] }) },
  })
}
export function useAtualizarRegistro() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<SgiRegistro> & { id: string }) => {
      const { data, error } = await supabase.from('sgi_registros').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data as SgiRegistro
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sgi_registros'] }); qc.invalidateQueries({ queryKey: ['sgi_kpis'] }) },
  })
}
export function useAcoes(filtros?: { origem_id?: string }) {
  return useQuery({
    queryKey: ['sgi_acoes', filtros],
    queryFn: async () => {
      let q = supabase.from('sgi_acoes').select('*').order('created_at', { ascending: false })
      if (filtros?.origem_id) q = q.eq('origem_id', filtros.origem_id)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as SgiAcao[]
    },
  })
}
export function useCriarAcao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SgiAcao>) => {
      const { data, error } = await supabase.from('sgi_acoes').insert(payload).select().single()
      if (error) throw error
      return data as SgiAcao
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sgi_acoes'] }); qc.invalidateQueries({ queryKey: ['sgi_kpis'] }) },
  })
}
export function useAtualizarAcao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<SgiAcao> & { id: string }) => {
      const { data, error } = await supabase.from('sgi_acoes').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select().single()
      if (error) throw error
      return data as SgiAcao
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sgi_acoes'] }); qc.invalidateQueries({ queryKey: ['sgi_kpis'] }) },
  })
}

// ── Objetivos e Metas ─────────────────────────────────────────────────────────
export function useObjetivos(filtros?: { ano?: number }) {
  return useQuery({
    queryKey: ['sgi_objetivos', filtros],
    queryFn: async () => {
      let q = supabase.from('sgi_objetivos').select('*, metas:sgi_metas(*, checkins:sgi_metas_checkin(*))').order('created_at', { ascending: false })
      if (filtros?.ano) q = q.eq('ano', filtros.ano)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as (SgiObjetivo & { metas: (SgiMeta & { checkins: SgiCheckin[] })[] })[]
    },
  })
}
export function useCriarObjetivo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SgiObjetivo>) => {
      const { data, error } = await supabase.from('sgi_objetivos').insert(payload).select().single()
      if (error) throw error
      return data as SgiObjetivo
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sgi_objetivos'] }),
  })
}
export function useCriarMeta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<SgiMeta>) => {
      const { data, error } = await supabase.from('sgi_metas').insert(payload).select().single()
      if (error) throw error
      return data as SgiMeta
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sgi_objetivos'] }),
  })
}
export function useCheckins(metaId?: string) {
  return useQuery({
    queryKey: ['sgi_checkins', metaId],
    enabled: !!metaId,
    queryFn: async () => {
      const { data, error } = await supabase.from('sgi_metas_checkin').select('*').eq('meta_id', metaId!).order('competencia', { ascending: false })
      if (error) throw error
      return (data ?? []) as SgiCheckin[]
    },
  })
}
export function useLancarCheckin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ metaId, competencia, realizado, observacao }: { metaId: string; competencia: string; realizado: number; observacao?: string }) => {
      const { data, error } = await supabase.rpc('sgi_meta_checkin_lancar', { p_meta_id: metaId, p_competencia: competencia, p_realizado: realizado, p_observacao: observacao ?? null })
      if (error) throw error
      return data as { ok: boolean; farol?: string; registro_criado?: string | null }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sgi_checkins'] })
      qc.invalidateQueries({ queryKey: ['sgi_objetivos'] })
      qc.invalidateQueries({ queryKey: ['sgi_registros'] })
      qc.invalidateQueries({ queryKey: ['sgi_kpis'] })
    },
  })
}

// ── Ciência (Padronização → Missões do Portal) ────────────────────────────────
export function usePublicarDocumento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (documentoId: string) => {
      const { data, error } = await supabase.rpc('sgi_documento_publicar', { p_documento_id: documentoId })
      if (error) throw error
      return data as { ok: boolean; missoes_criadas?: number; colaboradores_ativos?: number; requer_ciencia?: boolean; erro?: string }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sgi_documentos'] })
      qc.invalidateQueries({ queryKey: ['sgi_adesao'] })
      qc.invalidateQueries({ queryKey: ['sgi_kpis'] })
    },
  })
}
export function useAdesaoDocumento(documentoId?: string) {
  return useQuery({
    queryKey: ['sgi_adesao', documentoId],
    enabled: !!documentoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('sgi_documento_adesao', { p_documento_id: documentoId })
      if (error) throw error
      return (data ?? []) as { colaborador_id: string; nome: string | null; cargo: string | null; status: string; concluida_em: string | null }[]
    },
  })
}
