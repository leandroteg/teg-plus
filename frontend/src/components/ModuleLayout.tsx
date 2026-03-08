import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, LayoutGrid, Shield } from 'lucide-react'
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from './LogoTeg'
import ThemeToggle from './ThemeToggle'

// ── Avatar helpers (shared, single source of truth) ─────────────────────────

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-cyan-500',
  'bg-teal-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
]

export function getAvatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  end?: boolean
  adminOnly?: boolean
}

export interface ModuleConfig {
  name: string
  emoji: string
  color: string // tailwind color name: teal, emerald, indigo, blue, orange, rose, violet
  navItems: NavItem[]
  maxWidth?: string // e.g. 'max-w-4xl', 'max-w-5xl', defaults to 'max-w-5xl'
  showAdminLink?: boolean
  mobileNavLimit?: number // max items in bottom nav, defaults to 6
}

// ── Color utility ───────────────────────────────────────────────────────────

function c(color: string) {
  return {
    // Sidebar active link
    activeBgLight:       `bg-${color}-50`,
    activeTextLight:     `text-${color}-700`,
    activeBorderLight:   `border-${color}-200`,
    activeBgDark:        `bg-${color}-500/15`,
    activeTextDark:      `text-${color}-300`,
    activeBorderDark:    `border-${color}-500/25`,
    // Module badge
    badgeBgLight:        `bg-${color}-50`,
    badgeBorderLight:    `border-${color}-200`,
    badgeHoverBgLight:   `hover:bg-${color}-100`,
    badgeHoverBdLight:   `hover:border-${color}-300`,
    badgeBgDark:         `bg-${color}-500/10`,
    badgeBorderDark:     `border-${color}-500/25`,
    badgeHoverBgDark:    `hover:bg-${color}-500/18`,
    badgeHoverBdDark:    `hover:border-${color}-500/40`,
    badgeTextLight:      `text-${color}-700`,
    badgeTextDark:       `text-${color}-300`,
    badgeSubLight:       `text-${color}-500/60`,
    badgeSubDark:        `text-${color}-500/60`,
    badgeIconLight:      `text-${color}-400`,
    badgeIconHoverLight: `group-hover:text-${color}-500`,
    badgeIconDark:       `text-${color}-500/50`,
    badgeIconHoverDark:  `group-hover:text-${color}-400`,
    // Mobile
    mobileActiveTextLight:  `text-${color}-600`,
    mobileActiveBgLight:    `bg-${color}-50`,
    mobileActiveTextDark:   `text-${color}-400`,
    mobileActiveBgDark:     `bg-${color}-400/10`,
    // Mobile header
    headerSubLight:      `text-${color}-500`,
    headerSubDark:       `text-${color}-400/70`,
  }
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ModuleLayout({ config }: { config: ModuleConfig }) {
  const { perfil, isAdmin, signOut, role } = useAuth()
  const { isDark, isLightSidebar } = useTheme()
  const navigate = useNavigate()

  const nome      = perfil?.nome ?? 'Usuário'
  const initials  = getInitials(nome)
  const avatarBg  = getAvatarColor(nome)
  const firstName = nome.split(' ')[0]
  const ls        = isLightSidebar
  const colors    = c(config.color)
  const maxW      = config.maxWidth ?? 'max-w-5xl'
  const mobileLimit = config.mobileNavLimit ?? 6

  const visibleNav = config.navItems.filter(n => !n.adminOnly || isAdmin)

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function sidebarLinkClass({ isActive }: { isActive: boolean }) {
    const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 border'
    if (isActive)
      return `${base} ${ls
        ? `${colors.activeBgLight} ${colors.activeTextLight} ${colors.activeBorderLight}`
        : `${colors.activeBgDark} ${colors.activeTextDark} ${colors.activeBorderDark}`}`
    return `${base} ${ls
      ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent'
      : 'text-slate-400 hover:text-slate-100 hover:bg-white/6 border-transparent'}`
  }

  function bottomLinkClass({ isActive }: { isActive: boolean }) {
    const base = 'flex flex-col items-center py-2 px-1.5 rounded-xl text-[9px] font-semibold transition-all duration-150 min-w-[40px]'
    if (isActive)
      return `${base} ${ls
        ? `${colors.mobileActiveTextLight} ${colors.mobileActiveBgLight}`
        : `${colors.mobileActiveTextDark} ${colors.mobileActiveBgDark}`}`
    return `${base} ${ls
      ? 'text-slate-400 hover:text-slate-600'
      : 'text-slate-500 hover:text-slate-300'}`
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0c1222]' : ls ? 'bg-slate-50' : 'bg-slate-100'}`}>

      {/* ── DESKTOP SIDEBAR ────────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 z-40
          ${ls ? 'bg-white border-r border-slate-200/80' : 'bg-[#0B1523]'}`}
        style={{ boxShadow: ls ? '1px 0 0 rgba(0,0,0,0.05)' : '4px 0 24px rgba(0,0,0,0.4)' }}
      >
        {/* Brand + module badge */}
        <div className={`px-4 pt-5 pb-4 border-b ${ls ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <div className="flex items-center gap-3 mb-4">
            <LogoTeg size={38} animated={false} />
            <div>
              <p className={`font-black text-lg tracking-tight leading-none ${ls ? 'text-slate-800' : 'text-white'}`}>TEG+</p>
              <p className={`text-[10px] font-medium mt-0.5 ${ls ? 'text-slate-400' : 'text-slate-500'}`}>ERP Sistema</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-150 group border
              ${ls
                ? `${colors.badgeBgLight} ${colors.badgeBorderLight} ${colors.badgeHoverBgLight} ${colors.badgeHoverBdLight}`
                : `${colors.badgeBgDark} ${colors.badgeBorderDark} ${colors.badgeHoverBgDark} ${colors.badgeHoverBdDark}`
              }`}
            title="Trocar módulo"
          >
            <span className="text-lg leading-none">{config.emoji}</span>
            <div className="flex-1 text-left">
              <p className={`text-xs font-bold leading-none ${ls ? colors.badgeTextLight : colors.badgeTextDark}`}>{config.name}</p>
              <p className={`text-[9px] mt-0.5 ${ls ? colors.badgeSubLight : colors.badgeSubDark}`}>Módulo ativo</p>
            </div>
            <LayoutGrid
              size={13}
              className={`transition-colors shrink-0 ${ls
                ? `${colors.badgeIconLight} ${colors.badgeIconHoverLight}`
                : `${colors.badgeIconDark} ${colors.badgeIconHoverDark}`}`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto styled-scrollbar">
          {visibleNav.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
              <Icon size={16} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}

          {config.showAdminLink && isAdmin && (
            <>
              <div className={`h-px mx-2 my-2 ${ls ? 'bg-slate-100' : 'bg-white/[0.05]'}`} />
              <NavLink
                to="/admin/usuarios"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                  transition-all duration-150 border
                  ${isActive
                    ? ls ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/12 text-amber-300 border-amber-500/25'
                    : ls ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-transparent' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border-transparent'
                  }`
                }
              >
                <Shield size={16} className="shrink-0" />
                <span>Administração</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Theme toggle */}
        <div className={`px-3 py-2 border-t ${ls ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <ThemeToggle variant={ls ? 'light' : 'dark'} />
        </div>

        {/* User card + logout */}
        <div className={`px-3 pb-4 pt-2 border-t ${ls ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <div className={`flex items-center gap-2.5 px-2 py-2.5 rounded-xl transition-colors ${ls ? 'hover:bg-slate-50' : 'hover:bg-white/4'}`}>
            <button
              onClick={() => navigate('/perfil')}
              className={`w-9 h-9 rounded-full flex items-center justify-center
                text-white text-xs font-extrabold shrink-0 ring-2
                transition-transform active:scale-90 ${avatarBg} ${ls ? 'ring-slate-200' : 'ring-white/10'}`}
              title="Ver perfil"
            >
              {initials}
            </button>

            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-semibold truncate leading-none ${ls ? 'text-slate-700' : 'text-slate-200'}`}>
                {firstName}
              </p>
              <span className={`text-[10px] font-medium mt-0.5 inline-block ${ROLE_COLOR[role].text}`}>
                {ROLE_LABEL[role]}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0
                ${ls ? 'bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50' : 'bg-white/5 text-slate-500 hover:text-red-400 hover:bg-red-400/10'}`}
              title="Sair"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <div className="lg:ml-64 flex flex-col min-h-screen">

        {/* Mobile header */}
        <header
          className={`lg:hidden px-4 py-3 sticky top-0 z-30 flex items-center gap-3
            ${ls ? 'bg-white border-b border-slate-200' : 'bg-[#0B1523] text-white'}`}
          style={{ boxShadow: ls ? '0 1px 3px rgba(0,0,0,0.05)' : '0 2px 20px rgba(0,0,0,0.4)' }}
        >
          <button onClick={() => navigate('/')} className="shrink-0" title="Trocar módulo">
            <LogoTeg size={30} animated={false} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <h1 className={`text-sm font-black leading-none ${ls ? 'text-slate-800' : 'text-white'}`}>TEG+</h1>
              <span className={`text-[9px] font-semibold ${ls ? colors.headerSubLight : colors.headerSubDark}`}>{config.name}</span>
            </div>
          </div>
          <button
            onClick={() => navigate('/perfil')}
            className={`w-8 h-8 rounded-full flex items-center justify-center
              text-white text-xs font-extrabold ring-2 shrink-0 transition-transform active:scale-90
              ${avatarBg} ${ls ? 'ring-slate-200' : 'ring-white/10'}`}
            title={`${nome} · ${ROLE_LABEL[role]}`}
          >
            {initials}
          </button>
          <button
            onClick={handleLogout}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0
              ${ls ? 'bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-slate-400 hover:text-white hover:bg-white/20'}`}
            title="Sair"
          >
            <LogOut size={13} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 pb-28 lg:pb-8">
          <div className={`${maxW} mx-auto`}>
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav
          className={`lg:hidden fixed bottom-0 inset-x-0 z-40 border-t
            ${ls ? 'glass-light border-slate-200' : 'glass-dark border-white/[0.06]'}`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex justify-around max-w-lg mx-auto px-1 py-1">
            {visibleNav.slice(0, mobileLimit).map(({ to, icon: Icon, label, end }) => (
              <NavLink key={to} to={to} end={end} className={bottomLinkClass}>
                <Icon className="w-5 h-5 mb-0.5" />
                {label.length > 8 ? label.slice(0, 8) + '.' : label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
