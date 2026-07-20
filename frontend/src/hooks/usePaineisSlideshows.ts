import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

// Um slide = módulo (key) + opcional sub-painel (tab) + label exibido.
export interface SlideItem { key: string; tab?: string; label?: string }
export interface SlideShow {
  id: string
  nome: string
  intervalo_sec: number
  slides: SlideItem[]
  ordem: number
  enviar_diretoria: boolean
  criado_por_nome: string | null
  created_at: string
  updated_at: string
}

const QK = ['paineis_slideshows']

export function useSlideShows() {
  return useQuery<SlideShow[]>({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await supabase.from('paineis_slideshows')
        .select('*').order('ordem', { ascending: true }).order('created_at', { ascending: true })
      if (error) return []
      return (data ?? []).map(r => ({ ...r, slides: Array.isArray(r.slides) ? r.slides : [] })) as SlideShow[]
    },
  })
}

export function useCriarSlideShow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { nome: string; intervalo_sec?: number; slides?: SlideItem[]; criado_por_nome?: string | null }) => {
      const { data, error } = await supabase.from('paineis_slideshows')
        .insert({ nome: p.nome, intervalo_sec: p.intervalo_sec ?? 20, slides: p.slides ?? [], criado_por_nome: p.criado_por_nome ?? null })
        .select().single()
      if (error) throw error
      return data as SlideShow
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })
}

export function useAtualizarSlideShow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<SlideShow, 'nome' | 'intervalo_sec' | 'slides' | 'ordem'>>) => {
      const { error } = await supabase.from('paineis_slideshows')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })
}

export function useRemoverSlideShow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('paineis_slideshows').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })
}

// Define QUAL slide show é o enviado à diretoria (exclusivo: liga um, desliga os outros).
export function useDefinirEmailDiretoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('paineis_slideshows').update({ enviar_diretoria: false }).neq('id', id)
      const { error } = await supabase.from('paineis_slideshows').update({ enviar_diretoria: true, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })
}
