import { useState, useEffect, useCallback, useRef } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Global reference captured in index.html <script> before React mounts
declare global {
  interface Window {
    __pwaInstallPrompt: BeforeInstallPromptEvent | null
  }
}

export function usePWAInstall() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(
    window.__pwaInstallPrompt ?? null
  )
  const [canInstall, setCanInstall] = useState(!!window.__pwaInstallPrompt)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      window.__pwaInstallPrompt = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setCanInstall(false)
      deferredPrompt.current = null
      window.__pwaInstallPrompt = null
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    const prompt = deferredPrompt.current ?? window.__pwaInstallPrompt
    if (!prompt) return false
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    deferredPrompt.current = null
    window.__pwaInstallPrompt = null
    setCanInstall(false)
    return outcome === 'accepted'
  }, [])

  const dismissCount = parseInt(localStorage.getItem('teg-pwa-dismiss') || '0', 10)

  const dismiss = useCallback(() => {
    const c = parseInt(localStorage.getItem('teg-pwa-dismiss') || '0', 10)
    localStorage.setItem('teg-pwa-dismiss', String(c + 1))
  }, [])

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

  return { canInstall, isInstalled, promptInstall, dismiss, dismissCount, isIOS }
}

export function useStandaloneMode() {
  const [isStandalone, setIsStandalone] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isStandalone
}
