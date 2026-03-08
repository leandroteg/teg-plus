import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const WEBHOOK_URL = 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook/superteg/chat'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ChatAction {
  type: 'navigate' | 'notify_admins' | 'open_url'
  path?: string
  url?: string
  label?: string
  entity?: string
  pre_cadastro_id?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'text' | 'audio'
  actions?: ChatAction[]
  timestamp: string
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useSuperTEG() {
  const { perfil } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('superteg-history')
      return saved ? (JSON.parse(saved) as ChatMessage[]) : []
    } catch { return [] }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<ChatAction | null>(null)

  useEffect(() => {
    try {
      if (messages.length === 0) {
        sessionStorage.removeItem('superteg-history')
      } else {
        sessionStorage.setItem('superteg-history', JSON.stringify(messages.slice(-20)))
      }
      sessionStorage.setItem('superteg-session-id', sessionRef.current)
    } catch { /* storage cheio */ }
  }, [messages])
  const busyRef = useRef(false)
  const sessionRef = useRef(
    sessionStorage.getItem('superteg-session-id') ??
    `web_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  )

  /** Parse structured actions from n8n response */
  function parseResponse(data: Record<string, unknown>): { content: string; actions: ChatAction[] } {
    const content = (data?.resposta || data?.output || data?.text || 'Sem resposta.') as string
    let actions: ChatAction[] = []

    // Try to get actions from response
    if (Array.isArray(data?.actions)) {
      actions = data.actions as ChatAction[]
    }

    // Auto-detect navigation intents from markdown links in content
    // Pattern: [label](/path) — extract as navigate actions
    const linkPattern = /\[([^\]]+)\]\((\/[^)]+)\)/g
    for (const m of content.matchAll(linkPattern)) {
      const alreadyExists = actions.some(a => a.path === m[2])
      if (!alreadyExists) {
        actions.push({ type: 'navigate', path: m[2], label: m[1] })
      }
    }

    return { content, actions }
  }

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || busyRef.current) return
      busyRef.current = true
      setIsLoading(true)

      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, userMsg])

      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            session_id: sessionRef.current,
            perfil_id: perfil?.id || null,
          }),
        })

        const raw = await res.json()
        const data = Array.isArray(raw) ? raw[0] : raw
        const { content, actions } = parseResponse(data)

        setMessages(prev => [...prev, {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content,
          actions: actions.length > 0 ? actions : undefined,
          timestamp: data?.timestamp || new Date().toISOString(),
        }])

        // Auto-navigate if there's exactly one navigate action
        const navActions = actions.filter(a => a.type === 'navigate')
        if (navActions.length === 1) {
          setPendingAction(navActions[0])
        }
      } catch {
        setMessages(prev => [...prev, {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: 'Nao foi possivel conectar ao SuperTEG. Tente novamente.',
          timestamp: new Date().toISOString(),
        }])
      } finally {
        busyRef.current = false
        setIsLoading(false)
      }
    },
    [perfil]
  )

  const sendAudio = useCallback(
    async (blob: Blob, transcript: string) => {
      if (busyRef.current) return
      busyRef.current = true
      setIsLoading(true)

      const displayText = transcript || 'Mensagem de audio'
      const tempId = `u_${Date.now()}`
      const userMsg: ChatMessage = {
        id: tempId,
        role: 'user',
        content: displayText,
        type: 'audio',
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, userMsg])

      try {
        const buffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const base64 = btoa(binary)

        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'audio',
            message: transcript,
            transcription: transcript,
            audio_base64: base64,
            audio_mime: blob.type,
            session_id: sessionRef.current,
            perfil_id: perfil?.id || null,
          }),
        })

        const raw = await res.json()
        const data = Array.isArray(raw) ? raw[0] : raw

        const serverTranscript = data?.transcription
        if (serverTranscript && serverTranscript !== transcript) {
          setMessages(prev => prev.map(m =>
            m.id === tempId ? { ...m, content: serverTranscript } : m
          ))
        }

        const { content, actions } = parseResponse(data)

        setMessages(prev => [...prev, {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content,
          actions: actions.length > 0 ? actions : undefined,
          timestamp: data?.timestamp || new Date().toISOString(),
        }])

        const navActions = actions.filter(a => a.type === 'navigate')
        if (navActions.length === 1) {
          setPendingAction(navActions[0])
        }
      } catch {
        setMessages(prev => [...prev, {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: 'Nao foi possivel processar o audio. Tente novamente.',
          timestamp: new Date().toISOString(),
        }])
      } finally {
        busyRef.current = false
        setIsLoading(false)
      }
    },
    [perfil]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    sessionStorage.removeItem('superteg-history')
    sessionStorage.removeItem('superteg-session-id')
    sessionRef.current = `web_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }, [])

  const consumePendingAction = useCallback(() => {
    const action = pendingAction
    setPendingAction(null)
    return action
  }, [pendingAction])

  return { messages, isLoading, sendMessage, sendAudio, clearMessages, pendingAction, consumePendingAction }
}
