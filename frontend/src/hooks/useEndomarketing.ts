import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { IdentidadeVisual, Comunicado } from '../types/rh'

const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

// ── Identidade Visual ─────────────────────────────
export function useIdentidadeVisual() {
  return useQuery<IdentidadeVisual | null>({
    queryKey: ['identidade-visual'],
    queryFn: async () => {
      const { data } = await supabase.from('rh_identidade_visual').select('*').limit(1).single()
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useSalvarIdentidadeVisual() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<IdentidadeVisual>) => {
      const { data: existing } = await supabase.from('rh_identidade_visual').select('id').limit(1).single()
      if (existing) {
        const { data, error } = await supabase.from('rh_identidade_visual').update(payload).eq('id', existing.id).select().single()
        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase.from('rh_identidade_visual').insert(payload).select().single()
        if (error) throw error
        return data
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identidade-visual'] }),
  })
}

export function useUploadLogo() {
  return useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop() || 'png'
      const path = `identidade-visual/logo-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('mural-banners').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('mural-banners').getPublicUrl(path)
      return publicUrl
    },
  })
}

// ── Comunicados ───────────────────────────────────
export function useComunicados(tipo?: string) {
  return useQuery<Comunicado[]>({
    queryKey: ['comunicados', tipo],
    queryFn: async () => {
      let q = supabase.from('rh_comunicados').select('*').order('created_at', { ascending: false })
      if (tipo) q = q.eq('tipo', tipo)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useSalvarComunicado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Comunicado>) => {
      const { data, error } = await supabase.from('rh_comunicados').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comunicados'] }),
  })
}

export function useExcluirComunicado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rh_comunicados').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comunicados'] }),
  })
}

export function useUploadComunicadoImagem() {
  return useMutation({
    mutationFn: async (file: Blob) => {
      const path = `comunicados/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`
      const { error } = await supabase.storage.from('mural-banners').upload(path, file, { upsert: true, contentType: 'image/png' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('mural-banners').getPublicUrl(path)
      return publicUrl
    },
  })
}

// ── Geração de Imagem com IA ──────────────────────
export interface GerarImagemIAPayload {
  tipo: string
  tipo_label: string
  formato: string
  formato_label: string
  dimensoes: string
  instrucoes: string
  identidade: {
    nome_empresa: string
    slogan: string | null
    cor_primaria: string
    cor_secundaria: string
    logo_url: string | null
  }
}

export interface GerarImagemIAResponse {
  imagem_url: string
  instrucoes?: string
  footer_text?: string
  cor_primaria?: string
  cor_secundaria?: string
}

export function useGerarImagemIA() {
  return useMutation<GerarImagemIAResponse, Error, GerarImagemIAPayload>({
    mutationFn: async (payload) => {
      const res = await fetch(`${N8N_BASE}/endomarketing/gerar-imagem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`)
      const data = await res.json()
      return Array.isArray(data) ? data[0] : data
    },
  })
}

// ── Geração de Texto com IA ───────────────────────
export interface GerarComunicadoPayload {
  tipo: string
  formato: string
  input_usuario: string
  identidade_visual?: Partial<IdentidadeVisual>
}

export interface GerarComunicadoResponse {
  titulo: string
  subtitulo: string
  corpo: string
  destaques: string[]
  rodape: string
}

export function useGerarComunicadoIA() {
  return useMutation<GerarComunicadoResponse, Error, GerarComunicadoPayload>({
    mutationFn: async (payload) => {
      const res = await fetch(`${N8N_BASE}/endomarketing/gerar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Erro ${res.status}`)
      const data = await res.json()
      return Array.isArray(data) ? data[0] : data
    },
  })
}
