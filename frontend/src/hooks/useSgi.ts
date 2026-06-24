import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { SgiDocumento, StatusDocumento, TipoDocumento, CriarDocumentoPayload } from '../types/sgi'

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
      const { data } = await supabase.from('sgi_documentos').select('id, status, proxima_revisao')
      const docs = (data ?? []) as { status: string; proxima_revisao: string | null }[]
      const today = new Date().toISOString().split('T')[0]
      const lim30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
      return {
        total: docs.length,
        vigentes: docs.filter(d => d.status === 'vigente').length,
        emFluxo: docs.filter(d => ['rascunho', 'em_revisao', 'em_aprovacao'].includes(d.status)).length,
        obsoletos: docs.filter(d => d.status === 'obsoleto').length,
        revisaoVencendo: docs.filter(d => d.proxima_revisao && d.proxima_revisao >= today && d.proxima_revisao <= lim30).length,
        revisaoVencida: docs.filter(d => d.proxima_revisao && d.proxima_revisao < today && d.status === 'vigente').length,
      }
    },
  })
}
