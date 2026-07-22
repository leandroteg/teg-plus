import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../services/supabase'
import { resolveModulo, normalizeTela } from '../config/moduleTracking'

// Regrava a mesma tela no máximo a cada 30 min por aba (sobrevive a refresh)
const THROTTLE_MS = 30 * 60 * 1000

/**
 * Registra page views em sys_acessos para o painel admin "Uso dos Módulos".
 * Fire-and-forget: falha de insert nunca afeta a navegação.
 */
export default function AccessTracker() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    if (pathname === lastPath.current) return
    lastPath.current = pathname

    const modulo = resolveModulo(pathname)
    if (!modulo) return

    const tela = normalizeTela(pathname)
    const throttleKey = `acc:${tela}`
    try {
      const last = Number(sessionStorage.getItem(throttleKey) ?? 0)
      if (Date.now() - last < THROTTLE_MS) return
      sessionStorage.setItem(throttleKey, String(Date.now()))
    } catch {
      // sessionStorage indisponível (modo privado etc.) — segue sem throttle
    }

    supabase
      .from('sys_acessos')
      .insert({ usuario_id: user.id, modulo, tela })
      .then(({ error }) => {
        if (error && import.meta.env.DEV) console.warn('AccessTracker:', error.message)
      })
  }, [pathname, user])

  return null
}
