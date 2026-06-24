import { useState } from 'react'
import { usePortalAuth } from '../hooks/usePortalAuth'
import PortalLogin from './portal/PortalLogin'
import PortalHome from './portal/PortalHome'
import PortalMissoes from './portal/PortalMissoes'

export default function PortalApp() {
  const { user, isAuthenticated } = usePortalAuth()
  const [view, setView] = useState<'home' | 'missoes'>('home')

  if (!isAuthenticated || !user) {
    return <PortalLogin />
  }

  if (view === 'missoes') return <PortalMissoes user={user} onBack={() => setView('home')} />
  return <PortalHome user={user} onAbrirMissoes={() => setView('missoes')} />
}
