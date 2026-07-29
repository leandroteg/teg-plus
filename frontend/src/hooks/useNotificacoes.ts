// ─────────────────────────────────────────────────────────────────────────────
// useNotificacoes.ts — Fila in-app de notificacoes (sys_notif_queue, mig 129).
//
// Origens: cartao_lancamento (mig 129) + notificacoes de etapa de todos os
// modulos (triggers/sweep das migs 20260729000001+ — aprovacoes, cotacoes,
// esclarecimentos, locacao, cautelas, adiantamentos, SGI, contratos).
// Novas origens podem ser plugadas sem mudar este hook — a fila e generica.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface NotifItem {
  id: string
  titulo: string
  corpo: string | null
  url: string | null
  origem: string
  origem_id: string | null
  criada_em: string
  vista_em: string | null
}

const QK = ['notif-queue-naovistas']

export function useNotificacoes() {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const userId = perfil?.auth_id

  const query = useQuery<NotifItem[]>({
    queryKey: QK,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_notif_queue')
        .select('id, titulo, corpo, url, origem, origem_id, criada_em, vista_em')
        .eq('user_id', userId!)
        .is('vista_em', null)
        .order('criada_em', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as NotifItem[]
    },
    staleTime: 30_000,
    // Fallback caso o realtime nao dispare (mesmo padrao do sino do TI)
    refetchInterval: 60_000,
  })

  // Realtime: dispara browser notification + invalida query ao chegar nova
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sys_notif_queue', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as NotifItem
          qc.invalidateQueries({ queryKey: QK })
          // Browser notification (permissao concedida e PWA aberto)
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(n.titulo, {
                body: n.corpo ?? undefined,
                icon: '/icons/icon-192.png',
                tag: `${n.origem}:${n.origem_id ?? n.id}`,
              })
            } catch { /* ignore */ }
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, qc])

  const marcarVista = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sys_notif_queue')
        .update({ vista_em: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  const marcarTodasVistas = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('sys_notif_queue')
        .update({ vista_em: new Date().toISOString() })
        .eq('user_id', userId!)
        .is('vista_em', null)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  })

  const lista = query.data ?? []
  const count = useMemo(() => lista.length, [lista])

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const result = await Notification.requestPermission()
    return result === 'granted'
  }, [])

  return {
    lista,
    count,
    isLoading: query.isLoading,
    marcarVista: (id: string) => marcarVista.mutate(id),
    marcarTodasVistas: () => marcarTodasVistas.mutate(),
    requestPermission,
  }
}
