import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LogoTeg from './LogoTeg'

// ── Spinner de loading ─────────────────────────────────────────────────────────
function AuthLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5"
      style={{ background: '#060D1B' }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(20,184,166,0.15) 0%, transparent 65%)',
        }}
      />

      {/* Animated logo */}
      <div className="relative animate-pulse-glow rounded-[28px] p-2">
        <LogoTeg size={80} animated glowing={false} />
      </div>

      {/* Loading indicator */}
      <div className="flex items-center gap-2.5 text-teal-400/60 text-sm">
        <span
          className="w-4 h-4 border-2 border-teal-500/25 border-t-teal-400 rounded-full animate-spin"
        />
        <span className="font-medium">Carregando...</span>
      </div>
    </div>
  )
}

// ── Guard: usuário autenticado ─────────────────────────────────────────────────
export function PrivateRoute() {
  const { user, loading, perfilReady, perfil } = useAuth()
  const location = useLocation()

  // Enquanto carrega ou enquanto o safety net aguarda → spinner
  if (loading || !perfilReady) return <AuthLoading />

  // Usuário autenticado mas perfil não carregou → o safety net já iniciou
  // o logout local; enquanto isso, mantemos o spinner (nunca mostra conteúdo)
  if (user && !perfil) return <AuthLoading />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

// ── Guard: apenas admins ───────────────────────────────────────────────────────
export function AdminRoute() {
  const { user, loading, perfilReady, perfil, isAdmin } = useAuth()
  const location = useLocation()

  if (loading || !perfilReady) return <AuthLoading />

  if (user && !perfil) return <AuthLoading />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
