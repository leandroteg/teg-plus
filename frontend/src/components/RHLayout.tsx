// ─────────────────────────────────────────────────────────────────────────────
// components/RHLayout.tsx — Layout do Módulo RH (Violet theme)
// ─────────────────────────────────────────────────────────────────────────────
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ImagePlay, ChevronLeft, Menu, X, Shield, Settings } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import ThemeToggle from './ThemeToggle'

interface NavEntry {
  to: string
  label: string
  icon: React.ElementType
  end?: boolean
  adminOnly?: boolean
}

const NAV: NavEntry[] = [
  { to: '/rh',       label: 'Painel',         icon: LayoutDashboard, end: true },
  { to: '/rh/mural', label: 'Mural de Recados', icon: ImagePlay, adminOnly: true },
]

export default function RHLayout() {
  const navigate      = useNavigate()
  const { isAdmin }   = useAuth()
  const { isDark, isLightSidebar } = useTheme()
  const [open, setOpen] = useState(false)
  const ls = isLightSidebar

  const visibleNav = NAV.filter(n => !n.adminOnly || isAdmin)

  function navLinkClass(isActive: boolean) {
    const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border'
    if (isActive)
      return `${base} ${ls ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-violet-500/15 text-violet-300 border-violet-500/25'}`
    return `${base} ${ls ? 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'}`
  }

  return (
    <div className={`flex h-screen overflow-hidden ${
      ls ? 'bg-slate-50' : isDark ? 'bg-[#0c1222]' : 'bg-[#060D1B]'
    }`}>

      {/* ── Desktop Sidebar ──────────────────────────────────── */}
      <aside className={`hidden md:flex flex-col w-56 shrink-0 p-4 gap-2
        ${ls
          ? 'bg-white border-r border-slate-200/80'
          : 'border-r border-white/6 bg-white/[0.02]'
        }`}
      >
        {/* Module badge */}
        <button
          onClick={() => navigate('/')}
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2 transition-colors border
            ${ls
              ? 'bg-violet-50 border-violet-200 hover:bg-violet-100'
              : 'bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15'
            }`}
        >
          <span className="text-lg leading-none">👥</span>
          <div className="text-left">
            <p className={`text-[11px] font-bold leading-none ${ls ? 'text-violet-700' : 'text-violet-300'}`}>Recursos Humanos</p>
            <p className={`text-[9px] mt-0.5 ${ls ? 'text-violet-500/60' : 'text-violet-300/50'}`}>Pessoas & Organização</p>
          </div>
          <ChevronLeft size={12} className={`ml-auto ${ls ? 'text-violet-400' : 'text-violet-300/50'}`} />
        </button>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {visibleNav.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <n.icon size={16} />
              <span className="flex-1">{n.label}</span>
              {n.adminOnly && (
                <Shield size={10} className={`shrink-0 ${ls ? 'text-violet-300' : 'text-violet-400/50'}`} />
              )}
            </NavLink>
          ))}

          {/* Cadastros (Master Data) */}
          <div className={`h-px mx-1 my-2 ${ls ? 'bg-slate-100' : 'bg-white/5'}`} />
          <NavLink
            to="/cadastros"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <Settings size={16} />
            <span className="flex-1">Cadastros</span>
          </NavLink>
        </nav>

        {/* Theme toggle + Footer */}
        <div className="mt-auto space-y-3">
          <ThemeToggle variant={ls ? 'light' : 'dark'} compact />
          <div className={`pt-4 border-t ${ls ? 'border-slate-100' : 'border-white/5'}`}>
            <p className={`text-[10px] text-center ${ls ? 'text-slate-400' : 'text-slate-600'}`}>TEG+ ERP · RH</p>
          </div>
        </div>
      </aside>

      {/* ── Mobile ───────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className={`md:hidden flex items-center justify-between px-4 py-3 border-b
          ${ls
            ? 'bg-white border-slate-200'
            : 'border-white/6 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">👥</span>
            <span className={`text-xs font-semibold uppercase tracking-widest ${ls ? 'text-violet-500' : 'text-violet-400/70'}`}>RH</span>
          </div>
          <button onClick={() => setOpen(o => !o)} className={`${ls ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {open && (
          <nav className={`md:hidden flex flex-col gap-1 p-4 border-b
            ${ls ? 'bg-white border-slate-200' : 'border-white/6 bg-white/[0.03]'}`}>
            {visibleNav.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => navLinkClass(isActive)}
              >
                <n.icon size={16} />
                {n.label}
              </NavLink>
            ))}
            <div className={`h-px mx-1 my-1 ${ls ? 'bg-slate-100' : 'bg-white/5'}`} />
            <NavLink
              to="/cadastros"
              onClick={() => setOpen(false)}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <Settings size={16} />
              <span className="flex-1">Cadastros</span>
            </NavLink>
          </nav>
        )}

        <main className="flex-1 overflow-y-auto styled-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
