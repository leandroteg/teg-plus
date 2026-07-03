import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LogoTeg from './LogoTeg'
import SetPasswordModal from './SetPasswordModal'

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
  const { user, loading, perfilReady, perfil, pendingPasswordReset } = useAuth()
  const location = useLocation()

  // Enquanto carrega ou enquanto o safety net aguarda → spinner
  if (loading || !perfilReady) return <AuthLoading />

  // Usuário autenticado mas perfil não carregou → o safety net já iniciou
  // o logout local; enquanto isso, mantemos o spinner (nunca mostra conteúdo)
  if (user && !perfil) return <AuthLoading />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Recovery link: redireciona para tela dedicada de redefinição de senha
  if (pendingPasswordReset) {
    return <Navigate to="/nova-senha" replace />
  }

  return (
    <>
      {perfil && (!perfil.senha_definida || perfil.alterar_senha_proximo_login) && <SetPasswordModal />}
      <Outlet />
    </>
  )
}

// ── Guard: apenas admins ───────────────────────────────────────────────────────
export function AdminRoute() {
  const { user, loading, perfilReady, perfil, isAdmin, pendingPasswordReset } = useAuth()
  const location = useLocation()

  if (loading || !perfilReady) return <AuthLoading />

  if (user && !perfil) return <AuthLoading />

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Recovery link: redireciona para tela dedicada de redefinição de senha
  if (pendingPasswordReset) {
    return <Navigate to="/nova-senha" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      {perfil && (!perfil.senha_definida || perfil.alterar_senha_proximo_login) && <SetPasswordModal />}
      <Outlet />
    </>
  )
}

// ── Guard: bloqueia conteúdo para não-admins ──────────────────────────────────
// Uso: páginas admin embutidas dentro de um layout de módulo (ex.: /ti/admin,
// /rh/mural), onde envolver a rota inteira em <AdminRoute> quebraria o
// aninhamento do layout. Centraliza a checagem de isAdmin num único lugar.
export function RequireAdmin({ children, redirectTo }: { children: ReactNode; redirectTo?: string }) {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    if (redirectTo) return <Navigate to={redirectTo} replace />
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle size={40} className="text-amber-400" />
        <p className="text-white font-bold text-lg">Acesso restrito</p>
        <p className="text-slate-400 text-sm">Esta área é exclusiva para administradores.</p>
      </div>
    )
  }

  return <>{children}</>
}
