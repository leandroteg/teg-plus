import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Car, Wrench, ClipboardCheck,
  Fuel, Radio, ChevronLeft, Menu, X, Settings,
} from 'lucide-react'
import { useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import ThemeToggle from './ThemeToggle'

const NAV = [
  { to: '/frotas',              label: 'Painel',          icon: LayoutDashboard, end: true },
  { to: '/frotas/veiculos',     label: 'Veículos',        icon: Car },
  { to: '/frotas/ordens',       label: 'Ordens de Serviço', icon: Wrench },
  { to: '/frotas/checklists',   label: 'Checklists',      icon: ClipboardCheck },
  { to: '/frotas/abastecimentos', label: 'Abastecimentos', icon: Fuel },
  { to: '/frotas/telemetria',   label: 'Telemetria',      icon: Radio },
]

export default function FrotasLayout() {
  const navigate = useNavigate()
  const { isDark, isLightSidebar } = useTheme()
  const [open, setOpen] = useState(false)
  const ls = isLightSidebar

  function navLinkClass(isActive: boolean) {
    const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border'
    if (isActive)
      return `${base} ${ls ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-500/15 text-rose-300 border-rose-500/25'}`
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
              ? 'bg-rose-50 border-rose-200 hover:bg-rose-100'
              : 'bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15'
            }`}
        >
          <span className="text-lg leading-none">🚗</span>
          <div className="text-left">
            <p className={`text-[11px] font-bold leading-none ${ls ? 'text-rose-700' : 'text-rose-300'}`}>Frotas</p>
            <p className={`text-[9px] mt-0.5 ${ls ? 'text-rose-500/60' : 'text-rose-300/50'}`}>Manutenção & Uso</p>
          </div>
          <ChevronLeft size={12} className={`ml-auto ${ls ? 'text-rose-400' : 'text-rose-300/50'}`} />
        </button>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}

          {/* Cadastros (Master Data) */}
          <div className={`h-px mx-1 my-2 ${ls ? 'bg-slate-100' : 'bg-white/5'}`} />
          <NavLink
            to="/cadastros"
            className={({ isActive }) => navLinkClass(isActive)}
          >
            <Settings size={16} />
            Cadastros
          </NavLink>
        </nav>

        {/* Theme toggle + Footer */}
        <div className="mt-auto space-y-3">
          <ThemeToggle variant={ls ? 'light' : 'dark'} compact />
          <div className={`pt-4 border-t ${ls ? 'border-slate-100' : 'border-white/5'}`}>
            <p className={`text-[10px] text-center ${ls ? 'text-slate-400' : 'text-slate-600'}`}>TEG+ ERP · Frotas</p>
          </div>
        </div>
      </aside>

      {/* ── Mobile Header ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className={`md:hidden flex items-center justify-between px-4 py-3 border-b
          ${ls
            ? 'bg-white border-slate-200'
            : 'border-white/6 bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🚗</span>
            <span className={`text-xs font-semibold uppercase tracking-widest ${ls ? 'text-rose-500' : 'text-rose-400/70'}`}>Frotas</span>
          </div>
          <button onClick={() => setOpen(o => !o)} className={`${ls ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile drawer */}
        {open && (
          <nav className={`md:hidden flex flex-col gap-1 p-4 border-b
            ${ls ? 'bg-white border-slate-200' : 'border-white/6 bg-white/[0.03]'}`}>
            {NAV.map(n => (
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
              Cadastros
            </NavLink>
          </nav>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto styled-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
