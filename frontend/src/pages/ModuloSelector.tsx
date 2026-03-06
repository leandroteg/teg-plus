import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, X, Lock, Megaphone,
  // Category icons
  FolderKanban, Layers, Wallet, Users, Monitor, Rocket,
  // Sub-module icons
  Settings, HardHat, ShieldCheck, ShoppingCart, Truck,
  Package, Building2, Car, Banknote, BarChart3, FileText,
  UserCog, Server, Bot, Target, Store, Receipt,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from '../components/LogoTeg'
import MuralPopup from '../components/MuralPopup'
import ThemeToggle from '../components/ThemeToggle'

// ═══════════════════════════════════════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface SubMod {
  key: string
  label: string
  desc: string
  Icon: LucideIcon
  active: boolean
  route: string
  adminOnly?: boolean
}

interface Pillar {
  key: string
  label: string
  tagline: string
  Icon: LucideIcon
  grad: string
  border: string
  glow: string
  accent: string
  subs: SubMod[]
}

const PILLARS: Pillar[] = [
  {
    key: 'projetos',
    label: 'Projetos',
    tagline: 'Gestão de obras e segurança',
    Icon: FolderKanban,
    grad: 'from-blue-500/20 to-indigo-600/20',
    border: 'border-indigo-500/25',
    glow: 'rgba(99,102,241,0.18)',
    accent: '#818CF8',
    subs: [
      { key: 'gestao', label: 'Gestão', desc: 'PMO e planejamento de projetos', Icon: Settings, active: false, route: '' },
      { key: 'obras', label: 'Obras', desc: 'Acompanhamento de obras ativas', Icon: HardHat, active: false, route: '' },
      { key: 'ssma', label: 'SS/MA', desc: 'Saúde, segurança e meio ambiente', Icon: ShieldCheck, active: false, route: '/ssma' },
    ],
  },
  {
    key: 'suprimentos',
    label: 'Suprimentos',
    tagline: 'Cadeia completa de abastecimento',
    Icon: Layers,
    grad: 'from-teal-500/25 to-cyan-500/25',
    border: 'border-teal-500/35',
    glow: 'rgba(20,184,166,0.22)',
    accent: '#2DD4BF',
    subs: [
      { key: 'compras', label: 'Compras', desc: 'Requisições, cotações e pedidos', Icon: ShoppingCart, active: true, route: '/compras' },
      { key: 'logistica', label: 'Logística', desc: 'Transportes e expedição', Icon: Truck, active: true, route: '/logistica' },
      { key: 'estoque', label: 'Estoque', desc: 'Almoxarifado e inventário', Icon: Package, active: true, route: '/estoque' },
      { key: 'patrimonial', label: 'Patrimonial', desc: 'Ativos e depreciação', Icon: Building2, active: true, route: '/estoque/patrimonial' },
      { key: 'frotas', label: 'Frotas', desc: 'Veículos, OS e telemetria', Icon: Car, active: true, route: '/frotas' },
    ],
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    tagline: 'Finanças e controladoria',
    Icon: Wallet,
    grad: 'from-emerald-500/20 to-green-600/20',
    border: 'border-emerald-500/25',
    glow: 'rgba(16,185,129,0.18)',
    accent: '#34D399',
    subs: [
      { key: 'tesouraria', label: 'Tesouraria', desc: 'Contas, aprovações e conciliação', Icon: Banknote, active: true, route: '/financeiro' },
      { key: 'fiscal', label: 'Fiscal', desc: 'Notas fiscais e créditos PIS/COFINS', Icon: Receipt, active: true, route: '/fiscal' },
      { key: 'controladoria', label: 'Controladoria', desc: 'Indicadores e relatórios gerenciais', Icon: BarChart3, active: false, route: '' },
      { key: 'contratos', label: 'Contratos', desc: 'Gestão de contratos e SLAs', Icon: FileText, active: true, route: '/contratos' },
    ],
  },
  {
    key: 'hr',
    label: 'HR',
    tagline: 'Pessoas e departamento pessoal',
    Icon: Users,
    grad: 'from-violet-500/20 to-purple-600/20',
    border: 'border-violet-500/25',
    glow: 'rgba(139,92,246,0.16)',
    accent: '#A78BFA',
    subs: [
      { key: 'rh', label: 'Recursos Humanos', desc: 'Colaboradores, férias e mural', Icon: UserCog, active: false, route: '/rh', adminOnly: true },
      { key: 'dp', label: 'Depto. Pessoal', desc: 'Folha, ponto e benefícios', Icon: Users, active: false, route: '' },
    ],
  },
  {
    key: 'it',
    label: 'IT',
    tagline: 'Tecnologia e inteligência artificial',
    Icon: Monitor,
    grad: 'from-sky-500/20 to-blue-600/20',
    border: 'border-sky-500/25',
    glow: 'rgba(14,165,233,0.16)',
    accent: '#38BDF8',
    subs: [
      { key: 'ti', label: 'TI', desc: 'Infraestrutura e suporte técnico', Icon: Server, active: false, route: '' },
      { key: 'ai', label: 'AI Agents', desc: 'Agentes inteligentes TEG+', Icon: Bot, active: false, route: '' },
    ],
  },
  {
    key: 'expansao',
    label: 'Expansão',
    tagline: 'Crescimento e novos negócios',
    Icon: Rocket,
    grad: 'from-amber-500/20 to-orange-600/20',
    border: 'border-amber-500/25',
    glow: 'rgba(245,158,11,0.16)',
    accent: '#FBBF24',
    subs: [
      { key: 'estrategico', label: 'Estratégico', desc: 'Planejamento e metas corporativas', Icon: Target, active: false, route: '' },
      { key: 'comercial', label: 'Comercial', desc: 'Vendas e relacionamento', Icon: Store, active: false, route: '' },
    ],
  },
]

// Brand accent for the main mandala
const BRAND = {
  accent: '#2DD4BF',
  glow: 'rgba(20,184,166,0.22)',
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ModuloSelector() {
  const { perfil, isAdmin, signOut } = useAuth()
  const { isLightSidebar: isLight } = useTheme()
  const navigate = useNavigate()
  const [openPillar, setOpenPillar] = useState<Pillar | null>(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [entered, setEntered] = useState(false)
  const [muralOpen, setMuralOpen] = useState(false)

  const primeiroNome = (perfil?.nome ?? 'Usuário').split(' ')[0]
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  // Staggered entrance for main mandala
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 250)
    return () => clearTimeout(t)
  }, [])

  // Auto-open Mural popup (once per session, all devices)
  useEffect(() => {
    const alreadyShown = sessionStorage.getItem('mural_auto_shown')
    if (!alreadyShown) {
      const t = setTimeout(() => {
        setMuralOpen(true)
        sessionStorage.setItem('mural_auto_shown', '1')
      }, 800) // small delay so mandala animates first
      return () => clearTimeout(t)
    }
  }, [])

  function canAccessSub(sub: SubMod) {
    if (sub.adminOnly && isAdmin) return true
    return sub.active
  }

  function activeCount(p: Pillar) {
    return p.subs.filter(s => canAccessSub(s)).length
  }

  function handleOpenPillar(p: Pillar) {
    setOpenPillar(p)
    requestAnimationFrame(() => setOverlayVisible(true))
  }

  function handleClosePillar() {
    setOverlayVisible(false)
    setTimeout(() => setOpenPillar(null), 320)
  }

  function handleNav(route: string) {
    if (route) navigate(route)
  }

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && openPillar) handleClosePillar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Lock body scroll when overlay is open
  useEffect(() => {
    if (openPillar) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [openPillar])

  // ── Main mandala geometry ───────────────────────────────────
  const R = 178
  const SIZE = R * 2 + 200
  const cx = SIZE / 2
  const cy = SIZE / 2

  return (
    <div className={`min-h-screen relative overflow-x-hidden flex flex-col ${isLight ? 'bg-slate-50' : 'bg-[#060D1B]'}`}>

      {/* ── Atmospheric glow layers (dark only) ────────────────── */}
      {!isLight && (
        <>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(20,184,166,0.18) 0%, transparent 65%)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 50% 40% at 85% 85%, rgba(6,182,212,0.06) 0%, transparent 60%)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 40% 30% at 15% 70%, rgba(99,102,241,0.05) 0%, transparent 60%)' }} />
          <div className="absolute inset-0 grid-pattern pointer-events-none opacity-60" />
        </>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-8 pt-5 animate-fade-in">
        <div className="flex items-center gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLight ? 'bg-teal-500' : 'bg-teal-400'}`} />
          <span className={`text-[11px] font-semibold uppercase tracking-widest ${isLight ? 'text-teal-600' : 'text-teal-400/70'}`}>TEG+ ERP</span>
          <span className={isLight ? 'text-slate-300' : 'text-slate-700'}>·</span>
          <span className={`text-[11px] font-medium ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>v2.0</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mural button */}
          <button
            onClick={() => setMuralOpen(true)}
            className={`relative flex items-center gap-1.5 text-xs transition-colors py-1.5 px-2.5 rounded-lg ${
              isLight
                ? 'text-teal-600 hover:bg-teal-50'
                : 'text-teal-400 hover:bg-teal-500/10'
            }`}
          >
            <Megaphone size={14} />
            <span className="hidden sm:inline text-[11px] font-semibold">Mural</span>
            {/* Notification dot */}
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          </button>

          {/* Greeting */}
          <p className={`text-sm font-semibold hidden sm:block ${isLight ? 'text-slate-700' : 'text-white/90'}`}>
            {saudacao}, <span className="text-gradient-teal">{primeiroNome}</span>
          </p>
          <span className={`hidden sm:block w-px h-4 ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />
          <ThemeToggle variant={isLight ? 'light' : 'dark'} compact />
          <button
            onClick={handleLogout}
            className={`flex items-center gap-1.5 text-xs transition-colors py-1.5 px-3 rounded-lg ${
              isLight
                ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            <LogOut size={13} />
            Sair
          </button>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────── */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2 sm:py-8 lg:py-4">

        {/* Mobile greeting (hidden on sm+) */}
        <p className={`text-sm font-semibold mb-1 sm:hidden ${isLight ? 'text-slate-700' : 'text-white/90'}`}>
          {saudacao}, <span className="text-gradient-teal">{primeiroNome}</span>
        </p>

        {/* Mandala container with responsive scaling */}
        <div
          className="relative origin-center scale-[0.78] sm:scale-[0.82] md:scale-[0.88] lg:scale-100 xl:scale-105"
          style={{ width: SIZE, height: SIZE }}
        >
          {/* Slow rotating decorative conic gradient */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              left: cx - R - 60,
              top: cy - R - 60,
              width: (R + 60) * 2,
              height: (R + 60) * 2,
              background: `conic-gradient(from 0deg, ${BRAND.accent}06, transparent 25%, ${BRAND.accent}04, transparent 50%, ${BRAND.accent}06, transparent 75%)`,
              opacity: entered ? 1 : 0,
              animation: entered ? 'spin 60s linear infinite' : 'none',
              transition: 'opacity 1s ease',
            }}
          />

          {/* SVG decorative elements */}
          <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
            {/* Outer decorative ring */}
            <circle
              cx={cx} cy={cy} r={R + 50}
              fill="none" stroke={BRAND.accent}
              strokeWidth="0.4" strokeDasharray="4 12"
              opacity={entered ? 0.15 : 0}
              style={{ transition: 'opacity 0.8s ease 0.1s' }}
            />

            {/* Orbital ring */}
            <circle
              cx={cx} cy={cy} r={R}
              fill="none" stroke={BRAND.accent}
              strokeWidth="0.4" strokeDasharray="2 6"
              opacity={entered ? 0.1 : 0}
              style={{ transition: 'opacity 0.8s ease 0.2s' }}
            />

            {/* Inner decorative ring */}
            <circle
              cx={cx} cy={cy} r={R * 0.45}
              fill="none" stroke={BRAND.accent}
              strokeWidth="0.3"
              opacity={entered ? 0.06 : 0}
              style={{ transition: 'opacity 0.8s ease 0.3s' }}
            />

            {/* Connecting lines from center to each pillar + midpoint dots */}
            {PILLARS.map((p, i) => {
              const angle = (-90 + (360 / 6) * i) * (Math.PI / 180)
              const ex = cx + R * Math.cos(angle)
              const ey = cy + R * Math.sin(angle)
              const mx = (cx + ex) / 2
              const my = (cy + ey) / 2

              return (
                <g key={i}>
                  <line
                    x1={cx} y1={cy} x2={ex} y2={ey}
                    stroke={p.accent} strokeWidth="1" strokeDasharray="4 6"
                    opacity={entered ? (isLight ? 0.2 : 0.14) : 0}
                    style={{ transition: `opacity 0.5s ease ${300 + i * 80}ms` }}
                  />
                  {/* Midpoint energy dot */}
                  <circle
                    cx={mx} cy={my} r="3"
                    fill={p.accent}
                    opacity={entered ? (isLight ? 0.35 : 0.25) : 0}
                    style={{ transition: `opacity 0.4s ease ${450 + i * 80}ms` }}
                  />
                </g>
              )
            })}
          </svg>

          {/* ── Center node: Logo TEG+ ──────────────────────────── */}
          <div
            className="absolute z-10"
            style={{
              left: cx - 42,
              top: cy - 42,
              width: 84,
              height: 84,
            }}
          >
            <div
              className="w-full h-full rounded-full flex items-center justify-center border"
              style={{
                background: isLight
                  ? 'radial-gradient(circle, rgba(20,184,166,0.08), rgba(255,255,255,0.95))'
                  : `radial-gradient(circle, ${BRAND.glow}, rgba(6,15,28,0.92))`,
                borderColor: BRAND.accent + '40',
                boxShadow: entered
                  ? `0 0 40px ${BRAND.glow}, 0 0 80px ${BRAND.glow}`
                  : 'none',
                transform: entered ? 'scale(1)' : 'scale(0)',
                transition: 'transform 0.6s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.8s ease',
              }}
            >
              <LogoTeg size={48} animated={false} glowing={false} />
            </div>
          </div>

          {/* ── Orbital pillar nodes ────────────────────────────── */}
          {PILLARS.map((p, i) => {
            const angle = (-90 + (360 / 6) * i) * (Math.PI / 180)
            const x = R * Math.cos(angle)
            const y = R * Math.sin(angle)
            const active = activeCount(p)
            const total = p.subs.length
            const hasActive = active > 0

            return (
              <button
                key={p.key}
                onClick={() => handleOpenPillar(p)}
                className="absolute z-20 group"
                style={{
                  left: cx,
                  top: cy,
                  transform: entered
                    ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                    : 'translate(-50%, -50%) scale(0)',
                  transition: `transform 0.5s cubic-bezier(0.175,0.885,0.32,1.275) ${350 + i * 90}ms`,
                }}
              >
                <div className="flex flex-col items-center gap-1.5 cursor-pointer">
                  {/* Pillar icon node */}
                  <div
                    className={[
                      'rounded-2xl flex items-center justify-center border transition-all duration-250',
                      isLight
                        ? 'bg-white shadow-card group-hover:shadow-card-md group-hover:scale-110 group-hover:-translate-y-1'
                        : 'glass-card group-hover:scale-110 group-hover:-translate-y-1',
                    ].join(' ')}
                    style={{
                      width: 68,
                      height: 68,
                      borderColor: isLight ? undefined : p.accent + '30',
                      boxShadow: !isLight
                        ? `0 0 24px ${p.glow}, 0 0 48px ${p.glow.replace(/[\d.]+\)$/, '0.06)')}`
                        : undefined,
                    }}
                  >
                    <p.Icon size={28} style={{ color: p.accent }} />
                  </div>

                  {/* Pillar label */}
                  <span className={`text-[13px] font-bold whitespace-nowrap leading-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    {p.label}
                  </span>

                  {/* Active count badge */}
                  {hasActive ? (
                    <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: p.accent }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.accent }} />
                      {active}/{total}
                    </span>
                  ) : (
                    <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
                      <Lock size={9} /> Em breve
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Subtitle below mandala */}
        <p className={`text-[11px] font-medium tracking-wide mt-2 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
          Selecione uma área para acessar
        </p>
      </section>

      {/* Footer */}
      <p className={`relative z-10 text-center text-[10px] pb-4 ${isLight ? 'text-slate-400' : 'text-slate-700'}`}>
        Acesso restrito a colaboradores autorizados · TEG+ ERP v2.0
      </p>

      {/* ── Mural Popup (mobile: bottom-sheet · desktop: centered modal) ── */}
      <MuralPopup open={muralOpen} onClose={() => setMuralOpen(false)} />

      {/* ── Category Overlay — Sub-module Mandala ────────────────── */}
      {openPillar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) handleClosePillar() }}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 transition-opacity duration-300"
            style={{
              background: isLight ? 'rgba(241,245,249,0.92)' : 'rgba(6,13,27,0.88)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              opacity: overlayVisible ? 1 : 0,
            }}
          />

          {/* Panel */}
          <div
            className={`relative z-10 w-full max-w-2xl mx-4 my-auto rounded-3xl overflow-visible border ${
              isLight ? 'border-slate-200/80' : 'border-white/10'
            }`}
            style={{
              background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(9,15,28,0.94)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              opacity: overlayVisible ? 1 : 0,
              transform: overlayVisible ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(20px)',
              transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.175,0.885,0.32,1.275)',
            }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${openPillar.grad} border ${openPillar.border}`}>
                  <openPillar.Icon size={22} style={{ color: openPillar.accent }} />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>{openPillar.label}</h2>
                  <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{openPillar.tagline}</p>
                </div>
              </div>
              <button
                onClick={handleClosePillar}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                  isLight
                    ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    : 'text-slate-500 hover:text-white hover:bg-white/10'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Accent divider */}
            <div
              className="mx-6 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${openPillar.accent}35, transparent)` }}
            />

            {/* Sub-module Mandala Content */}
            <div className="px-4 py-6 flex justify-center">
              <SubMandalaView pillar={openPillar} onNav={handleNav} canAccess={canAccessSub} visible={overlayVisible} isLight={isLight} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUB-MODULE MANDALA VIEW — Radial layout inside overlay
// ═══════════════════════════════════════════════════════════════════════════════

function SubMandalaView({ pillar, onNav, canAccess, visible, isLight }: {
  pillar: Pillar
  onNav: (r: string) => void
  canAccess: (s: SubMod) => boolean
  visible: boolean
  isLight: boolean
}) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setEntered(true), 180)
      return () => clearTimeout(t)
    }
    setEntered(false)
  }, [visible])

  const subs = pillar.subs
  const count = subs.length

  // Dynamic radius based on number of modules — bigger for readability
  const R = count <= 2 ? 130 : count <= 3 ? 148 : 165
  const SIZE = R * 2 + 190

  const cx = SIZE / 2
  const cy = SIZE / 2

  return (
    <div className="flex flex-col items-center">
      {/* Responsive scaler */}
      <div
        className="relative origin-center scale-[0.72] sm:scale-90 md:scale-100"
        style={{ width: SIZE, height: SIZE }}
      >
        {/* Slow rotating decorative conic gradient */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            left: cx - R - 50,
            top: cy - R - 50,
            width: (R + 50) * 2,
            height: (R + 50) * 2,
            background: `conic-gradient(from 0deg, ${pillar.accent}08, transparent 30%, ${pillar.accent}06, transparent 60%, ${pillar.accent}08, transparent 90%)`,
            opacity: entered ? 1 : 0,
            animation: entered ? 'spin 40s linear infinite' : 'none',
            transition: 'opacity 0.8s ease',
          }}
        />

        {/* SVG decorative rings + connecting lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
          {/* Outer decorative ring */}
          <circle
            cx={cx} cy={cy} r={R + 40}
            fill="none" stroke={pillar.accent}
            strokeWidth="0.5" strokeDasharray="3 8"
            opacity={entered ? 0.2 : 0}
            style={{ transition: 'opacity 0.6s ease 0.1s' }}
          />

          {/* Inner guide ring */}
          <circle
            cx={cx} cy={cy} r={R}
            fill="none" stroke={pillar.accent}
            strokeWidth="0.3"
            opacity={entered ? 0.08 : 0}
            style={{ transition: 'opacity 0.6s ease 0.15s' }}
          />

          {/* Connecting lines + midpoint dots */}
          {subs.map((_, i) => {
            const angle = (-90 + (360 / count) * i) * (Math.PI / 180)
            const ex = cx + R * Math.cos(angle)
            const ey = cy + R * Math.sin(angle)
            const mx = (cx + ex) / 2
            const my = (cy + ey) / 2

            return (
              <g key={i}>
                <line
                  x1={cx} y1={cy} x2={ex} y2={ey}
                  stroke={pillar.accent} strokeWidth="1" strokeDasharray="3 5"
                  opacity={entered ? (isLight ? 0.25 : 0.18) : 0}
                  style={{ transition: `opacity 0.4s ease ${200 + i * 60}ms` }}
                />
                {/* Midpoint energy dot */}
                <circle
                  cx={mx} cy={my} r="2.5"
                  fill={pillar.accent}
                  opacity={entered ? (isLight ? 0.4 : 0.3) : 0}
                  style={{ transition: `opacity 0.3s ease ${350 + i * 60}ms` }}
                />
              </g>
            )
          })}
        </svg>

        {/* Center node with pulsing glow */}
        <div
          className="absolute z-10"
          style={{
            left: cx - 46,
            top: cy - 46,
            width: 92,
            height: 92,
          }}
        >
          <div
            className="w-full h-full rounded-full flex items-center justify-center border"
            style={{
              background: isLight
                ? `radial-gradient(circle, ${pillar.accent}18, rgba(255,255,255,0.9))`
                : `radial-gradient(circle, ${pillar.glow}, rgba(6,15,28,0.9))`,
              borderColor: pillar.accent + '40',
              boxShadow: entered
                ? `0 0 32px ${pillar.glow}, 0 0 64px ${pillar.glow}`
                : 'none',
              transform: entered ? 'scale(1)' : 'scale(0)',
              transition: 'transform 0.5s cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 0.6s ease',
            }}
          >
            <pillar.Icon size={40} style={{ color: pillar.accent }} />
          </div>
        </div>

        {/* Sub-module orbital nodes */}
        {subs.map((sub, i) => {
          const angle = (-90 + (360 / count) * i) * (Math.PI / 180)
          const x = R * Math.cos(angle)
          const y = R * Math.sin(angle)
          const accessible = canAccess(sub)
          const isAdminAccess = !sub.active && accessible
          const isFuture = !accessible

          return (
            <button
              key={sub.key}
              onClick={() => accessible ? onNav(sub.route) : undefined}
              className="absolute z-20 group"
              style={{
                left: cx,
                top: cy,
                transform: entered
                  ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`
                  : 'translate(-50%, -50%) scale(0)',
                transition: `transform 0.45s cubic-bezier(0.175,0.885,0.32,1.275) ${280 + i * 70}ms`,
              }}
            >
              <div className="flex flex-col items-center gap-2">
                {/* Node icon — all look active, full styling */}
                <div
                  className={[
                    'rounded-2xl flex items-center justify-center border transition-all duration-200',
                    isLight
                      ? 'bg-white shadow-card border-slate-200/80 group-hover:scale-110 group-hover:-translate-y-1 group-hover:shadow-card-md cursor-pointer'
                      : 'glass-card group-hover:scale-110 group-hover:-translate-y-1 cursor-pointer',
                  ].join(' ')}
                  style={{
                    width: 72,
                    height: 72,
                    borderColor: !isLight ? pillar.accent + '35' : undefined,
                    boxShadow: !isLight
                      ? `0 0 20px ${pillar.glow}, 0 0 40px ${pillar.glow.replace(/[\d.]+\)$/, '0.08)')}`
                      : 'none',
                  }}
                >
                  <sub.Icon size={32} style={{ color: pillar.accent }} />
                </div>

                {/* Label — always full color */}
                <span className={`text-[14px] font-bold whitespace-nowrap leading-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  {sub.label}
                </span>

                {/* Status badge */}
                {isFuture ? (
                  <span className={`text-[9px] font-medium ${isLight ? 'text-slate-400/70' : 'text-slate-500/60'}`}>
                    Em breve
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: pillar.accent }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: pillar.accent }} />
                    {isAdminAccess ? 'Admin' : 'Ativo'}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Tip */}
      <p className={`text-[11px] mt-2 text-center ${isLight ? 'text-slate-400' : 'text-slate-600'}`}>
        Clique em um módulo ativo para acessar
      </p>
    </div>
  )
}
