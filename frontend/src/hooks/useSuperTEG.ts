import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

const WEBHOOK_URL = 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook/superteg/chat'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'text' | 'audio'
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

        setMessages(prev => [...prev, {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data?.resposta || data?.output || data?.text || 'Sem resposta.',
          timestamp: data?.timestamp || new Date().toISOString(),
        }])
      } catch {
        setMessages(prev => [...prev, {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: 'Não foi possível conectar ao SuperTEG. Tente novamente.',
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

      const displayText = transcript || 'Mensagem de áudio'
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
        /* convert blob to base64 */
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

        /* update user message with server transcription if available */
        const serverTranscript = data?.transcription
        if (serverTranscript && serverTranscript !== transcript) {
          setMessages(prev => prev.map(m =>
            m.id === tempId ? { ...m, content: serverTranscript } : m
          ))
        }

        setMessages(prev => [...prev, {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data?.resposta || data?.output || data?.text || 'Sem resposta.',
          timestamp: data?.timestamp || new Date().toISOString(),
        }])
      } catch {
        setMessages(prev => [...prev, {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: 'Não foi possível processar o áudio. Tente novamente.',
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

  return { messages, isLoading, sendMessage, sendAudio, clearMessages }
}
