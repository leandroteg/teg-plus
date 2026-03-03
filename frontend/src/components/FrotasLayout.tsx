import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Car, Wrench, ClipboardCheck,
  Fuel, Radio, ChevronLeft, Menu, X,
} from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { to: '/frotas',              label: 'Painel',          icon: LayoutDashboard, end: true },
  { to: '/frotas/veiculos',     label: 'Veículos',        icon: Car },
  { to: '/frotas/ordens',       label: 'Ordens de Serviço', icon: Wrench },
  { to: '/frotas/checklists',   label: 'Checklists',      icon: ClipboardCheck },
  { to: '/frotas/abastecimentos', label: 'Abastecimentos', icon: Fuel },
  { to: '/frotas/telemetria',   label: 'Telemetria',      icon: Radio },
]

function NavItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: React.ElementType; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border',
          isActive
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
            : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5',
        ].join(' ')
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  )
}

export default function FrotasLayout() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#060D1B] overflow-hidden">

      {/* ── Desktop Sidebar ──────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-white/6 bg-white/[0.02] p-4 gap-2">

        {/* Module badge */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl
            bg-rose-500/10 border border-rose-500/25 mb-2
            hover:bg-rose-500/15 transition-colors"
        >
          <span className="text-lg leading-none">🚗</span>
          <div className="text-left">
            <p className="text-[11px] font-bold text-rose-300 leading-none">Frotas</p>
            <p className="text-[9px] text-rose-300/50 mt-0.5">Manutenção & Uso</p>
          </div>
          <ChevronLeft size={12} className="ml-auto text-rose-300/50" />
        </button>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {NAV.map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        {/* Footer */}
        <div className="mt-auto pt-4 border-t border-white/5">
          <p className="text-[10px] text-slate-600 text-center">TEG+ ERP · Frotas</p>
        </div>
      </aside>

      {/* ── Mobile Header ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/6 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="text-base">🚗</span>
            <span className="text-xs font-semibold text-rose-400/70 uppercase tracking-widest">Frotas</span>
          </div>
          <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-white">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile drawer */}
        {open && (
          <nav className="md:hidden flex flex-col gap-1 p-4 border-b border-white/6 bg-white/[0.03]">
            {NAV.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border',
                    isActive
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/25'
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5',
                  ].join(' ')
                }
              >
                <n.icon size={16} />
                {n.label}
              </NavLink>
            ))}
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
