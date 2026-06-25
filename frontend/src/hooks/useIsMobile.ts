import { useState, useEffect } from 'react'

// Detecta viewport mobile (< lg / 1024px — mesmo breakpoint que o ModuleLayout
// usa pra trocar sidebar↔bottom-nav). Usado p/ renderizar a versão mobile-native
// dos painéis sem montar a árvore desktop (e vice-versa).
export function useIsMobile(query = '(max-width: 1023px)'): boolean {
  const get = () => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false)
  const [isMobile, setIsMobile] = useState(get)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = () => setIsMobile(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return isMobile
}
