import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Route guard that checks if the user has access to a specific module.
 * Wraps module routes to enforce module-level access control.
 *
 * Usage in App.tsx:
 *   <Route element={<ModuleRoute module="financeiro" />}>
 *     <Route path="/financeiro" element={<Dashboard />} />
 *   </Route>
 */
export default function ModuleRoute({ module }: { module: string }) {
  const { hasModule, isAdmin } = useAuth()

  // Admins always have access to all modules
  if (isAdmin) return <Outlet />

  // Check module access
  if (!hasModule(module)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
