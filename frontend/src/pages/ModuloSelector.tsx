import { useNavigate } from 'react-router-dom'
import { ChevronRight, LogOut, Clock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from '../components/LogoTeg'
import BannerSlideshow from '../components/BannerSlideshow'
import ThemeToggle from '../components/ThemeToggle'

// ── Module definitions ─────────────────────────────────────────────────────────
// active=true → can be accessed now; active=false → "Em breve"
const MODULOS = [
  {
    key: 'compras',
    label: 'Compras',
    icon: '🛒',
    description: 'Requisições, cotações e aprovações',
    iconBg: 'bg-gradient-to-br from-teal-500/25 to-cyan-500/25',
    iconBgLight: 'bg-gradient-to-br from-teal-50 to-cyan-50',
    iconBorder: 'border-teal-500/50',
    iconBorderLight: 'border-teal-200',
    accentColor: 'rgba(20,184,166,0.2)',
    active: true,
    route: '/compras',
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    icon: '💰',
    description: 'Contas, aprovações e conciliação',
    iconBg: 'bg-gradient-to-br from-emerald-500/25 to-green-500/25',
    iconBgLight: 'bg-gradient-to-br from-emerald-50 to-green-50',
    iconBorder: 'border-emerald-500/50',
    iconBorderLight: 'border-emerald-200',
    accentColor: 'rgba(16,185,129,0.2)',
    active: true,
    route: '/financeiro',
  },
  {
    key: 'rh',
    label: 'Recursos Humanos',
    icon: '👥',
    description: 'Folha, colaboradores e férias',
    iconBg: 'bg-gradient-to-br from-violet-500/20 to-purple-500/20',
    iconBgLight: 'bg-gradient-to-br from-violet-50 to-purple-50',
    iconBorder: 'border-violet-500/30',
    iconBorderLight: 'border-violet-200',
    accentColor: 'rgba(139,92,246,0.15)',
    active: false,
    route: '/rh',
  },
  {
    key: 'ssma',
    label: 'SSMA',
    icon: '⛑️',
    description: 'Saúde, segurança e meio ambiente',
    iconBg: 'bg-gradient-to-br from-amber-500/20 to-orange-500/20',
    iconBgLight: 'bg-gradient-to-br from-amber-50 to-orange-50',
    iconBorder: 'border-amber-500/30',
    iconBorderLight: 'border-amber-200',
    accentColor: 'rgba(245,158,11,0.15)',
    active: false,
    route: '/ssma',
  },
  {
    key: 'estoque',
    label: 'Estoque',
    icon: '📦',
    description: 'Almoxarifado, inventário e patrimônio',
    iconBg: 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20',
    iconBgLight: 'bg-gradient-to-br from-blue-50 to-indigo-50',
    iconBorder: 'border-blue-500/30',
    iconBorderLight: 'border-blue-200',
    accentColor: 'rgba(99,102,241,0.15)',
    active: true,
    route: '/estoque',
  },
  {
    key: 'logistica',
    label: 'Logística',
    icon: '🚛',
    description: 'Transportes, NF-e e rastreamento',
    iconBg: 'bg-gradient-to-br from-orange-500/25 to-amber-500/25',
    iconBgLight: 'bg-gradient-to-br from-orange-50 to-amber-50',
    iconBorder: 'border-orange-500/50',
    iconBorderLight: 'border-orange-200',
    accentColor: 'rgba(234,88,12,0.2)',
    active: true,
    route: '/logistica',
  },
  {
    key: 'frotas',
    label: 'Frotas',
    icon: '🚗',
    description: 'Manutenção, checklist e telemetria',
    iconBg: 'bg-gradient-to-br from-rose-500/25 to-pink-500/25',
    iconBgLight: 'bg-gradient-to-br from-rose-50 to-pink-50',
    iconBorder: 'border-rose-500/50',
    iconBorderLight: 'border-rose-200',
    accentColor: 'rgba(244,63,94,0.2)',
    active: true,
    route: '/frotas',
  },
  {
    key: 'contratos',
    label: 'Contratos',
    icon: '📋',
    description: 'Gestão de contratos e SLAs',
    iconBg: 'bg-gradient-to-br from-slate-500/20 to-gray-500/20',
    iconBgLight: 'bg-gradient-to-br from-slate-50 to-gray-50',
    iconBorder: 'border-slate-500/30',
    iconBorderLight: 'border-slate-200',
    accentColor: 'rgba(100,116,139,0.15)',
    active: false,
    route: '/contratos',
  },
] as const

// ── Component ──────────────────────────────────────────────────────────────────
export default function ModuloSelector() {
  const { perfil, hasModule, signOut, isAdmin } = useAuth()
  const { isLightSidebar: isLight } = useTheme()
  const navigate = useNavigate()

  const primeiroNome = (perfil?.nome ?? 'Usuário').split(' ')[0]
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  function canAccess(mod: (typeof MODULOS)[number]) {
    if (!mod.active) {
      // Admin pode acessar RH para gerenciar o Mural de Recados
      return isAdmin && mod.key === 'rh'
    }
    // Módulos core: sempre acessíveis
    if (['compras', 'financeiro', 'estoque', 'logistica', 'frotas'].includes(mod.key as string)) return true
    return hasModule(mod.key as string)
  }

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  // ── Light theme variant ─────────────────────────────────────────────────────
  if (isLight) {
    return (
      <div className="min-h-screen bg-slate-50 relative overflow-x-hidden flex flex-col">

        {/* ── Header ────────────────────────────────────────────── */}
        <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 pt-6 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-teal-600 uppercase tracking-widest">
                TEG+ ERP
              </span>
            </div>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-medium text-slate-400">v2.0</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle variant="light" compact />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600
                transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-100"
            >
              <LogOut size={13} />
              Sair
            </button>
          </div>
        </header>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="relative z-10 flex flex-col items-center px-5 pt-10 pb-6">
          <div className="animate-fade-in delay-100 mb-5 rounded-[28px] p-3">
            <LogoTeg size={96} animated glowing={false} />
          </div>

          <h1 className="text-6xl font-black tracking-tighter text-gradient leading-none animate-fade-in-up delay-150">
            TEG+
          </h1>

          <p className="text-sm font-medium text-slate-400 mt-1.5 mb-5 animate-fade-in-up delay-200 tracking-wide">
            Enterprise Resource Planning
          </p>

          <div className="text-center animate-fade-in-up delay-250">
            <p className="text-slate-800 text-xl font-bold">
              {saudacao},{' '}
              <span className="text-gradient-teal">{primeiroNome}</span>
            </p>
            <p className="text-slate-400 text-sm mt-1">
              Selecione um módulo para acessar o sistema
            </p>
          </div>

          <div
            className="mt-6 w-32 h-px animate-fade-in delay-400"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.4), transparent)',
            }}
          />
        </section>

        {/* ── Banner Slideshow ──────────────────────────────────── */}
        <div className="relative z-10 pb-5">
          <BannerSlideshow />
        </div>

        {/* ── Module grid ──────────────────────────────────────── */}
        <section className="relative z-10 flex-1 px-4 sm:px-6 pb-10 max-w-2xl mx-auto w-full">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {MODULOS.map((mod, i) => {
              const accessible = canAccess(mod)
              const isCompras  = mod.key === 'compras'
              const isAdminRH  = isAdmin && mod.key === 'rh' && !mod.active
              const delay      = 340 + i * 75

              return (
                <button
                  key={mod.key}
                  onClick={() => accessible && navigate(mod.route)}
                  disabled={!accessible}
                  aria-label={`${accessible ? 'Acessar' : 'Em breve:'} ${mod.label}`}
                  className={[
                    'group relative rounded-2xl p-4 sm:p-5 text-left',
                    'bg-white border border-slate-200/80 shadow-card animate-scale-in',
                    'transition-all duration-250',
                    accessible
                      ? 'cursor-pointer hover:-translate-y-1 hover:shadow-card-md hover:border-teal-300'
                      : 'cursor-not-allowed opacity-50 pointer-events-none',
                    isCompras && accessible
                      ? 'border-teal-300 bg-teal-50/30 shadow-card-md'
                      : '',
                    isAdminRH
                      ? 'border-violet-200 bg-violet-50/30 opacity-100'
                      : '',
                  ].join(' ')}
                  style={{ animationDelay: `${delay}ms` }}
                >
                  {/* Admin-only badge */}
                  {isAdminRH && (
                    <div className="absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-600 border border-violet-200">
                      Admin
                    </div>
                  )}

                  {/* Icon container */}
                  <div
                    className={[
                      'w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3.5',
                      mod.iconBgLight,
                      `border ${mod.iconBorderLight}`,
                      'transition-transform duration-300',
                      accessible ? 'group-hover:scale-110' : '',
                    ].join(' ')}
                  >
                    {mod.icon}
                  </div>

                  {/* Label */}
                  <p className={`text-[13px] font-bold leading-tight mb-1 ${accessible ? 'text-slate-800' : 'text-slate-400'}`}>
                    {mod.label}
                  </p>

                  {/* Description / Em breve */}
                  <p className={`text-[10px] leading-snug ${accessible ? 'text-slate-500' : 'text-slate-400'}`}>
                    {accessible ? mod.description : 'Em breve'}
                  </p>

                  {/* Footer row */}
                  {accessible ? (
                    <div className="flex items-center justify-between mt-4">
                      {isCompras ? (
                        <span className="text-[9px] font-bold text-teal-600 bg-teal-100
                          px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Disponível
                        </span>
                      ) : isAdminRH ? (
                        <span className="text-[9px] font-semibold text-violet-500">Mural Admin</span>
                      ) : (
                        <span className="text-[9px] font-semibold text-slate-400">Acessar</span>
                      )}
                      <ChevronRight
                        size={13}
                        className={`transition-transform duration-200 group-hover:translate-x-0.5
                          ${isCompras ? 'text-teal-500' : isAdminRH ? 'text-violet-500' : 'text-slate-400'}`}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-4">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-[9px] text-slate-400 font-medium">Em desenvolvimento</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-400 mt-8 animate-fade-in delay-1000">
            Acesso restrito a colaboradores autorizados · TEG+ ERP v2.0
          </p>
        </section>
      </div>
    )
  }

  // ── Original / Dark theme variant (default) ─────────────────────────────────
  return (
    <div className="min-h-screen bg-[#060D1B] relative overflow-x-hidden flex flex-col">

      {/* ── Atmospheric glow layers ─────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(20,184,166,0.22) 0%, transparent 65%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 85% 85%, rgba(6,182,212,0.08) 0%, transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 40% 30% at 15% 70%, rgba(99,102,241,0.06) 0%, transparent 60%)',
        }}
      />

      {/* ── Grid pattern overlay ───────────────────────────────── */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-70" />

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 pt-6 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-teal-400/70 uppercase tracking-widest">
              TEG+ ERP
            </span>
          </div>
          <span className="text-slate-700">·</span>
          <span className="text-[11px] font-medium text-slate-500">v2.0</span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle variant="dark" compact />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300
              transition-colors py-1.5 px-3 rounded-lg hover:bg-white/5"
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center px-5 pt-10 pb-6">

        {/* Logo with glow ring */}
        <div
          className="animate-fade-in delay-100 mb-5 rounded-[28px] p-3"
          style={{ animation: 'fadeIn 0.6s ease-out both 0.1s, pulseGlow 3s ease-in-out infinite 0.8s' }}
        >
          <LogoTeg size={96} animated glowing={false} />
        </div>

        {/* Brand name */}
        <h1
          className="text-6xl font-black tracking-tighter text-gradient leading-none
            animate-fade-in-up delay-150"
        >
          TEG+
        </h1>

        <p className="text-sm font-medium text-slate-500 mt-1.5 mb-5 animate-fade-in-up delay-200 tracking-wide">
          Enterprise Resource Planning
        </p>

        {/* Greeting */}
        <div className="text-center animate-fade-in-up delay-250">
          <p className="text-white text-xl font-bold">
            {saudacao},{' '}
            <span className="text-gradient-teal">{primeiroNome}</span>
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Selecione um módulo para acessar o sistema
          </p>
        </div>

        {/* Divider */}
        <div
          className="mt-6 w-32 h-px animate-fade-in delay-400"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(20,184,166,0.5), transparent)',
          }}
        />
      </section>

      {/* ── Banner Slideshow — Comunicação Empresarial ──────────── */}
      <div className="relative z-10 pb-5">
        <BannerSlideshow />
      </div>

      {/* ── Module grid ──────────────────────────────────────── */}
      <section className="relative z-10 flex-1 px-4 sm:px-6 pb-10 max-w-2xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {MODULOS.map((mod, i) => {
            const accessible = canAccess(mod)
            const isCompras  = mod.key === 'compras'
            const isAdminRH  = isAdmin && mod.key === 'rh' && !mod.active
            const delay      = 340 + i * 75

            return (
              <button
                key={mod.key}
                onClick={() => accessible && navigate(mod.route)}
                disabled={!accessible}
                aria-label={`${accessible ? 'Acessar' : 'Em breve:'} ${mod.label}`}
                className={[
                  'group relative rounded-2xl p-4 sm:p-5 text-left',
                  'glass-card animate-scale-in',
                  accessible
                    ? 'cursor-pointer hover:-translate-y-1 hover:shadow-glow-card hover:bg-teal-500/10 hover:border-teal-500/40'
                    : 'cursor-not-allowed opacity-40 pointer-events-none',
                  isCompras && accessible
                    ? 'border-teal-500/40 bg-teal-500/[0.06]'
                    : '',
                  isAdminRH
                    ? 'border-violet-500/30 bg-violet-500/[0.04] opacity-100'
                    : '',
                ].join(' ')}
                style={{ animationDelay: `${delay}ms` }}
              >
                {/* Featured glow ring for active module */}
                {isCompras && accessible && (
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                      boxShadow: '0 0 28px rgba(20,184,166,0.18), inset 0 1px 0 rgba(20,184,166,0.25)',
                    }}
                  />
                )}

                {/* Admin-only badge */}
                {isAdminRH && (
                  <div className="absolute top-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/25">
                    Admin
                  </div>
                )}

                {/* Icon container */}
                <div
                  className={[
                    'w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3.5',
                    mod.iconBg,
                    `border ${mod.iconBorder}`,
                    'transition-transform duration-300',
                    accessible ? 'group-hover:scale-110' : '',
                  ].join(' ')}
                >
                  {mod.icon}
                </div>

                {/* Label */}
                <p
                  className={`text-[13px] font-bold leading-tight mb-1 ${
                    accessible ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {mod.label}
                </p>

                {/* Description / Em breve */}
                <p
                  className={`text-[10px] leading-snug ${
                    accessible ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  {accessible ? mod.description : 'Em breve'}
                </p>

                {/* Footer row */}
                {accessible ? (
                  <div className="flex items-center justify-between mt-4">
                    {isCompras ? (
                      <span className="text-[9px] font-bold text-teal-400 bg-teal-400/15
                        px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Disponível
                      </span>
                    ) : isAdminRH ? (
                      <span className="text-[9px] font-semibold text-violet-400">Mural Admin</span>
                    ) : (
                      <span className="text-[9px] font-semibold text-slate-500">Acessar</span>
                    )}
                    <ChevronRight
                      size={13}
                      className={`transition-transform duration-200 group-hover:translate-x-0.5
                        ${isCompras ? 'text-teal-400' : isAdminRH ? 'text-violet-400' : 'text-slate-500'}`}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-4">
                    <Clock size={10} className="text-slate-600" />
                    <span className="text-[9px] text-slate-600 font-medium">Em desenvolvimento</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-700 mt-8 animate-fade-in delay-1000">
          Acesso restrito a colaboradores autorizados · TEG+ ERP v2.0
        </p>
      </section>
    </div>
  )
}
