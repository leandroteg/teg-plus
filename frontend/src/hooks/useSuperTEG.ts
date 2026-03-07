import { useState, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

const N8N_URL = import.meta.env.VITE_N8N_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host'
const WEBHOOK_PATH = '/webhook/superteg/chat'

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ── Hook ────────────────────────────────────────────────────────────────────────

export function useSuperTEG() {
  const { perfil } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const sessionRef = useRef(
    `web_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  )

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return

      // Add user message immediately
      const userMsg: ChatMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      }
      setMessages(prev => [...prev, userMsg])
      setIsLoading(true)

      try {
        const res = await fetch(`${N8N_URL}${WEBHOOK_PATH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            session_id: sessionRef.current,
            perfil_id: perfil?.id || null,
          }),
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()

        // Handle both direct response and array response from n8n
        const resposta =
          Array.isArray(data)
            ? data[0]?.resposta || data[0]?.output || data[0]?.text
            : data.resposta || data.output || data.text

        const botMsg: ChatMessage = {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content:
            resposta || 'Desculpe, não consegui processar sua mensagem.',
          timestamp:
            (Array.isArray(data) ? data[0]?.timestamp : data.timestamp) ||
            new Date().toISOString(),
        }
        setMessages(prev => [...prev, botMsg])
      } catch {
        const errorMsg: ChatMessage = {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content:
            '⚠️ Não foi possível conectar ao SuperTEG. Tente novamente em instantes.',
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errorMsg])
      } finally {
        setIsLoading(false)
      }
    },
    [perfil, isLoading]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    sessionRef.current = `web_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }, [])

  return { messages, isLoading, sendMessage, clearMessages }
}
