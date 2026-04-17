import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { LayoutGrid, LogOut, Shield, Settings, ChevronLeft, Menu, X, User, Code2, Link2, ClipboardList, Plus, HandHelping, CheckSquare } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense, createContext, useContext } from 'react'
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import LogoTeg from './LogoTeg'
import NotificationBell from './NotificationBell'
import ApprovalBadge from './ApprovalBadge'

const MinhasSolicitacoesEmbedded = lazy(() => import('../pages/MinhasSolicitacoes'))

// Contexto para páginas filho saberem que estão dentro de um módulo com requisitante ativo
export const RequisitanteCtx = createContext<{ homeRoute: string } | null>(null)
export function useRequisitanteCtx() { return useContext(RequisitanteCtx) }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NavActionMenuItem {
  icon: LucideIcon
  label: string
  description?: string
  tone?: 'amber' | 'emerald'
  action: () => void
}

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  end?: boolean
  adminOnly?: boolean
  /** Permite que requisitantes acessem este item (ex: nova solicitação) */
  requisitanteAllowed?: boolean
  /** Restrito a supervisor/diretor/ceo — oculto para equipe e requisitante */
  supervisorOnly?: boolean
  action?: () => void
  actionMenu?: {
    title?: string
    items: NavActionMenuItem[]
  }
  accent?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export interface ModuleConfig {
  moduleKey: string
  moduleName: string
  moduleEmoji: string
  accent: string
  nav: NavItem[]
  navSections?: NavSection[]
  mobileNav?: NavItem[]
  variant?: 'full' | 'compact'
  showCadastrosLink?: boolean
  maxWidth?: string
  moduleSubtitle?: string
  mobileModuleName?: string
  backRoute?: string | number
  bottomNavCompact?: boolean
  truncateBottomLabels?: boolean
  bottomNavMaxItems?: number
  headerExtra?: React.ReactNode
}

// ── Avatar helpers (shared, extracted once) ────────────────────────────────────

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

function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function isNovaSolicitacaoItem(item: NavItem): boolean {
  if (item.requisitanteAllowed === true) return true
  const n = normalizeLabel(item.label)
  return n.includes('nova solicitacao') || n.includes('nova requisicao') || n.includes('nova movimentacao')
}

// ── Accent color class map ────────────────────────────────────────────────────
// Tailwind needs full class names (no dynamic concat) for JIT purging

interface AccentClasses {
  badgeBgLight: string; badgeBorderLight: string
  badgeHoverBgLight: string; badgeHoverBorderLight: string
  badgeBgDark: string; badgeBorderDark: string
  badgeHoverBgDark: string; badgeHoverBorderDark: string
  textLight: string; textDark: string
  subtextLight: string; subtextDark: string
  gridLight: string; gridHoverLight: string
  gridDark: string; gridHoverDark: string
  activeBgLight: string; activeTextLight: string; activeBorderLight: string
  activeBgDark: string; activeTextDark: string; activeBorderDark: string
  mobileActiveTextLight: string; mobileActiveBgLight: string
  mobileActiveTextDark: string; mobileActiveBgDark: string
  mobileHeaderLight: string; mobileHeaderDark: string
  compactBadgeHoverBgDark: string
  compactSubtextDark: string
  chevronLight: string; chevronDark: string
  shieldLight: string; shieldDark: string
}

const ACCENT_CLASSES: Record<string, AccentClasses> = {
  teal: {
    badgeBgLight: 'bg-teal-50', badgeBorderLight: 'border-teal-200',
    badgeHoverBgLight: 'hover:bg-teal-100', badgeHoverBorderLight: 'hover:border-teal-300',
    badgeBgDark: 'bg-teal-500/10', badgeBorderDark: 'border-teal-500/25',
    badgeHoverBgDark: 'hover:bg-teal-500/18', badgeHoverBorderDark: 'hover:border-teal-500/40',
    textLight: 'text-teal-700', textDark: 'text-teal-300',
    subtextLight: 'text-teal-500/60', subtextDark: 'text-teal-500/60',
    gridLight: 'text-teal-400', gridHoverLight: 'group-hover:text-teal-500',
    gridDark: 'text-teal-500/50', gridHoverDark: 'group-hover:text-teal-400',
    activeBgLight: 'bg-teal-50', activeTextLight: 'text-teal-700', activeBorderLight: 'border-teal-200',
    activeBgDark: 'bg-teal-500/15', activeTextDark: 'text-teal-300', activeBorderDark: 'border-teal-500/25',
    mobileActiveTextLight: 'text-teal-600', mobileActiveBgLight: 'bg-teal-50',
    mobileActiveTextDark: 'text-teal-400', mobileActiveBgDark: 'bg-teal-400/10',
    mobileHeaderLight: 'text-teal-500', mobileHeaderDark: 'text-teal-400/70',
    compactBadgeHoverBgDark: 'hover:bg-teal-500/15',
    compactSubtextDark: 'text-teal-300/50', chevronLight: 'text-teal-400', chevronDark: 'text-teal-300/50',
    shieldLight: 'text-teal-300', shieldDark: 'text-teal-400/50',
  },
  emerald: {
    badgeBgLight: 'bg-emerald-50', badgeBorderLight: 'border-emerald-200',
    badgeHoverBgLight: 'hover:bg-emerald-100', badgeHoverBorderLight: 'hover:border-emerald-300',
    badgeBgDark: 'bg-emerald-500/10', badgeBorderDark: 'border-emerald-500/25',
    badgeHoverBgDark: 'hover:bg-emerald-500/18', badgeHoverBorderDark: 'hover:border-emerald-500/40',
    textLight: 'text-emerald-700', textDark: 'text-emerald-300',
    subtextLight: 'text-emerald-500/60', subtextDark: 'text-emerald-500/60',
    gridLight: 'text-emerald-400', gridHoverLight: 'group-hover:text-emerald-500',
    gridDark: 'text-emerald-500/50', gridHoverDark: 'group-hover:text-emerald-400',
    activeBgLight: 'bg-emerald-50', activeTextLight: 'text-emerald-700', activeBorderLight: 'border-emerald-200',
    activeBgDark: 'bg-emerald-500/15', activeTextDark: 'text-emerald-300', activeBorderDark: 'border-emerald-500/25',
    mobileActiveTextLight: 'text-emerald-600', mobileActiveBgLight: 'bg-emerald-50',
    mobileActiveTextDark: 'text-emerald-400', mobileActiveBgDark: 'bg-emerald-400/10',
    mobileHeaderLight: 'text-emerald-500', mobileHeaderDark: 'text-emerald-400/70',
    compactBadgeHoverBgDark: 'hover:bg-emerald-500/15',
    compactSubtextDark: 'text-emerald-300/50', chevronLight: 'text-emerald-400', chevronDark: 'text-emerald-300/50',
    shieldLight: 'text-emerald-300', shieldDark: 'text-emerald-400/50',
  },
  blue: {
    badgeBgLight: 'bg-blue-50', badgeBorderLight: 'border-blue-200',
    badgeHoverBgLight: 'hover:bg-blue-100', badgeHoverBorderLight: 'hover:border-blue-300',
    badgeBgDark: 'bg-blue-500/10', badgeBorderDark: 'border-blue-500/25',
    badgeHoverBgDark: 'hover:bg-blue-500/18', badgeHoverBorderDark: 'hover:border-blue-500/40',
    textLight: 'text-blue-700', textDark: 'text-blue-300',
    subtextLight: 'text-blue-500/60', subtextDark: 'text-blue-500/60',
    gridLight: 'text-blue-400', gridHoverLight: 'group-hover:text-blue-500',
    gridDark: 'text-blue-500/50', gridHoverDark: 'group-hover:text-blue-400',
    activeBgLight: 'bg-blue-50', activeTextLight: 'text-blue-700', activeBorderLight: 'border-blue-200',
    activeBgDark: 'bg-blue-500/15', activeTextDark: 'text-blue-300', activeBorderDark: 'border-blue-500/25',
    mobileActiveTextLight: 'text-blue-600', mobileActiveBgLight: 'bg-blue-50',
    mobileActiveTextDark: 'text-blue-400', mobileActiveBgDark: 'bg-blue-400/10',
    mobileHeaderLight: 'text-blue-500', mobileHeaderDark: 'text-blue-400/70',
    compactBadgeHoverBgDark: 'hover:bg-blue-500/15',
    compactSubtextDark: 'text-blue-300/50', chevronLight: 'text-blue-400', chevronDark: 'text-blue-300/50',
    shieldLight: 'text-blue-300', shieldDark: 'text-blue-400/50',
  },
  orange: {
    badgeBgLight: 'bg-orange-50', badgeBorderLight: 'border-orange-200',
    badgeHoverBgLight: 'hover:bg-orange-100', badgeHoverBorderLight: 'hover:border-orange-300',
    badgeBgDark: 'bg-orange-500/10', badgeBorderDark: 'border-orange-500/25',
    badgeHoverBgDark: 'hover:bg-orange-500/18', badgeHoverBorderDark: 'hover:border-orange-500/40',
    textLight: 'text-orange-700', textDark: 'text-orange-300',
    subtextLight: 'text-orange-500/60', subtextDark: 'text-orange-500/60',
    gridLight: 'text-orange-400', gridHoverLight: 'group-hover:text-orange-500',
    gridDark: 'text-orange-500/50', gridHoverDark: 'group-hover:text-orange-400',
    activeBgLight: 'bg-orange-50', activeTextLight: 'text-orange-700', activeBorderLight: 'border-orange-200',
    activeBgDark: 'bg-orange-500/15', activeTextDark: 'text-orange-300', activeBorderDark: 'border-orange-500/25',
    mobileActiveTextLight: 'text-orange-600', mobileActiveBgLight: 'bg-orange-50',
    mobileActiveTextDark: 'text-orange-400', mobileActiveBgDark: 'bg-orange-400/10',
    mobileHeaderLight: 'text-orange-500', mobileHeaderDark: 'text-orange-400/70',
    compactBadgeHoverBgDark: 'hover:bg-orange-500/15',
    compactSubtextDark: 'text-orange-300/50', chevronLight: 'text-orange-400', chevronDark: 'text-orange-300/50',
    shieldLight: 'text-orange-300', shieldDark: 'text-orange-400/50',
  },
  violet: {
    badgeBgLight: 'bg-violet-50', badgeBorderLight: 'border-violet-200',
    badgeHoverBgLight: 'hover:bg-violet-100', badgeHoverBorderLight: 'hover:border-violet-300',
    badgeBgDark: 'bg-violet-500/10', badgeBorderDark: 'border-violet-500/25',
    badgeHoverBgDark: 'hover:bg-violet-500/18', badgeHoverBorderDark: 'hover:border-violet-500/40',
    textLight: 'text-violet-700', textDark: 'text-violet-300',
    subtextLight: 'text-violet-500/60', subtextDark: 'text-violet-500/60',
    gridLight: 'text-violet-400', gridHoverLight: 'group-hover:text-violet-500',
    gridDark: 'text-violet-500/50', gridHoverDark: 'group-hover:text-violet-400',
    activeBgLight: 'bg-violet-50', activeTextLight: 'text-violet-700', activeBorderLight: 'border-violet-200',
    activeBgDark: 'bg-violet-500/15', activeTextDark: 'text-violet-300', activeBorderDark: 'border-violet-500/25',
    mobileActiveTextLight: 'text-violet-600', mobileActiveBgLight: 'bg-violet-50',
    mobileActiveTextDark: 'text-violet-400', mobileActiveBgDark: 'bg-violet-400/10',
    mobileHeaderLight: 'text-violet-500', mobileHeaderDark: 'text-violet-400/70',
    compactBadgeHoverBgDark: 'hover:bg-violet-500/15',
    compactSubtextDark: 'text-violet-300/50', chevronLight: 'text-violet-400', chevronDark: 'text-violet-300/50',
    shieldLight: 'text-violet-300', shieldDark: 'text-violet-400/50',
  },
  indigo: {
    badgeBgLight: 'bg-indigo-50', badgeBorderLight: 'border-indigo-200',
    badgeHoverBgLight: 'hover:bg-indigo-100', badgeHoverBorderLight: 'hover:border-indigo-300',
    badgeBgDark: 'bg-indigo-500/10', badgeBorderDark: 'border-indigo-500/25',
    badgeHoverBgDark: 'hover:bg-indigo-500/18', badgeHoverBorderDark: 'hover:border-indigo-500/40',
    textLight: 'text-indigo-700', textDark: 'text-indigo-300',
    subtextLight: 'text-indigo-500/60', subtextDark: 'text-indigo-500/60',
    gridLight: 'text-indigo-400', gridHoverLight: 'group-hover:text-indigo-500',
    gridDark: 'text-indigo-500/50', gridHoverDark: 'group-hover:text-indigo-400',
    activeBgLight: 'bg-indigo-50', activeTextLight: 'text-indigo-700', activeBorderLight: 'border-indigo-200',
    activeBgDark: 'bg-indigo-500/15', activeTextDark: 'text-indigo-300', activeBorderDark: 'border-indigo-500/25',
    mobileActiveTextLight: 'text-indigo-600', mobileActiveBgLight: 'bg-indigo-50',
    mobileActiveTextDark: 'text-indigo-400', mobileActiveBgDark: 'bg-indigo-400/10',
    mobileHeaderLight: 'text-indigo-500', mobileHeaderDark: 'text-indigo-400/70',
    compactBadgeHoverBgDark: 'hover:bg-indigo-500/15',
    compactSubtextDark: 'text-indigo-300/50', chevronLight: 'text-indigo-400', chevronDark: 'text-indigo-300/50',
    shieldLight: 'text-indigo-300', shieldDark: 'text-indigo-400/50',
  },
  amber: {
    badgeBgLight: 'bg-amber-50', badgeBorderLight: 'border-amber-200',
    badgeHoverBgLight: 'hover:bg-amber-100', badgeHoverBorderLight: 'hover:border-amber-300',
    badgeBgDark: 'bg-amber-500/10', badgeBorderDark: 'border-amber-500/25',
    badgeHoverBgDark: 'hover:bg-amber-500/18', badgeHoverBorderDark: 'hover:border-amber-500/40',
    textLight: 'text-amber-700', textDark: 'text-amber-300',
    subtextLight: 'text-amber-500/60', subtextDark: 'text-amber-500/60',
    gridLight: 'text-amber-400', gridHoverLight: 'group-hover:text-amber-500',
    gridDark: 'text-amber-500/50', gridHoverDark: 'group-hover:text-amber-400',
    activeBgLight: 'bg-amber-50', activeTextLight: 'text-amber-700', activeBorderLight: 'border-amber-200',
    activeBgDark: 'bg-amber-500/15', activeTextDark: 'text-amber-300', activeBorderDark: 'border-amber-500/25',
    mobileActiveTextLight: 'text-amber-600', mobileActiveBgLight: 'bg-amber-50',
    mobileActiveTextDark: 'text-amber-400', mobileActiveBgDark: 'bg-amber-400/10',
    mobileHeaderLight: 'text-amber-500', mobileHeaderDark: 'text-amber-400/70',
    compactBadgeHoverBgDark: 'hover:bg-amber-500/15',
    compactSubtextDark: 'text-amber-300/50', chevronLight: 'text-amber-400', chevronDark: 'text-amber-300/50',
    shieldLight: 'text-amber-300', shieldDark: 'text-amber-400/50',
  },
  rose: {
    badgeBgLight: 'bg-rose-50', badgeBorderLight: 'border-rose-200',
    badgeHoverBgLight: 'hover:bg-rose-100', badgeHoverBorderLight: 'hover:border-rose-300',
    badgeBgDark: 'bg-rose-500/10', badgeBorderDark: 'border-rose-500/25',
    badgeHoverBgDark: 'hover:bg-rose-500/18', badgeHoverBorderDark: 'hover:border-rose-500/40',
    textLight: 'text-rose-700', textDark: 'text-rose-300',
    subtextLight: 'text-rose-500/60', subtextDark: 'text-rose-500/60',
    gridLight: 'text-rose-400', gridHoverLight: 'group-hover:text-rose-500',
    gridDark: 'text-rose-500/50', gridHoverDark: 'group-hover:text-rose-400',
    activeBgLight: 'bg-rose-50', activeTextLight: 'text-rose-700', activeBorderLight: 'border-rose-200',
    activeBgDark: 'bg-rose-500/15', activeTextDark: 'text-rose-300', activeBorderDark: 'border-rose-500/25',
    mobileActiveTextLight: 'text-rose-600', mobileActiveBgLight: 'bg-rose-50',
    mobileActiveTextDark: 'text-rose-400', mobileActiveBgDark: 'bg-rose-400/10',
    mobileHeaderLight: 'text-rose-500', mobileHeaderDark: 'text-rose-400/70',
    compactBadgeHoverBgDark: 'hover:bg-rose-500/15',
    compactSubtextDark: 'text-rose-300/50', chevronLight: 'text-rose-400', chevronDark: 'text-rose-300/50',
    shieldLight: 'text-rose-300', shieldDark: 'text-rose-400/50',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ModuleLayout({
  variant = 'full',
  showCadastrosLink = false,
  maxWidth = 'max-w-5xl',
  moduleSubtitle = 'Módulo ativo',
  mobileModuleName,
  backRoute = '/',
  bottomNavCompact = true,
  truncateBottomLabels = false,
  bottomNavMaxItems,
  headerExtra,
  ...config
}: ModuleConfig) {
  const { perfil, isAdmin, signOut, role, papelGlobal, getPapelForModule } = useAuth()
  const { isDark, isLightSidebar, isDarkSidebar, theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarBtnRef = useRef<HTMLButtonElement>(null)
  const [avatarPos, setAvatarPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0, right: 0 })
  const [openNavMenu, setOpenNavMenu] = useState<{ id: string; top: number; left: number } | null>(null)

  // Compute avatar dropdown position — anchor to right of sidebar button, or below in header/mobile
  const updateAvatarPos = useCallback(() => {
    if (!avatarBtnRef.current) return
    const r = avatarBtnRef.current.getBoundingClientRect()
    const panelW = 240
    const panelH = 440 // approx max height of menu
    const isInSidebar = r.left < window.innerWidth * 0.35
    const isMobile = window.innerWidth < 640

    if (isInSidebar && !isMobile) {
      // Sidebar button: anchor to right of button
      setAvatarPos({
        top: Math.min(r.top, Math.max(8, window.innerHeight - panelH - 8)),
        left: r.right + 12,
      })
    } else {
      // Header/mobile: dropdown below, right-aligned
      const rightVal = Math.max(8, window.innerWidth - r.right)
      setAvatarPos({
        top: r.bottom + 8,
        right: rightVal + panelW > window.innerWidth - 8 ? (window.innerWidth - panelW) / 2 : rightVal,
      })
    }
  }, [])

  useEffect(() => {
    if (!avatarOpen) return
    updateAvatarPos()
    const onScroll = () => updateAvatarPos()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', updateAvatarPos)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', updateAvatarPos)
    }
  }, [avatarOpen, updateAvatarPos])

  // Close avatar dropdown on click outside or Escape
  useEffect(() => {
    if (!avatarOpen) return
    function onClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-avatar-menu]')) setAvatarOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAvatarOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [avatarOpen])

  useEffect(() => {
    if (!openNavMenu) return
    function onClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-nav-action-menu]')) setOpenNavMenu(null)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenNavMenu(null)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [openNavMenu])

  useEffect(() => {
    if (!openNavMenu) return
    function closeNavMenu() {
      setOpenNavMenu(null)
    }
    window.addEventListener('resize', closeNavMenu)
    window.addEventListener('scroll', closeNavMenu, true)
    return () => {
      window.removeEventListener('resize', closeNavMenu)
      window.removeEventListener('scroll', closeNavMenu, true)
    }
  }, [openNavMenu])

  const ls = !isDarkSidebar // ls = light sidebar visual
  const a = ACCENT_CLASSES[config.accent] ?? ACCENT_CLASSES.teal

  const nome = perfil?.nome ?? 'Usuário'
  const initials = getInitials(nome)
  const avatarBg = getAvatarColor(nome)
  const firstName = nome.split(' ')[0]

  const headerModuleName = mobileModuleName ?? config.moduleName
  const visibleNav = config.nav.filter(n => !n.adminOnly || isAdmin)
  const moduloPapel = getPapelForModule(config.moduleKey)
  const isRequisitante = !isAdmin && moduloPapel === 'requisitante'
  const visibleNavForRole = useMemo(() => {
    if (isRequisitante) return visibleNav.filter(isNovaSolicitacaoItem)
    return visibleNav
  }, [isRequisitante, visibleNav])
  // home do módulo = primeiro item com end:true
  const homeRoute = config.nav.find(n => n.end === true)?.to ?? '/'

  // Guarda o pathname que estava aberto quando ?nova= estava na URL.
  // Quando a página filho limpa o param (ex: CPPipeline), não redirecionamos
  // imediatamente — deixamos o modal abrir. A navegação de volta acontece
  // via RequisitanteCtx.homeRoute chamado no onClose do modal filho.
  const novaFlowPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isRequisitante) return
    const isNovaFlow = new URLSearchParams(location.search).has('nova')
    if (isNovaFlow) {
      novaFlowPathRef.current = location.pathname
      return
    }
    // Se ainda estamos no mesmo path que tinha ?nova= (filho limpou o param),
    // não redirecionar — modal está abrindo/aberto.
    if (novaFlowPathRef.current === location.pathname) return
    // Voltou ao home → limpa o ref
    if (location.pathname === homeRoute) { novaFlowPathRef.current = null; return }
    // Qualquer outro path sem nova → volta para home
    navigate(homeRoute, { replace: true })
  }, [isRequisitante, homeRoute, location.pathname, location.search, navigate])

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function handleAvatarNavigate(route: string) {
    setAvatarOpen(false)
    requestAnimationFrame(() => navigate(route))
  }

  function goBack() {
    if (typeof backRoute === 'number') navigate(backRoute)
    else navigate(backRoute)
  }

  // ── Link class factories ────────────────────────────────────────────────────

  function sidebarLinkClass({ isActive }: { isActive: boolean }) {
    if (variant === 'compact') {
      const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border'
      if (isActive)
        return `${base} ${ls ? `${a.activeBgLight} ${a.activeTextLight} ${a.activeBorderLight}` : `${a.activeBgDark} ${a.activeTextDark} ${a.activeBorderDark}`}`
      return `${base} ${ls ? 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-white/5'}`
    }
    const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 border'
    if (isActive)
      return `${base} ${ls ? `${a.activeBgLight} ${a.activeTextLight} ${a.activeBorderLight}` : `${a.activeBgDark} ${a.activeTextDark} ${a.activeBorderDark}`}`
    return `${base} ${ls ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent' : 'text-slate-400 hover:text-slate-100 hover:bg-white/6 border-transparent'}`
  }

  function bottomLinkClass({ isActive }: { isActive: boolean }) {
    const compact = bottomNavCompact
    const base = `flex flex-col items-center py-2 ${compact ? 'px-1.5' : 'px-2.5'} rounded-xl ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold transition-all duration-150 ${compact ? 'min-w-[40px]' : 'min-w-[46px]'}`
    if (isActive)
      return `${base} ${ls ? `${a.mobileActiveTextLight} ${a.mobileActiveBgLight}` : `${a.mobileActiveTextDark} ${a.mobileActiveBgDark}`}`
    return `${base} ${ls ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`
  }

  function navActionMenuToneClasses(tone: NavActionMenuItem['tone']) {
    if (tone === 'amber') {
      return ls
        ? 'bg-amber-50 text-amber-600'
        : 'bg-amber-500/15 text-amber-300'
    }
    return ls
      ? 'bg-emerald-50 text-emerald-600'
      : 'bg-emerald-500/15 text-emerald-300'
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderRequisitanteNav() {
    const novaSolicitacaoItem = visibleNav.find(isNovaSolicitacaoItem)
    if (!novaSolicitacaoItem) return null
    const Icon = novaSolicitacaoItem.icon
    return (
      <div className="flex flex-col gap-2 px-1 py-2">
        <NavLink
          to={novaSolicitacaoItem.to}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm
            ${ls
              ? `${a.badgeBgLight} ${a.textLight} hover:opacity-90 active:scale-95`
              : `${a.badgeBgDark} ${a.textDark} hover:opacity-90 active:scale-95`
            }`}
        >
          {Icon ? <Icon size={16} strokeWidth={2.5} /> : <Plus size={16} strokeWidth={2.5} />}
          {novaSolicitacaoItem.label}
        </NavLink>
      </div>
    )
  }

  function renderNavItems() {
    return visibleNavForRole.map(({ to, icon: Icon, label, end, adminOnly, action, actionMenu, accent }) => {
      if (actionMenu) {
        const isOpen = openNavMenu?.id === to
        return (
          <div key={to}>
            <button
              type="button"
              onClick={event => {
                if (openNavMenu?.id === to) {
                  setOpenNavMenu(null)
                  return
                }
                const rect = event.currentTarget.getBoundingClientRect()
                setOpenNavMenu({
                  id: to,
                  top: Math.min(rect.top, window.innerHeight - 260),
                  left: rect.right + 12,
                })
              }}
              className={`w-full text-left ${sidebarLinkClass({ isActive: false })}`}
            >
              <Icon size={18} className={accent ? 'shrink-0 text-orange-500' : 'shrink-0'} />
              <span className={accent ? 'text-orange-500 font-semibold' : undefined}>{label}</span>
            </button>
            {isOpen && (
              <div
                data-nav-action-menu
                className={`fixed z-[70] w-[340px] rounded-3xl border p-3 shadow-2xl ${ls ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-slate-900'}`}
                style={{ top: openNavMenu.top, left: openNavMenu.left }}
              >
                {actionMenu.title && (
                  <p className={`px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider ${ls ? 'text-slate-400' : 'text-slate-500'}`}>
                    {actionMenu.title}
                  </p>
                )}
                {actionMenu.items.map(item => {
                  const ItemIcon = item.icon
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setOpenNavMenu(null)
                        item.action()
                      }}
                      className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition-all ${ls ? 'hover:bg-slate-50' : 'hover:bg-white/[0.05]'}`}
                    >
                      <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${navActionMenuToneClasses(item.tone)}`}>
                        <ItemIcon size={16} />
                      </span>
                      <span>
                        <span className={`block text-sm font-bold ${ls ? 'text-slate-900' : 'text-white'}`}>{item.label}</span>
                        {item.description && (
                          <span className={`mt-1 block text-xs leading-relaxed ${ls ? 'text-slate-500' : 'text-slate-400'}`}>
                            {item.description}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      }
      if (action) {
        return (
          <button key={to} onClick={action} className={accent
            ? `w-full flex items-center gap-2.5 px-3 py-2.5 my-1 mx-2 rounded-xl text-sm font-bold transition-all ${
              ls ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200' : 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/20'
            }`
            : `w-full text-left ${sidebarLinkClass({ isActive: false })}`}>
            <Icon size={16} className="shrink-0" />
            <span>{label}</span>
          </button>
        )
      }
      if (accent) {
        return (
          <NavLink key={to} to={to} end={end}
            className={`flex items-center gap-2.5 px-3 py-2.5 my-1 mx-2 rounded-xl text-sm font-bold transition-all ${
              ls ? 'bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200' : 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 border border-orange-500/20'
            }`}>
            <Icon size={16} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        )
      }
      return (
        <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
          <Icon size={16} className="shrink-0" />
          <span className={variant === 'compact' && adminOnly ? 'flex-1' : undefined}>{label}</span>
          {variant === 'compact' && adminOnly && (
            <Shield size={10} className={`shrink-0 ${ls ? a.shieldLight : a.shieldDark}`} />
          )}
        </NavLink>
      )
    })
  }

  function renderSectionedNav() {
    return (
      <>
        {visibleNavForRole.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} className={sidebarLinkClass}>
            <Icon size={16} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
        {config.navSections!.map(section => (
          <div key={section.label}>
            <p className={`text-[9px] font-bold uppercase tracking-[0.15em] px-3 pt-4 pb-1.5
              ${ls ? 'text-slate-400' : 'text-slate-600'}`}>
              {section.label}
            </p>
            {section.items.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={sidebarLinkClass}>
                <Icon size={16} className="shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </>
    )
  }

  function renderCadastrosLink() {
    if (!showCadastrosLink || isRequisitante) return null
    return (
      <>
        <div className={variant === 'compact'
          ? `h-px mx-1 my-2 ${ls ? 'bg-slate-100' : 'bg-white/5'}`
          : `h-px mx-2 my-2 ${ls ? 'bg-slate-100' : 'bg-white/[0.05]'}`
        } />
        <NavLink
          to="/cadastros"
          className={variant === 'compact'
            ? ({ isActive }) => sidebarLinkClass({ isActive })
            : sidebarLinkClass
          }
        >
          <Settings size={16} className={variant === 'full' ? 'shrink-0' : undefined} />
          {variant === 'compact' ? <>Cadastros</> : <span>Cadastros</span>}
        </NavLink>
      </>
    )
  }

  // ── Avatar + Dropdown ──────────────────────────────────────────────────────

  const THEME_OPTS = [
    { value: 'original' as const, icon: '🖥️', label: 'Auto' },
    { value: 'dark' as const, icon: '🌙', label: 'Dark' },
    { value: 'light' as const, icon: '☀️', label: 'Light' },
  ]

  function renderAvatarButton(size: 'sm' | 'md' = 'md') {
    const dim = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-9 h-9 text-xs'
    return (
      <button
        ref={avatarBtnRef}
        onClick={() => setAvatarOpen(o => !o)}
        className={[
          dim, 'rounded-full flex items-center justify-center',
          'text-white font-extrabold shrink-0 ring-2 transition-all duration-200',
          'hover:scale-105 active:scale-95 cursor-pointer select-none',
          avatarBg,
          ls ? 'ring-slate-200/60 hover:ring-slate-300' : 'ring-white/10 hover:ring-white/25',
          avatarOpen ? (ls ? 'ring-slate-400 scale-105' : 'ring-white/40 scale-105') : '',
        ].join(' ')}
        title={`${nome} · ${ROLE_LABEL[role]}`}
      >
        {initials}
      </button>
    )
  }

  function renderAvatarDropdown(_position: 'sidebar' | 'header' | 'compact-sidebar' = 'sidebar') {
    if (!avatarOpen) return null

    const dropdownEl = (
      <div
        data-avatar-menu
        className={[
          'fixed z-[9999] w-60 rounded-2xl border overflow-hidden',
          'shadow-xl transition-all',
          ls
            ? 'bg-white border-slate-200/80 shadow-slate-200/40'
            : 'bg-[#111827] border-white/10 shadow-black/50',
        ].join(' ')}
        style={{
          top: avatarPos.top,
          ...(avatarPos.left !== undefined ? { left: avatarPos.left } : { right: avatarPos.right }),
          animation: 'fadeSlideIn 150ms ease-out',
        }}
      >
        {/* ── User info ── */}
        <div className={`px-4 pt-3.5 pb-3 border-b ${ls ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-extrabold shrink-0 ${avatarBg}`}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className={`text-[13px] font-semibold truncate ${ls ? 'text-slate-800' : 'text-slate-100'}`}>{nome}</p>
              <span className={`text-[11px] font-medium ${ROLE_COLOR[role].text}`}>{ROLE_LABEL[role]}</span>
            </div>
          </div>
        </div>

        {/* ── Links ── */}
        <div className="py-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleAvatarNavigate('/perfil') }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
              ${ls ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'}`}
          >
            <User size={15} className="shrink-0 opacity-50" />
            Meu Perfil
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleAvatarNavigate('/minhas-tarefas') }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
              ${ls ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'}`}
          >
            <CheckSquare size={15} className="shrink-0 opacity-50" />
            Minhas Tarefas
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleAvatarNavigate('/minhas-solicitacoes') }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
              ${ls ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'}`}
          >
            <ClipboardList size={15} className="shrink-0 opacity-50" />
            Minhas Solicitações
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleAvatarNavigate('/minhas-cautelas') }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
              ${ls ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'}`}
          >
            <HandHelping size={15} className="shrink-0 opacity-50" />
            Minhas Cautelas
          </button>

          {isAdmin && (
            <>
              <div className={`h-px mx-3 my-1 ${ls ? 'bg-slate-100' : 'bg-white/[0.06]'}`} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAvatarNavigate('/admin/usuarios') }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
                  ${ls ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'}`}
              >
                <Shield size={15} className="shrink-0 opacity-50" />
                Usuários
              </button>
              <button
                onClick={() => { setAvatarOpen(false); navigate('/cadastros') }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
                  ${ls ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'}`}
              >
                <Settings size={15} className="shrink-0 opacity-50" />
                Cadastros
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAvatarNavigate('/admin/integracoes') }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
                  ${ls ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'}`}
              >
                <Link2 size={15} className="shrink-0 opacity-50" />
                Integrações
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleAvatarNavigate('/admin/desenvolvimento') }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
                  ${ls ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-900' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white'}`}
              >
                <Code2 size={15} className="shrink-0 opacity-50" />
                Desenvolvimento
              </button>
            </>
          )}
        </div>

        {/* ── Theme switcher ── */}
        <div className={`px-3 py-2.5 border-t ${ls ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <div className={`flex items-center gap-0.5 p-0.5 rounded-lg border w-full
            ${ls ? 'bg-slate-100/80 border-slate-200' : 'bg-white/5 border-white/[0.06]'}`}>
            {THEME_OPTS.map(({ value, icon, label }) => (
              <button
                type="button"
                key={value}
                onClick={() => setTheme(value)}
                className={[
                  'flex-1 flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[10px] font-semibold transition-all duration-150',
                  theme === value
                    ? ls ? 'bg-white text-slate-700 shadow-sm' : 'bg-white/10 text-white shadow-sm'
                    : ls ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                <span className="text-[11px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Logout ── */}
        <div className={`border-t ${ls ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          <button
            type="button"
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium transition-colors
              ${ls ? 'text-red-500 hover:bg-red-50' : 'text-red-400 hover:bg-red-500/10'}`}
          >
            <LogOut size={15} className="shrink-0 opacity-60" />
            Sair
          </button>
        </div>
      </div>
    )

    return createPortal(dropdownEl, document.body)
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  COMPACT VARIANT  (Frotas, RH — md breakpoint, drawer mobile, no user card)
  // ══════════════════════════════════════════════════════════════════════════════

  if (variant === 'compact') {
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
            onClick={goBack}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2 transition-colors border
              ${ls
                ? `${a.badgeBgLight} ${a.badgeBorderLight} ${a.badgeHoverBgLight}`
                : `${a.badgeBgDark} ${a.badgeBorderDark} ${a.compactBadgeHoverBgDark}`
              }`}
          >
            <span className="text-lg leading-none">{config.moduleEmoji}</span>
            <div className="text-left">
              <p className={`text-[11px] font-bold leading-none ${ls ? a.textLight : a.textDark}`}>{config.moduleName}</p>
              <p className={`text-[9px] mt-0.5 ${ls ? a.subtextLight : a.compactSubtextDark}`}>{moduleSubtitle}</p>
            </div>
            <ChevronLeft size={12} className={`ml-auto ${ls ? a.chevronLight : a.chevronDark}`} />
          </button>

          {/* Nav */}
          <nav className="flex flex-col gap-1">
            {renderNavItems()}
            {renderCadastrosLink()}
          </nav>

          {/* Avatar + Notifications + Footer */}
          <div className="mt-auto space-y-3">
            <div className="flex items-center justify-center gap-2">
              <ApprovalBadge isDark={!ls} />
              <NotificationBell isDark={!ls} />
              <div className="relative" data-avatar-menu>
                {renderAvatarButton('sm')}
                {renderAvatarDropdown('compact-sidebar')}
              </div>
            </div>
            <div className={`pt-3 border-t ${ls ? 'border-slate-100' : 'border-white/5'}`}>
              <p className={`text-[10px] text-center ${ls ? 'text-slate-400' : 'text-slate-600'}`}>
                TEG+ ERP 2.0 · {headerModuleName}
              </p>
            </div>
          </div>
        </aside>

        {/* ── Mobile Header + Drawer ───────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          <header className={`md:hidden flex items-center justify-between px-4 py-3 border-b
            ${ls
              ? 'bg-white border-slate-200'
              : 'border-white/6 bg-white/[0.02]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{config.moduleEmoji}</span>
              <span className={`text-xs font-semibold uppercase tracking-widest ${ls ? a.mobileHeaderLight : a.mobileHeaderDark}`}>
                {headerModuleName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ApprovalBadge isDark={!ls} />
              <NotificationBell isDark={!ls} />
              <div className="relative" data-avatar-menu>
                {renderAvatarButton('sm')}
                {renderAvatarDropdown('header')}
              </div>
              <button onClick={() => setDrawerOpen(o => !o)} className={`${ls ? 'text-slate-500 hover:text-slate-700' : 'text-slate-400 hover:text-white'}`}>
                {drawerOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </header>

          {/* Mobile drawer */}
          {drawerOpen && (
            <nav className={`md:hidden flex flex-col gap-1 p-4 border-b
              ${ls ? 'bg-white border-slate-200' : 'border-white/6 bg-white/[0.03]'}`}>
              {visibleNavForRole.map(n => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  onClick={() => setDrawerOpen(false)}
                  className={({ isActive }) => sidebarLinkClass({ isActive })}
                >
                  <n.icon size={16} />
                  {n.label}
                </NavLink>
              ))}
              {showCadastrosLink && !isRequisitante && (
                <>
                  <div className={`h-px mx-1 my-1 ${ls ? 'bg-slate-100' : 'bg-white/5'}`} />
                  <NavLink
                    to="/cadastros"
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) => sidebarLinkClass({ isActive })}
                  >
                    <Settings size={16} />
                    {variant === 'compact' ? 'Cadastros' : <span>Cadastros</span>}
                  </NavLink>
                </>
              )}
            </nav>
          )}

          {/* Page content */}
          <main className="flex-1 overflow-y-auto styled-scrollbar">
            {headerExtra && (
              <div className={`px-4 py-2 border-b ${isDark ? 'border-white/[0.06] bg-slate-900/40' : 'border-slate-100 bg-slate-50/60'}`}>
                {headerExtra}
              </div>
            )}
            {isRequisitante && location.pathname === homeRoute
              ? <Suspense fallback={null}><MinhasSolicitacoesEmbedded embedded defaultModulo={config.moduleKey} /></Suspense>
              : <Outlet />}
          </main>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  FULL VARIANT  (default — lg breakpoint, sidebar + bottom nav, user card)
  // ══════════════════════════════════════════════════════════════════════════════

  const mobileBottomNav = useMemo(() => {
    const baseNav = config.mobileNav
      ?? (bottomNavMaxItems ? visibleNavForRole.slice(0, bottomNavMaxItems) : visibleNavForRole)

    if (!isRequisitante) return baseNav

    const filtered = baseNav.filter(isNovaSolicitacaoItem)
    if (filtered.length > 0) return filtered
    return visibleNavForRole.filter(isNovaSolicitacaoItem)
  }, [config.mobileNav, bottomNavMaxItems, visibleNavForRole, isRequisitante])

  return (
    <RequisitanteCtx.Provider value={isRequisitante ? { homeRoute } : null}>
    <div className={`min-h-screen ${isDark ? 'bg-[#0c1222]' : ls ? 'bg-slate-50' : 'bg-slate-100'}`}>

      {/* ══════════════════════════════════════════════════════════════
           DESKTOP SIDEBAR  (hidden on mobile, visible ≥ lg)
      ══════════════════════════════════════════════════════════════ */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 z-40
          ${ls ? 'bg-white border-r border-slate-200/80' : 'bg-[#0B1523]'}`}
        style={{ boxShadow: ls ? '1px 0 0 rgba(0,0,0,0.05)' : '4px 0 24px rgba(0,0,0,0.4)' }}
      >
        {/* ── Top: brand + module badge ───────────────────────── */}
        <div className={`px-4 pt-5 pb-4 border-b ${ls ? 'border-slate-100' : 'border-white/[0.06]'}`}>
          {/* Logo + wordmark + actions */}
          <div className="flex items-center gap-2.5 mb-4">
            <button onClick={() => navigate('/')} className="shrink-0" title="Ir para início">
              <LogoTeg size={36} animated={false} />
            </button>
            <button onClick={() => navigate('/')} className="flex-1 min-w-0 text-left" title="Ir para início">
              <p className={`font-black text-lg tracking-tight leading-none ${ls ? 'text-slate-800' : 'text-white'}`}>TEG+</p>
              <p className={`text-[10px] font-medium mt-0.5 ${ls ? 'text-slate-400' : 'text-slate-500'}`}>ERP 2.0</p>
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <ApprovalBadge isDark={!ls} />
              <NotificationBell isDark={!ls} />
              <div className="relative" data-avatar-menu>
                {renderAvatarButton()}
                {renderAvatarDropdown()}
              </div>
            </div>
          </div>

          {/* Active module badge */}
          <button
            onClick={goBack}
            className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-150 group border
              ${ls
                ? `${a.badgeBgLight} ${a.badgeBorderLight} ${a.badgeHoverBgLight} ${a.badgeHoverBorderLight}`
                : `${a.badgeBgDark} ${a.badgeBorderDark} ${a.badgeHoverBgDark} ${a.badgeHoverBorderDark}`
              }`}
            title="Trocar módulo"
          >
            <span className="text-lg leading-none">{config.moduleEmoji}</span>
            <div className="flex-1 text-left">
              <p className={`text-xs font-bold leading-none ${ls ? a.textLight : a.textDark}`}>{config.moduleName}</p>
              <p className={`text-[9px] mt-0.5 ${ls ? a.subtextLight : a.subtextDark}`}>{moduleSubtitle}</p>
            </div>
            <LayoutGrid
              size={13}
              className={`transition-colors shrink-0 ${ls ? `${a.gridLight} ${a.gridHoverLight}` : `${a.gridDark} ${a.gridHoverDark}`}`}
            />
          </button>
        </div>

        {/* ── Navigation ────────────────────────────────────── */}
        <nav className={`flex-1 px-3 py-3 overflow-y-auto styled-scrollbar ${config.navSections ? 'space-y-1' : 'space-y-0.5'}`}>
          {config.navSections ? renderSectionedNav() : renderNavItems()}
          {renderCadastrosLink()}

        </nav>

      </aside>

      {/* ══════════════════════════════════════════════════════════════
           MAIN CONTENT  (offset for sidebar on desktop)
      ══════════════════════════════════════════════════════════════ */}
      <div className="lg:ml-64 flex flex-col min-h-screen">

        {/* ── Mobile-only header ──────────────────────────────── */}
        <header
          className={`lg:hidden px-4 py-3 sticky top-0 z-30 flex items-center gap-3
            ${ls ? 'bg-white border-b border-slate-200' : 'bg-[#0B1523] text-white'}`}
          style={{ boxShadow: ls ? '0 1px 3px rgba(0,0,0,0.05)' : '0 2px 20px rgba(0,0,0,0.4)' }}
        >
          {/* Logo */}
          <button onClick={() => navigate('/')} className="shrink-0" title="Ir para início">
            <LogoTeg size={28} animated={false} />
          </button>

          {/* Brand */}
          <div className="flex-1 min-w-0">
            <button onClick={() => navigate('/')} className="flex items-baseline gap-1.5">
              <h1 className={`text-sm font-black leading-none ${ls ? 'text-slate-800' : 'text-white'}`}>TEG+</h1>
              <span className={`text-[9px] font-semibold ${ls ? a.mobileHeaderLight : a.mobileHeaderDark}`}>{headerModuleName}</span>
            </button>
          </div>

          {/* Notifications + Avatar */}
          <ApprovalBadge isDark={!ls} />
              <NotificationBell isDark={!ls} />
          <div className="relative" data-avatar-menu>
            {renderAvatarButton('sm')}
            {renderAvatarDropdown('header')}
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────────── */}
        {headerExtra && (
          <div className={`px-4 py-2 border-b ${isDark ? 'border-white/[0.06] bg-slate-900/40' : 'border-slate-100 bg-slate-50/60'}`}>
            {headerExtra}
          </div>
        )}
        <main className="flex-1 px-4 py-5 pb-28 lg:pb-8">
          <div className={`${maxWidth} mx-auto animate-page-enter`}>
            {isRequisitante && location.pathname === homeRoute
              ? <Suspense fallback={null}><MinhasSolicitacoesEmbedded embedded defaultModulo={config.moduleKey} /></Suspense>
              : <Outlet />}
          </div>
        </main>

        {/* ── Mobile bottom nav (hidden on desktop) ────────────── */}
        <nav
          className={`lg:hidden fixed bottom-0 inset-x-0 z-40 border-t
            ${ls ? 'glass-light border-slate-200' : 'glass-dark border-white/[0.06]'}`}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex justify-around max-w-lg mx-auto px-1 py-1">
            {mobileBottomNav.map(({ to, icon: Icon, label, end }) => (
              <NavLink key={to} to={to} end={end} className={bottomLinkClass}>
                <Icon className="w-5 h-5 mb-0.5" />
                {truncateBottomLabels && label.length > 8 ? label.slice(0, 8) + '.' : label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
    </RequisitanteCtx.Provider>
  )
}
