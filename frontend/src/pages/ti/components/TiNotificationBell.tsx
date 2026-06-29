import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { listNotifications, markRead, subscribeNotifications } from '../data/notifications'
import { useTiAuth } from '../data/auth'
import type { Notification } from '../data/shapes'
import { timeAgo } from '../lib/format'

// Sininho de notificações de TI. Lê ti_notificacoes do usuário, atualiza em tempo
// real via Supabase Realtime e cai para polling de 20s se o realtime falhar.
// Renderizado no header do ModuleLayout via prop headerExtra (fora do .ti-scope,
// então usa só utilitários Tailwind — sem as classes .card/.input).
export function TiNotificationBell() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useTiAuth()
  const perfilId = user?.id
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['ti', 'notifications'],
    queryFn: () => listNotifications(perfilId!),
    enabled: !!perfilId,
    refetchInterval: 20000,
  })

  useEffect(() => {
    if (!perfilId) return
    const unsub = subscribeNotifications(perfilId, () => {
      qc.invalidateQueries({ queryKey: ['ti', 'notifications'] })
      qc.invalidateQueries({ queryKey: ['ti', 'tickets'] })
      qc.invalidateQueries({ queryKey: ['ti', 'stats'] })
    })
    return unsub
  }, [perfilId, qc])

  const items = data?.items ?? []
  const unread = data?.unread ?? 0

  const openTicket = async (n: Notification) => {
    setOpen(false)
    if (perfilId) await markRead(perfilId, [n.id]).catch(() => undefined)
    qc.invalidateQueries({ queryKey: ['ti', 'notifications'] })
    if (n.ticketId) navigate(`/ti/chamados/${n.ticketId}`)
  }

  const markAll = async () => {
    if (perfilId) await markRead(perfilId).catch(() => undefined)
    qc.invalidateQueries({ queryKey: ['ti', 'notifications'] })
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100" title="Notificações de TI">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Notificações</span>
              {unread > 0 && <button onClick={markAll} className="text-xs font-medium text-sky-600 hover:underline">Marcar todas como lidas</button>}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-400">Sem notificações</div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openTicket(n)}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left hover:bg-slate-50 ${!n.read ? 'bg-sky-50/40' : ''}`}
                  >
                    <span className="text-sm font-medium text-slate-700">{n.title}</span>
                    {n.body && <span className="line-clamp-2 text-xs text-slate-500">{n.body}</span>}
                    <span className="text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
