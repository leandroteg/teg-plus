// Atendentes de TI (para o seletor de "Responsável"). Lê ti_atendentes ⋈ sys_perfis.
import { supabase } from './supabase'
import { toTicketUser } from './mappers'
import type { TicketUser, ManagedUser, Role } from './shapes'

export async function listAssignees(): Promise<TicketUser[]> {
  const { data, error } = await supabase
    .from('ti_atendentes')
    .select('perfil:sys_perfis!ti_atendentes_perfil_id_fkey(id, nome, email)')
  if (error) throw error
  return (data ?? [])
    .map((r: { perfil: unknown }) => r.perfil)
    .filter(Boolean)
    .map((p) => toTicketUser(p, 'AGENTE'))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Lista TODOS os usuários do TEG+ (sys_perfis) com o papel de TI derivado. */
export async function listAllUsers(): Promise<ManagedUser[]> {
  const [perfisRes, atendRes] = await Promise.all([
    supabase.from('sys_perfis').select('id, nome, email, role, ativo, created_at').order('nome'),
    supabase.from('ti_atendentes').select('perfil_id'),
  ])
  if (perfisRes.error) throw perfisRes.error
  if (atendRes.error) throw atendRes.error
  const atendentes = new Set((atendRes.data ?? []).map((a: { perfil_id: string }) => a.perfil_id))
  return (perfisRes.data ?? []).map((p: any) => {
    const isAdmin = p.role === 'administrador' || p.role === 'admin'
    const role: Role = isAdmin ? 'ADMIN' : atendentes.has(p.id) ? 'AGENTE' : 'REQUERENTE'
    return { id: p.id, name: p.nome, email: p.email, role, active: p.ativo !== false, createdAt: p.created_at }
  })
}

/**
 * Altera o papel de TI de um usuário. SEGURO e restrito ao escopo do módulo:
 * só alterna Requerente ↔ Agente, gravando/removendo em `ti_atendentes`.
 * "Admin" é papel GLOBAL do TEG+ (sys_perfis.role) e NÃO é tocado aqui.
 */
export async function setUserTiRole(perfilId: string, role: Role, by: { id: string; name: string }): Promise<void> {
  if (role === 'AGENTE') {
    const { error } = await supabase
      .from('ti_atendentes')
      .upsert({ perfil_id: perfilId, adicionado_por: by.id, criado_por_nome: by.name }, { onConflict: 'perfil_id' })
    if (error) throw error
  } else if (role === 'REQUERENTE') {
    const { error } = await supabase.from('ti_atendentes').delete().eq('perfil_id', perfilId)
    if (error) throw error
  } else {
    throw new Error('O papel de Administrador é global do TEG+ e não pode ser alterado pelo módulo de TI.')
  }
}
