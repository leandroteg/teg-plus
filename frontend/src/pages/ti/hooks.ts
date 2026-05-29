import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Chamado, Comentario, StatusChamado, Anexo } from './types'
import { ANEXO_MAX_BYTES } from './types'
import { notificarNovoChamado, notificarNovoComentario, notificarMudancaStatus } from './email'

/**
 * "Sou atendente de TI?" — lê de ti_atendentes (gerenciada em /ti/admin).
 * Admin entra automaticamente. Cache 1x por mount.
 */
export function useIsAtendenteTi() {
  const { perfil, isAdmin } = useAuth()
  const [is, setIs] = useState(false)

  useEffect(() => {
    if (!perfil?.id) { setIs(false); return }
    if (isAdmin) { setIs(true); return }
    let cancelado = false
    supabase
      .from('ti_atendentes')
      .select('perfil_id')
      .eq('perfil_id', perfil.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelado) setIs(!!data) })
    return () => { cancelado = true }
  }, [perfil?.id, isAdmin])

  return is
}

export interface Atendente {
  perfil_id: string
  created_at: string
  perfil?: { nome: string; email: string } | null
}

export function useAtendentes() {
  const [items, setItems] = useState<Atendente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErro(null)
    const { data, error } = await supabase
      .from('ti_atendentes')
      .select('perfil_id, created_at, perfil:sys_perfis!ti_atendentes_perfil_id_fkey(nome,email)')
      .order('created_at', { ascending: true })
    if (error) setErro(error.message)
    setItems((data as unknown as Atendente[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])
  return { items, loading, erro, reload }
}

export async function adicionarAtendente(perfil_id: string, adicionado_por: string) {
  const { error } = await supabase.from('ti_atendentes').insert({ perfil_id, adicionado_por })
  if (error) throw error
}

export async function removerAtendente(perfil_id: string) {
  const { error } = await supabase.from('ti_atendentes').delete().eq('perfil_id', perfil_id)
  if (error) throw error
}

const CHAMADO_SELECT = `
  id, numero, solicitante_id, categoria, prioridade, titulo, descricao,
  status, atendente_id, created_at, updated_at, resolved_at, closed_at,
  criado_por_nome, atualizado_por_nome,
  solicitante:sys_perfis!ti_chamados_solicitante_id_fkey(nome,email),
  atendente:sys_perfis!ti_chamados_atendente_id_fkey(nome,email)
`

export function useMeusChamados() {
  const { perfil } = useAuth()
  const [items, setItems] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!perfil?.id) return
    setLoading(true)
    setErro(null)
    const { data, error } = await supabase
      .from('ti_chamados')
      .select(CHAMADO_SELECT)
      .eq('solicitante_id', perfil.id)
      .order('created_at', { ascending: false })
    if (error) setErro(error.message)
    setItems((data as unknown as Chamado[]) ?? [])
    setLoading(false)
  }, [perfil?.id])

  useEffect(() => { reload() }, [reload])
  return { items, loading, erro, reload }
}

export function useFilaChamados() {
  const [items, setItems] = useState<Chamado[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setErro(null)
    const { data, error } = await supabase
      .from('ti_chamados')
      .select(CHAMADO_SELECT)
      .order('created_at', { ascending: false })
    if (error) setErro(error.message)
    setItems((data as unknown as Chamado[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])
  return { items, loading, erro, reload }
}

export function useChamado(id: string | undefined) {
  const [chamado, setChamado] = useState<Chamado | null>(null)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setErro(null)
    const [{ data: ch, error: e1 }, { data: cs, error: e2 }] = await Promise.all([
      supabase.from('ti_chamados').select(CHAMADO_SELECT).eq('id', id).maybeSingle(),
      supabase
        .from('ti_chamado_comentarios')
        .select('id, chamado_id, autor_id, mensagem, interno, created_at, autor:sys_perfis(nome)')
        .eq('chamado_id', id)
        .order('created_at', { ascending: true }),
    ])
    if (e1) setErro(e1.message)
    else if (e2) setErro(e2.message)
    setChamado((ch as unknown as Chamado) ?? null)
    setComentarios((cs as unknown as Comentario[]) ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { reload() }, [reload])
  return { chamado, comentarios, loading, erro, reload }
}

export async function criarChamado(input: {
  solicitante_id: string
  categoria: Chamado['categoria']
  prioridade: Chamado['prioridade']
  titulo: string
  descricao: string
}) {
  const { data, error } = await supabase
    .from('ti_chamados')
    .insert(input)
    .select(CHAMADO_SELECT)
    .single()
  if (error) throw error
  const chamado = data as unknown as Chamado
  // fire-and-forget — não bloqueia UX
  void notificarNovoChamado(chamado)
  return { id: chamado.id, numero: chamado.numero }
}

export async function adicionarComentario(input: {
  chamado_id: string
  autor_id: string
  autor_nome: string
  autor_email?: string | null
  autor_eh_atendente: boolean
  mensagem: string
  interno?: boolean
}) {
  const { error } = await supabase
    .from('ti_chamado_comentarios')
    .insert({
      chamado_id: input.chamado_id,
      autor_id: input.autor_id,
      mensagem: input.mensagem,
      interno: input.interno ?? false,
    })
  if (error) throw error

  // Busca o chamado pra montar o e-mail
  const { data: ch } = await supabase
    .from('ti_chamados')
    .select(CHAMADO_SELECT)
    .eq('id', input.chamado_id)
    .maybeSingle()
  if (ch) {
    void notificarNovoComentario(
      ch as unknown as Chamado,
      { nome: input.autor_nome, email: input.autor_email, eAtendente: input.autor_eh_atendente },
      input.mensagem,
      input.interno ?? false,
    )
  }
}

export async function atualizarStatus(id: string, status: StatusChamado, atendente_id?: string | null) {
  const patch: Record<string, unknown> = { status }
  if (atendente_id !== undefined) patch.atendente_id = atendente_id
  const { error } = await supabase.from('ti_chamados').update(patch).eq('id', id)
  if (error) throw error

  const { data: ch } = await supabase
    .from('ti_chamados')
    .select(CHAMADO_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (ch) {
    void notificarMudancaStatus(ch as unknown as Chamado, status)
  }
}

// ─── Anexos ─────────────────────────────────────────────────────────────────

const BUCKET = 'ti-chamados'

export function useAnexos(chamado_id: string | undefined) {
  const [items, setItems] = useState<Anexo[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!chamado_id) return
    setLoading(true)
    const { data } = await supabase
      .from('ti_chamado_anexos')
      .select('*')
      .eq('chamado_id', chamado_id)
      .order('created_at', { ascending: true })
    setItems((data as unknown as Anexo[]) ?? [])
    setLoading(false)
  }, [chamado_id])

  useEffect(() => { reload() }, [reload])
  return { items, loading, reload }
}

function sanitizeFilename(name: string) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)
}

export async function uploadAnexo(input: {
  file: File
  chamado_id: string
  autor_id: string
  comentario_id?: string | null
}) {
  if (input.file.size > ANEXO_MAX_BYTES) {
    throw new Error(`Arquivo passa do limite (${(input.file.size / 1024 / 1024).toFixed(1)} MB). Máx: 15 MB.`)
  }
  const safe = sanitizeFilename(input.file.name)
  const uid = crypto.randomUUID()
  const path = `${input.chamado_id}/${uid}-${safe}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { contentType: input.file.type || undefined, upsert: false })
  if (upErr) throw upErr

  const { error: dbErr } = await supabase.from('ti_chamado_anexos').insert({
    chamado_id: input.chamado_id,
    comentario_id: input.comentario_id ?? null,
    autor_id: input.autor_id,
    storage_path: path,
    nome: input.file.name,
    mime: input.file.type || null,
    tamanho_bytes: input.file.size,
  })
  if (dbErr) {
    // tenta limpar o arquivo órfão
    await supabase.storage.from(BUCKET).remove([path])
    throw dbErr
  }
}

export async function getAnexoUrl(storage_path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storage_path, 60 * 5) // 5 min
  if (error) throw error
  return data.signedUrl
}

export async function removerAnexo(anexo: Anexo) {
  const { error: dbErr } = await supabase.from('ti_chamado_anexos').delete().eq('id', anexo.id)
  if (dbErr) throw dbErr
  await supabase.storage.from(BUCKET).remove([anexo.storage_path])
}

export async function assumirChamado(id: string, atendente_id: string) {
  const { error } = await supabase
    .from('ti_chamados')
    .update({ atendente_id, status: 'em_atendimento' })
    .eq('id', id)
  if (error) throw error
}
