// Metadados do Help Desk: categorias, setores, SLA e campos personalizados.
// Leitura (telas de chamados) + CRUD admin (tela de Configurações).
import { supabase } from './supabase'
import { toCategory, toSector } from './mappers'
import { PRIORITY_FROM_DB, PRIORITY_TO_DB, type PriorityEn } from './enums'
import type { Category, Sector, CustomField } from './shapes'

export type NamedTable = 'ti_categorias' | 'ti_setores'

// ─── Categorias / Setores ────────────────────────────────────────────────────
export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('ti_categorias').select('id, nome, ativo, ordem').eq('ativo', true)
    .order('ordem', { ascending: true }).order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toCategory)
}

export async function listSectors(): Promise<Sector[]> {
  const { data, error } = await supabase
    .from('ti_setores').select('id, nome, ativo, ordem').eq('ativo', true)
    .order('ordem', { ascending: true }).order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toSector)
}

/** Inclui inativos (admin). */
export async function listAllNamed(table: NamedTable): Promise<Category[]> {
  const { data, error } = await supabase
    .from(table).select('id, nome, ativo, ordem')
    .order('ordem', { ascending: true }).order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []).map(toCategory)
}

export async function createNamed(table: NamedTable, name: string): Promise<void> {
  const { count } = await supabase.from(table).select('id', { count: 'exact', head: true })
  const { error } = await supabase.from(table).insert({ nome: name, ordem: count ?? 0 })
  if (error) throw error
}

export async function updateNamed(table: NamedTable, id: string, patch: { name?: string; active?: boolean }): Promise<void> {
  const db: Record<string, unknown> = {}
  if (patch.name !== undefined) db.nome = patch.name
  if (patch.active !== undefined) db.ativo = patch.active
  if (!Object.keys(db).length) return
  const { error } = await supabase.from(table).update(db).eq('id', id)
  if (error) throw error
}

// ─── SLA (ti_sla_politicas) — prioridade minúscula no banco, EN nas telas ─────
export async function getSla(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('ti_sla_politicas').select('prioridade, horas')
  if (error) throw error
  const out: Record<string, number> = {}
  for (const r of (data ?? []) as { prioridade: string; horas: number }[]) {
    const en = PRIORITY_FROM_DB[r.prioridade as keyof typeof PRIORITY_FROM_DB]
    if (en) out[en] = r.horas
  }
  return out
}

export async function updateSla(vals: Record<string, number>): Promise<void> {
  const rows = Object.entries(vals)
    .filter(([, h]) => h != null && !Number.isNaN(h) && h > 0)
    .map(([en, horas]) => ({ prioridade: PRIORITY_TO_DB[en as PriorityEn], horas }))
  if (!rows.length) return
  const { error } = await supabase.from('ti_sla_politicas').upsert(rows, { onConflict: 'prioridade' })
  if (error) throw error
}

// ─── Campos personalizados ───────────────────────────────────────────────────
function toFieldType(t: unknown): CustomField['type'] {
  const u = String(t ?? '').toUpperCase()
  if (u.startsWith('NUM')) return 'NUMBER'
  if (u.startsWith('SEL')) return 'SELECT'
  if (u.startsWith('DAT')) return 'DATE'
  return 'TEXT'
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapField(f: any): CustomField {
  return {
    id: f.id,
    categoryId: f.categoria_id,
    label: f.label,
    type: toFieldType(f.tipo),
    options: Array.isArray(f.opcoes) ? (f.opcoes as string[]) : null,
    required: f.obrigatorio,
    sortOrder: f.ordem,
    active: f.ativo,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const FIELD_SELECT = 'id, categoria_id, label, tipo, opcoes, obrigatorio, ordem, ativo'

export async function listCustomFields(categoryId: string): Promise<CustomField[]> {
  const { data, error } = await supabase
    .from('ti_campos_personalizados').select(FIELD_SELECT)
    .eq('categoria_id', categoryId).eq('ativo', true).order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapField)
}

/** Inclui inativos (admin). */
export async function listAllCustomFields(categoryId: string): Promise<CustomField[]> {
  const { data, error } = await supabase
    .from('ti_campos_personalizados').select(FIELD_SELECT)
    .eq('categoria_id', categoryId).order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapField)
}

export async function createCustomField(input: { categoryId: string; label: string; type: string; required: boolean; options?: string[] }): Promise<void> {
  const { count } = await supabase.from('ti_campos_personalizados').select('id', { count: 'exact', head: true }).eq('categoria_id', input.categoryId)
  const { error } = await supabase.from('ti_campos_personalizados').insert({
    categoria_id: input.categoryId,
    label: input.label,
    tipo: input.type.toLowerCase(),
    obrigatorio: input.required,
    opcoes: input.options && input.options.length ? input.options : null,
    ordem: count ?? 0,
  })
  if (error) throw error
}

export async function updateCustomField(id: string, patch: { active?: boolean; label?: string; type?: string; required?: boolean; options?: string[] }): Promise<void> {
  const db: Record<string, unknown> = {}
  if (patch.active !== undefined) db.ativo = patch.active
  if (patch.label !== undefined) db.label = patch.label
  if (patch.type !== undefined) db.tipo = patch.type.toLowerCase()
  if (patch.required !== undefined) db.obrigatorio = patch.required
  if (patch.options !== undefined) db.opcoes = patch.options && patch.options.length ? patch.options : null
  if (!Object.keys(db).length) return
  const { error } = await supabase.from('ti_campos_personalizados').update(db).eq('id', id)
  if (error) throw error
}
