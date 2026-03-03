import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Landmark, FileCheck2,
  BarChart3, Users, LogOut, LayoutGrid, DollarSign,
} from 'lucide-react'
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '../contexts/AuthContext'
import LogoTeg from './LogoTeg'

const NAV = [
  { to: '/financeiro',            icon: LayoutDashboard, label: 'Painel',        end: true  },
  { to: '/financeiro/cp',         icon: Receipt,         label: 'Contas a Pagar', end: false },
  { to: '/financeiro/cr',         icon: DollarSign,      label: 'A Receber',     end: false },
  { to: '/financeiro/aprovacoes', icon: FileCheck2,      label: 'Aprovações',    end: false },
  { to: '/financeiro/conciliacao',icon: Landmark,        label: 'Conciliação',   end: false },
  { to: '/financeiro/relatorios', icon: BarChart3,       label: 'Relatórios',    end: false },
  { to: '/financeiro/fornecedores', icon: Users,         label: 'Fornecedores',  end: false },
]

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-blue-500', 'bg-cyan-500',
  'bg-teal-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
]

function getAvatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function FinanceiroLayout() {
  const { perfil, signOut, role } = useAuth()
  const navigate = useNavigate()

  const nome      = perfil?.nome ?? 'Usuário'
  const initials  = getInitials(nome)
  const avatarBg  = getAvatarColor(nome)
  const firstName = nome.split(' ')[0]

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function sidebarLinkClass({ isActive }: { isActive: boolean }) {
    const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 border'
    if (isActive)
      return `${base} bg-emerald-500/15 text-emerald-300 border-emerald-500/25`
    return `${base} text-slate-400 hover:text-slate-100 hover:bg-white/6 border-transparent`
  }

  function bottomLinkClass({ isActive }: { isActive: boolean }) {
    const base = 'flex flex-col items-center py-2 px-1.5 rounded-xl text-[9px] font-semibold transition-all duration-150 min-w-[40px]'
    if (isActive)
      return `${base} text-emerald-400 bg-emerald-400/10`
    return `${base} text-slate-500 hover:text-slate-300`
  }

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── DESKTOP SIDEBAR ────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-[#0B1523] z-40"
        style={{ boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}
      >
        <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3 mb-4">
            <LogoTeg size={38} animated={false} />
            <div>
              <p className="text-white font-black text-lg tracking-tight leading-none">TEG+</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">ERP Sistema</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25
              rounded-xl px-3 py-2.5 hover:bg-emerald-500/18 hover:border-emerald-500/40
              transition-all duration-150 group"
            title="Trocar módulo"
          >
            <span className="text-lg leading-none">💰</span>
            <div className="flex-1 text-left">
              <p className="text-xs font-bold text-emerald-300 leading-none">Financeiro</p>
              <p className="text-[9px] text-emerald-500/60 mt-0.5">Módulo ativo</p>
            </div>
            <LayoutGrid
              size={13}
              className="text-emerald-500/50 group-hover:text-emerald-400 transition-colors shrink-0"
            />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto styled-scrollbar">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
              <Icon size={16} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl hover:bg-white/4 transition-colors">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center
              text-white text-xs font-extrabold shrink-0 ring-2 ring-white/10 ${avatarBg}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-200 truncate leading-none">
                {firstName}
              </p>
              <span className={`text-[10px] font-medium mt-0.5 inline-block ${ROLE_COLOR[role].text}`}>
                {ROLE_LABEL[role]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center
                text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
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
          className="lg:hidden bg-[#0B1523] text-white px-4 py-3 sticky top-0 z-30
            flex items-center gap-3"
          style={{ boxShadow: '0 2px 20px rgba(0,0,0,0.4)' }}
        >
          <button onClick={() => navigate('/')} className="shrink-0" title="Trocar módulo">
            <LogoTeg size={30} animated={false} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <h1 className="text-sm font-black text-white leading-none">TEG+</h1>
              <span className="text-[9px] text-emerald-400/70 font-semibold">Financeiro</span>
            </div>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center
            text-white text-xs font-extrabold ring-2 ring-white/10 ${avatarBg}`}>
            {initials}
          </div>
          <button onClick={handleLogout}
            className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center
              text-slate-400 hover:text-white hover:bg-white/20 transition-all shrink-0">
            <LogOut size={13} />
          </button>
        </header>

        <main className="flex-1 px-4 py-5 pb-28 lg:pb-8">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-dark border-t border-white/[0.06]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-around max-w-lg mx-auto px-1 py-1">
            {NAV.slice(0, 6).map(({ to, icon: Icon, label, end }) => (
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
