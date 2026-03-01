import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, List, ShoppingCart, User, LogOut, Shield } from 'lucide-react'
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '../contexts/AuthContext'

const nav = [
  { to: '/',            icon: LayoutDashboard, label: 'Painel' },
  { to: '/nova',        icon: PlusCircle,      label: 'Nova RC' },
  { to: '/requisicoes', icon: List,            label: 'Lista' },
  { to: '/cotacoes',    icon: ShoppingCart,    label: 'Cotações' },
  { to: '/perfil',      icon: User,            label: 'Perfil' },
]

// Cores determinísticas para o avatar (baseadas no nome)
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-cyan-500',
  'bg-teal-500',   'bg-emerald-500','bg-amber-500', 'bg-rose-500',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Layout() {
  const { perfil, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const nome    = perfil?.nome    ?? 'Usuário'
  const role    = perfil?.role    ?? 'requisitante'
  const initials = getInitials(nome)
  const avatarBg = getAvatarColor(nome)

  // Primeiro nome para exibição compacta
  const firstName = nome.split(' ')[0]

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-24">

      {/* ── Header ────────────────────────────────────────────────── */}
      <header
        className="bg-navy text-white px-5 py-3 sticky top-0 z-30"
        style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">

          {/* Branding */}
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight leading-none">TEG+ Compras</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Sistema de Requisições</p>
          </div>

          {/* Usuário */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Badge Admin */}
            {isAdmin && (
              <div
                className="hidden sm:flex items-center gap-1 bg-amber-400/20 border border-amber-400/30
                  text-amber-300 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              >
                <Shield size={10} />
                Admin
              </div>
            )}

            {/* Nome + Role — visível em telas maiores */}
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-white leading-none">{firstName}</p>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block
                  ${ROLE_COLOR[role].bg} ${ROLE_COLOR[role].text}`}
              >
                {ROLE_LABEL[role]}
              </span>
            </div>

            {/* Avatar — clicável → Perfil */}
            <button
              onClick={() => navigate('/perfil')}
              className={`w-8 h-8 rounded-full flex items-center justify-center
                text-white text-xs font-extrabold ring-2 ring-white/20
                transition-transform active:scale-90 ${avatarBg}`}
              title={`${nome} · ${ROLE_LABEL[role]}`}
            >
              {initials}
            </button>

            {/* Logout rápido */}
            <button
              onClick={handleLogout}
              className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center
                text-slate-400 hover:text-white hover:bg-white/20 transition-all active:scale-90"
              title="Sair"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────── */}
      <main className="px-4 py-5 max-w-lg mx-auto">
        <Outlet />
      </main>

      {/* ── Bottom Nav ────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 z-40"
        style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}
      >
        <div className="flex justify-around max-w-lg mx-auto px-2 py-1.5">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-1.5 px-3 rounded-xl text-[10px] font-semibold
                 transition-all duration-150 ${
                   isActive
                     ? 'text-primary bg-primary/10'
                     : 'text-gray-400 hover:text-gray-600'
                 }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
