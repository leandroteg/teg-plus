import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// ── Spinner de loading ─────────────────────────────────────────────
function AuthLoading() {
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-navy flex items-center justify-center shadow-lg">
        <span className="text-white text-lg font-black">T+</span>
      </div>
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <span className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
        Carregando...
      </div>
    </div>
  )
}

// ── Guard: usuário autenticado ─────────────────────────────────────
export function PrivateRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoading />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

// ── Guard: apenas admins ───────────────────────────────────────────
export function AdminRoute() {
  const { user, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <AuthLoading />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
