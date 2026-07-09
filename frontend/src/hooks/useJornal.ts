// ─────────────────────────────────────────────────────────────────────────────
// hooks/useJornal.ts — Jornal TEG: edições (PDF) fatiadas em cards para o Mural TEG
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export interface JornalEdicao {
  id: string
  titulo: string
  mes: number | null
  ano: number | null
  pdf_url: string | null
  capa_url: string | null
  publicado: boolean
  criado_por: string | null
  created_at: string
  updated_at: string
}

export interface JornalCard {
  id: string
  edicao_id: string
  pagina: number
  ordem: number
  titulo: string | null
  imagem_url: string
  largura: number | null
  altura: number | null
  created_at: string
}

// ── Edições ─────────────────────────────────────────────────────────────────
export function useEdicoes() {
  return useQuery<JornalEdicao[]>({
    queryKey: ['jornal-edicoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jornal_edicoes')
        .select('*')
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as JornalEdicao[]
    },
  })
}

export function useEdicaoCards(edicaoId?: string) {
  return useQuery<JornalCard[]>({
    queryKey: ['jornal-cards', edicaoId],
    enabled: !!edicaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jornal_cards')
        .select('*')
        .eq('edicao_id', edicaoId!)
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as JornalCard[]
    },
  })
}

export function useCriarEdicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<JornalEdicao>): Promise<JornalEdicao> => {
      const { data, error } = await supabase.from('jornal_edicoes').insert(payload).select().single()
      if (error) throw error
      return data as JornalEdicao
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jornal-edicoes'] }),
  })
}

export function useAtualizarEdicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<JornalEdicao> & { id: string }) => {
      const { error } = await supabase.from('jornal_edicoes').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jornal-edicoes'] }),
  })
}

export function useExcluirEdicao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('jornal_edicoes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jornal-edicoes'] })
      qc.invalidateQueries({ queryKey: ['jornal-cards'] })
    },
  })
}

// ── Cards ───────────────────────────────────────────────────────────────────
export function useSalvarCards() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (cards: Omit<JornalCard, 'id' | 'created_at'>[]) => {
      if (!cards.length) return
      const { error } = await supabase.from('jornal_cards').insert(cards)
      if (error) throw error
    },
    onSuccess: (_d, cards) => {
      qc.invalidateQueries({ queryKey: ['jornal-cards', cards[0]?.edicao_id] })
    },
  })
}

export function useExcluirCard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (card: JornalCard) => {
      const { error } = await supabase.from('jornal_cards').delete().eq('id', card.id)
      if (error) throw error
      return card
    },
    onSuccess: (card) => qc.invalidateQueries({ queryKey: ['jornal-cards', card.edicao_id] }),
  })
}

// ── Mural do colaborador: cards da edição publicada mais recente ──────────────
export function useMuralJornalCards() {
  return useQuery<{ edicao: JornalEdicao | null; cards: JornalCard[] }>({
    queryKey: ['mural-jornal-cards'],
    queryFn: async () => {
      const { data: ed } = await supabase
        .from('jornal_edicoes')
        .select('*')
        .eq('publicado', true)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!ed) return { edicao: null, cards: [] }
      const { data: cards } = await supabase
        .from('jornal_cards')
        .select('*')
        .eq('edicao_id', (ed as JornalEdicao).id)
        .order('ordem', { ascending: true })
      return { edicao: ed as JornalEdicao, cards: (cards ?? []) as JornalCard[] }
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ── Detecção automática de blocos (Gemini Vision via n8n) ─────────────────────
const N8N_BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

export interface BlocoDetectado { titulo: string; x: number; y: number; w: number; h: number }

/** Envia a página (PNG base64) ao workflow de visão e recebe os retângulos dos blocos. */
export async function detectarBlocosJornal(pagina: number, imagemBase64: string): Promise<BlocoDetectado[]> {
  const res = await fetch(`${N8N_BASE}/endomarketing/jornal-blocos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pagina, imagem_base64: imagemBase64 }),
  })
  if (!res.ok) throw new Error(`Erro ${res.status} ao detectar blocos`)
  const data = await res.json()
  const arr = Array.isArray(data) ? data : (data?.blocos ?? [])
  return (arr as BlocoDetectado[]).filter(b => typeof b?.x === 'number' && typeof b?.w === 'number')
}

// ── Storage (reaproveita o bucket mural-banners) ──────────────────────────────
export async function uploadJornalArquivo(file: Blob, kind: 'pdf' | 'card' | 'capa', ext = 'png'): Promise<string> {
  const path = `jornal/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const contentType = kind === 'pdf' ? 'application/pdf' : 'image/png'
  const { error } = await supabase.storage.from('mural-banners').upload(path, file, { upsert: true, contentType })
  if (error) throw error
  const { data } = supabase.storage.from('mural-banners').getPublicUrl(path)
  return data.publicUrl
}
