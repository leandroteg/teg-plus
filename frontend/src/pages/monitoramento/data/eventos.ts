// Eventos (mon_eventos). O worker on-prem insere via service-role; aqui só leitura
// + assinatura Realtime para alertas ao vivo.
import { supabase } from './supabase'
import type { MonEvento } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
const toEvento = (r: any): MonEvento => ({
  id: r.id,
  cameraId: r.camera_id ?? null,
  cameraNome: (Array.isArray(r.camera) ? r.camera[0]?.nome : r.camera?.nome) ?? null,
  canal: r.canal ?? null,
  tipo: r.tipo,
  alvo: r.alvo ?? null,
  estado: r.estado ?? null,
  snapshotPath: r.snapshot_path ?? null,
  ocorreuEm: r.ocorreu_em,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listEventos(limit = 100): Promise<MonEvento[]> {
  const { data, error } = await supabase
    .from('mon_eventos')
    .select('id, camera_id, canal, tipo, alvo, estado, snapshot_path, ocorreu_em, camera:mon_cameras!mon_eventos_camera_id_fkey(nome)')
    .order('ocorreu_em', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map(toEvento)
}

/** Assina novos eventos (Realtime). Retorna a função de limpeza. */
export function subscribeEventos(onInsert: () => void): () => void {
  const ch = supabase
    .channel('mon-eventos')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mon_eventos' }, onInsert)
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}

export async function snapshotUrl(path: string): Promise<string> {
  const { data } = await supabase.storage.from('mon-evidencias').createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? ''
}
