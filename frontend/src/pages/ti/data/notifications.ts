// Notificações in-app de TI (ti_notificacoes). Os triggers do banco já inserem
// as notificações (novo/atribuído/comentou/status); o front só consome.
// Realtime via Supabase (canal por usuário) + polling de 20s como fallback.
import { supabase } from './supabase'
import type { Notification } from './shapes'

/* eslint-disable @typescript-eslint/no-explicit-any */
function toNotification(r: any): Notification {
  return {
    id: r.id,
    type: r.tipo,
    title: r.titulo,
    body: r.corpo ?? null,
    ticketId: r.chamado_id ?? null,
    read: r.lida,
    createdAt: r.created_at,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listNotifications(perfilId: string): Promise<{ items: Notification[]; unread: number }> {
  const [listRes, countRes] = await Promise.all([
    supabase
      .from('ti_notificacoes')
      .select('id, tipo, titulo, corpo, chamado_id, lida, created_at')
      .eq('usuario_id', perfilId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('ti_notificacoes')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', perfilId)
      .eq('lida', false),
  ])
  if (listRes.error) throw listRes.error
  return { items: (listRes.data ?? []).map(toNotification), unread: countRes.count ?? 0 }
}

export async function markRead(perfilId: string, ids?: string[]): Promise<void> {
  let q = supabase.from('ti_notificacoes').update({ lida: true }).eq('usuario_id', perfilId)
  q = ids && ids.length ? q.in('id', ids) : q.eq('lida', false)
  const { error } = await q
  if (error) throw error
}

/** Assina inserts em ti_notificacoes para o usuário; devolve o unsubscribe. */
export function subscribeNotifications(perfilId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`ti-notif-${perfilId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ti_notificacoes', filter: `usuario_id=eq.${perfilId}` },
      onChange,
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
