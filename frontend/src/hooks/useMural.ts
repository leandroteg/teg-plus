// ─────────────────────────────────────────────────────────────────────────────
// hooks/useMural.ts — Mural de Recados e Comunicação Empresarial
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export type MuralTipo = 'fixa' | 'campanha'

export interface MuralBanner {
  id: string
  titulo: string
  subtitulo?: string
  imagem_url: string
  tipo: MuralTipo
  ativo: boolean
  ordem: number
  data_inicio?: string
  data_fim?: string
  cor_titulo?: string
  cor_subtitulo?: string
  criado_por?: string
  created_at: string
  updated_at: string
}

export type MuralBannerPayload = Omit<MuralBanner, 'id' | 'created_at' | 'updated_at' | 'criado_por'>

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBannerVigente(b: MuralBanner): boolean {
  if (!b.ativo) return false
  if (b.tipo === 'fixa') return true
  const today = new Date().toISOString().split('T')[0]
  const start = b.data_inicio ? b.data_inicio <= today : true
  const end   = b.data_fim   ? b.data_fim   >= today : true
  return start && end
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Banners ativos e vigentes — para o slideshow na tela inicial */
export function useBanners() {
  return useQuery({
    queryKey: ['mural-banners-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mural_banners')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      if (error) throw error
      return ((data ?? []) as MuralBanner[]).filter(isBannerVigente)
    },
    staleTime: 1000 * 60 * 5, // 5 min
  })
}

/** Todos os banners — para admin (inclui inativos e fora do período) */
export function useBannersAdmin() {
  return useQuery({
    queryKey: ['mural-banners-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mural_banners')
        .select('*')
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as MuralBanner[]
    },
  })
}

/** Criar ou atualizar banner */
export function useSalvarBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<MuralBanner>) => {
      const { id, created_at, updated_at, criado_por, ...rest } = payload as MuralBanner
      if (id && !id.startsWith('__')) {
        const { error } = await supabase
          .from('mural_banners')
          .update(rest)
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('mural_banners')
          .insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mural-banners-admin'] })
      qc.invalidateQueries({ queryKey: ['mural-banners-active'] })
    },
  })
}

/** Toggle ativo/inativo sem abrir modal */
export function useToggleBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('mural_banners')
        .update({ ativo })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mural-banners-admin'] })
      qc.invalidateQueries({ queryKey: ['mural-banners-active'] })
    },
  })
}

/** Excluir banner */
export function useExcluirBanner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('mural_banners').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mural-banners-admin'] })
      qc.invalidateQueries({ queryKey: ['mural-banners-active'] })
    },
  })
}

/** Upload de imagem para Supabase Storage (bucket: mural-banners) */
export function useUploadBannerImagem() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage
        .from('mural-banners')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('mural-banners').getPublicUrl(path)
      return data.publicUrl
    },
  })
}
