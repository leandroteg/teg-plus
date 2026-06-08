import { usePortalAuth } from '../hooks/usePortalAuth'
import PortalLogin from './portal/PortalLogin'
import PortalHome from './portal/PortalHome'

export default function PortalApp() {
  const { user, isAuthenticated } = usePortalAuth()

  if (!isAuthenticated || !user) {
    return <PortalLogin />
  }

  return <PortalHome user={user} />
}
