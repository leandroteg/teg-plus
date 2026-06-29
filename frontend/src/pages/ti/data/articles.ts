// Base de conhecimento (ti_artigos). Leitura para todos os autenticados (admin-only
// aqui), CRUD pela equipe. ti_artigos não tem trigger de updated_at, então setamos
// updated_at no update manualmente.
import { supabase } from './supabase'
import type { ArticleListItem, Article } from './shapes'

/* eslint-disable @typescript-eslint/no-explicit-any */
function toListItem(r: any): ArticleListItem {
  return {
    id: r.id,
    title: r.titulo,
    published: r.publicado,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: { id: r.autor?.id ?? '', name: r.autor?.nome ?? '—' },
  }
}
function toArticle(r: any): Article {
  return { ...toListItem(r), content: r.conteudo }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const LIST_SELECT = 'id, titulo, publicado, created_at, updated_at, autor:sys_perfis!ti_artigos_autor_id_fkey(id, nome)'
const FULL_SELECT = 'id, titulo, conteudo, publicado, created_at, updated_at, autor:sys_perfis!ti_artigos_autor_id_fkey(id, nome)'

export async function listArticles(q?: string): Promise<ArticleListItem[]> {
  let query = supabase.from('ti_artigos').select(LIST_SELECT).order('updated_at', { ascending: false })
  if (q && q.trim()) {
    const term = q.trim().replace(/[%,()]/g, ' ')
    query = query.or(`titulo.ilike.%${term}%,conteudo.ilike.%${term}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(toListItem)
}

export async function getArticle(id: string): Promise<Article | null> {
  const { data, error } = await supabase.from('ti_artigos').select(FULL_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toArticle(data) : null
}

export async function createArticle(input: { title: string; content: string; published: boolean; autorId: string }): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('ti_artigos')
    .insert({ titulo: input.title, conteudo: input.content, publicado: input.published, autor_id: input.autorId })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

export async function updateArticle(id: string, patch: { title?: string; content?: string; published?: boolean }): Promise<void> {
  const db: Record<string, unknown> = {}
  if (patch.title !== undefined) db.titulo = patch.title
  if (patch.content !== undefined) db.conteudo = patch.content
  if (patch.published !== undefined) db.publicado = patch.published
  if (!Object.keys(db).length) return
  db.updated_at = new Date().toISOString()
  const { error } = await supabase.from('ti_artigos').update(db).eq('id', id)
  if (error) throw error
}
