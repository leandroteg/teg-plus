// Câmeras (mon_cameras) + config do gateway (mon_config). Supabase-nativo.
import { supabase } from './supabase'
import type { Camera } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
const toCamera = (r: any): Camera => ({
  id: r.id,
  nome: r.nome,
  local: r.local ?? null,
  canal: r.canal,
  nvrNome: r.nvr_nome ?? null,
  streamKey: r.stream_key ?? null,
  ptz: r.ptz,
  ordem: r.ordem ?? 0,
  ativo: r.ativo,
  observacoes: r.observacoes ?? null,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listCameras(all = false): Promise<Camera[]> {
  let query = supabase.from('mon_cameras').select('*').order('ordem', { ascending: true }).order('nome', { ascending: true })
  if (!all) query = query.eq('ativo', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toCamera)
}

export interface CameraInput {
  nome: string
  local?: string | null
  canal: number
  nvrNome?: string | null
  streamKey?: string | null
  ptz?: boolean
  ativo?: boolean
  observacoes?: string | null
}

export async function createCamera(input: CameraInput): Promise<void> {
  const { count } = await supabase.from('mon_cameras').select('id', { count: 'exact', head: true })
  const { error } = await supabase.from('mon_cameras').insert({
    nome: input.nome,
    local: input.local ?? null,
    canal: input.canal,
    nvr_nome: input.nvrNome ?? null,
    stream_key: input.streamKey ?? null,
    ptz: input.ptz ?? false,
    ativo: input.ativo ?? true,
    observacoes: input.observacoes ?? null,
    ordem: count ?? 0,
  })
  if (error) throw error
}

export async function updateCamera(id: string, patch: Partial<CameraInput>): Promise<void> {
  const db: Record<string, unknown> = {}
  if (patch.nome !== undefined) db.nome = patch.nome
  if (patch.local !== undefined) db.local = patch.local
  if (patch.canal !== undefined) db.canal = patch.canal
  if (patch.nvrNome !== undefined) db.nvr_nome = patch.nvrNome
  if (patch.streamKey !== undefined) db.stream_key = patch.streamKey
  if (patch.ptz !== undefined) db.ptz = patch.ptz
  if (patch.ativo !== undefined) db.ativo = patch.ativo
  if (patch.observacoes !== undefined) db.observacoes = patch.observacoes
  db.updated_at = new Date().toISOString()
  const { error } = await supabase.from('mon_cameras').update(db).eq('id', id)
  if (error) throw error
}

export async function deleteCamera(id: string): Promise<void> {
  const { error } = await supabase.from('mon_cameras').delete().eq('id', id)
  if (error) throw error
}

// Config do gateway go2rtc (URL base pública do túnel HTTPS)
export async function getGo2rtcUrl(): Promise<string> {
  const { data, error } = await supabase.from('mon_config').select('go2rtc_url').eq('id', 1).maybeSingle()
  if (error) throw error
  return (data?.go2rtc_url ?? '').replace(/\/+$/, '')
}

export async function setGo2rtcUrl(url: string): Promise<void> {
  const { error } = await supabase.from('mon_config')
    .update({ go2rtc_url: url.trim() || null, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}
