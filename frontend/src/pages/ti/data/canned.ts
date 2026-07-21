// Respostas prontas (ti_respostas_prontas). Leitura no detalhe do chamado +
// CRUD na tela de Respostas.
import { supabase } from './supabase'
import type { CannedResponse } from './shapes'

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCanned(r: any): CannedResponse {
  return { id: r.id, title: r.titulo, body: r.corpo, active: r.ativo, sortOrder: r.ordem, createdAt: r.created_at }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const SELECT = 'id, titulo, corpo, ativo, ordem, created_at'

export async function listCanned(): Promise<CannedResponse[]> {
  const { data, error } = await supabase.from('ti_respostas_prontas').select(SELECT).eq('ativo', true).order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toCanned)
}

export async function listAllCanned(): Promise<CannedResponse[]> {
  const { data, error } = await supabase.from('ti_respostas_prontas').select(SELECT).order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toCanned)
}

export async function createCanned(input: { title: string; body: string }): Promise<void> {
  const { count } = await supabase.from('ti_respostas_prontas').select('id', { count: 'exact', head: true })
  const { error } = await supabase.from('ti_respostas_prontas').insert({ titulo: input.title, corpo: input.body, ordem: count ?? 0 })
  if (error) throw error
}

export async function updateCanned(id: string, patch: { title?: string; body?: string; active?: boolean }): Promise<void> {
  const db: Record<string, unknown> = {}
  if (patch.title !== undefined) db.titulo = patch.title
  if (patch.body !== undefined) db.corpo = patch.body
  if (patch.active !== undefined) db.ativo = patch.active
  if (!Object.keys(db).length) return
  const { error } = await supabase.from('ti_respostas_prontas').update(db).eq('id', id)
  if (error) throw error
}
