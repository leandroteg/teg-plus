// Inventário de ativos de TI (ti_ativos). Enums type/status: armazenados em
// minúsculo no banco, expostos em MAIÚSCULO para as telas (toUpperCase/toLowerCase).
import { supabase } from './supabase'
import { toAsset } from './mappers'
import { STATUS_FROM_DB, PRIORITY_FROM_DB, formatCode } from './enums'
import type { Asset, AssetDetail } from './shapes'

export async function listAssets(): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('ti_ativos')
    .select('*')
    .order('tipo', { ascending: true })
    .order('responsavel_nome', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map(toAsset)
}

export async function getAsset(id: string): Promise<AssetDetail | null> {
  const { data, error } = await supabase
    .from('ti_ativos')
    .select('*, chamados:ti_chamados!ti_chamados_ativo_id_fkey(id, numero, titulo, status, prioridade, created_at)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const tickets = (((data as any).chamados ?? []) as any[])
    .map((t) => ({
      id: t.id,
      number: t.numero,
      code: formatCode(t.numero),
      title: t.titulo,
      status: STATUS_FROM_DB[t.status as keyof typeof STATUS_FROM_DB] ?? 'ABERTO',
      priority: PRIORITY_FROM_DB[t.prioridade as keyof typeof PRIORITY_FROM_DB] ?? 'MEDIA',
      createdAt: t.created_at,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { ...toAsset(data), tickets }
}

export interface AssetInput {
  type?: string
  tag?: string
  model?: string
  serial?: string
  status?: string
  holderName?: string
  holderCpf?: string
  holderCargo?: string
  holderEmail?: string
  phoneLine?: string
  previousUser?: string
  mdm?: string
  matriz?: string
  location?: string
  notes?: string
  active?: boolean
}

const clean = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

function toDbAsset(input: AssetInput): Record<string, unknown> {
  const db: Record<string, unknown> = {}
  if (input.type !== undefined) db.tipo = String(input.type).toLowerCase()
  if (input.status !== undefined) db.status = String(input.status).toLowerCase()
  if (input.tag !== undefined) db.patrimonio = clean(input.tag)
  if (input.model !== undefined) db.modelo = clean(input.model)
  if (input.serial !== undefined) db.serial = clean(input.serial)
  if (input.holderName !== undefined) db.responsavel_nome = clean(input.holderName)
  if (input.holderCpf !== undefined) db.responsavel_cpf = clean(input.holderCpf)
  if (input.holderCargo !== undefined) db.responsavel_cargo = clean(input.holderCargo)
  if (input.holderEmail !== undefined) db.responsavel_email = clean(input.holderEmail)
  if (input.phoneLine !== undefined) db.linha_telefone = clean(input.phoneLine)
  if (input.previousUser !== undefined) db.usuario_anterior = clean(input.previousUser)
  if (input.mdm !== undefined) db.mdm = clean(input.mdm)
  if (input.matriz !== undefined) db.matriz = clean(input.matriz)
  if (input.location !== undefined) db.localizacao = clean(input.location)
  if (input.notes !== undefined) db.observacoes = clean(input.notes)
  if (input.active !== undefined) db.ativo = input.active
  return db
}

export async function createAsset(input: AssetInput): Promise<{ id: string }> {
  const db = toDbAsset(input)
  if (!db.tipo) db.tipo = 'outro'
  if (!db.status) db.status = 'em_uso'
  const { data, error } = await supabase.from('ti_ativos').insert(db).select('id').single()
  if (error) throw error
  return { id: data.id }
}

export async function updateAsset(id: string, input: AssetInput): Promise<void> {
  const db = toDbAsset(input)
  if (Object.keys(db).length === 0) return
  const { error } = await supabase.from('ti_ativos').update(db).eq('id', id)
  if (error) throw error
}
