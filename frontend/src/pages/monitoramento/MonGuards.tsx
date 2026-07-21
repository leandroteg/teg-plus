// Guard de rota do módulo Monitoramento. O acesso ao módulo (hasModule) é
// garantido antes pelo ModuleRoute; aqui restringimos a Configuração ao admin.
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function MonAdminRoute() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/monitoramento" replace />
  return <Outlet />
}
