import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'

type EditorPresence = {
  userId: string
  userName: string
  resourceType: string
  resourceId: string
  openedAt: string
}

function comparePresence(a: EditorPresence, b: EditorPresence) {
  const timeDiff = new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()
  if (timeDiff !== 0) return timeDiff
  return a.userId.localeCompare(b.userId)
}

export function useEditorLock({
  resourceType,
  resourceId,
  enabled = true,
}: {
  resourceType: string
  resourceId?: string
  enabled?: boolean
}) {
  const { perfil } = useAuth()
  const [presences, setPresences] = useState<EditorPresence[]>([])
  const sessionKeyRef = useRef(`lock-${Math.random().toString(36).slice(2, 10)}`)
  const openedAtRef = useRef(new Date().toISOString())

  useEffect(() => {
    if (!enabled || !perfil?.id || !resourceId) {
      setPresences([])
      return
    }

    const channel = supabase.channel(`editor-lock:${resourceType}:${resourceId}`, {
      config: {
        presence: { key: sessionKeyRef.current },
      },
    })

    const syncPresence = () => {
      const state = channel.presenceState<EditorPresence>()
      const next = Object.values(state)
        .flat()
        .filter((presence): presence is EditorPresence => (
          Boolean(presence?.userId)
          && presence.resourceType === resourceType
          && presence.resourceId === resourceId
        ))
        .sort(comparePresence)

      setPresences(next)
    }

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return

        await channel.track({
          userId: perfil.id,
          userName: perfil.nome || perfil.email || 'Usuario',
          resourceType,
          resourceId,
          openedAt: openedAtRef.current,
        } satisfies EditorPresence)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled, perfil?.email, perfil?.id, perfil?.nome, resourceId, resourceType])

  const owner = useMemo(() => {
    const uniqueUsers = new Map<string, EditorPresence>()
    for (const presence of presences) {
      const current = uniqueUsers.get(presence.userId)
      if (!current || comparePresence(presence, current) < 0) {
        uniqueUsers.set(presence.userId, presence)
      }
    }
    return Array.from(uniqueUsers.values()).sort(comparePresence)[0] ?? null
  }, [presences])

  const blockedBy = owner && owner.userId !== perfil?.id ? owner : null

  return {
    isLocked: Boolean(blockedBy),
    blockedByName: blockedBy?.userName ?? null,
  }
}
