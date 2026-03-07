import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  moduleKey: string
  children?: React.ReactNode
}

export default function ModuleRoute({ moduleKey, children }: Props) {
  const { isAdmin, hasModule, perfilReady, perfil } = useAuth()

  if (!perfilReady || !perfil) return null

  if (isAdmin) return children ? <>{children}</> : <Outlet />

  if (!hasModule(moduleKey)) {
    return <Navigate to="/" replace />
  }

  return children ? <>{children}</> : <Outlet />
}
