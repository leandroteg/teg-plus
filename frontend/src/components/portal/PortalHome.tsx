import { useEffect, useState } from 'react'
import {
  Clock, FileText, BookOpen, ClipboardList, Zap, BarChart3, LogOut, User, Sparkles,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { usePortalAuth, type PortalUser } from '../../hooks/usePortalAuth'

interface BotaoConfig {
  key: string
  label: string
  icon: React.ElementType
  bg: string
  iconBg: string
  href: string
  external?: boolean
}

const BOTOES: BotaoConfig[] = [
  { key: 'ponto',         label: 'Ponto',                 icon: Clock,         bg: 'from-sky-500 to-blue-600',         iconBg: 'bg-sky-400/30',     href: 'https://ponto.teguniao.com.br', external: true },
  { key: 'holerite',      label: 'Holerite',              icon: FileText,      bg: 'from-emerald-500 to-teal-600',     iconBg: 'bg-emerald-400/30', href: 'https://holerite.teguniao.com.br', external: true },
  { key: 'manual',        label: 'Manual do Colaborador', icon: BookOpen,      bg: 'from-violet-500 to-purple-600',    iconBg: 'bg-violet-400/30',  href: '/portal/manual' },
  { key: 'procedimentos', label: 'Procedimentos',         icon: ClipboardList, bg: 'from-amber-500 to-orange-600',     iconBg: 'bg-amber-400/30',   href: '/portal/procedimentos' },
  { key: 'tegplus',       label: 'TEG+ ERP',              icon: Zap,           bg: 'from-teal-500 to-cyan-600',        iconBg: 'bg-teal-400/30',    href: '/', external: true },
  { key: 'pesquisas',     label: 'Pesquisas',             icon: BarChart3,     bg: 'from-rose-500 to-pink-600',        iconBg: 'bg-rose-400/30',    href: '/portal/pesquisas' },
]

// ── Banner do Mural ─────────────────────────────────────────────────────────

interface Banner {
  id: string
  titulo: string
  subtitulo: string | null
  imagem_url: string
  cor_titulo: string
  cor_subtitulo: string
}

function MuralBanner() {
  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ['portal_teg_banners'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_teg_banners')
      if (error) return []
      return (data ?? []) as Banner[]
    },
    staleTime: 5 * 60 * 1000,
  })
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000)
    return () => clearInterval(t)
  }, [banners.length])

  if (banners.length === 0) return null
  const b = banners[idx]

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-cover bg-center min-h-[80px] flex items-center px-5 py-3"
      style={{ backgroundImage: `linear-gradient(90deg, rgba(15,23,42,0.85), rgba(15,23,42,0.6)), url(${b.imagem_url})` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold truncate" style={{ color: b.cor_titulo || '#FFFFFF' }}>
          {b.titulo}
        </p>
        {b.subtitulo && (
          <p className="text-xs mt-0.5 truncate" style={{ color: b.cor_subtitulo || '#CBD5E1' }}>
            {b.subtitulo}
          </p>
        )}
      </div>
      {banners.length > 1 && (
        <div className="flex gap-1 ml-3 shrink-0">
          {banners.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-teal-300 w-4' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Home Component ──────────────────────────────────────────────────────────

export default function PortalHome({ user }: { user: PortalUser }) {
  const { logout } = usePortalAuth()
  const primeiroNome = user.nome.split(' ')[0]

  function handleClick(b: BotaoConfig) {
    if (b.external) {
      window.open(b.href, '_blank', 'noopener,noreferrer')
    } else {
      // Por enquanto: alerta. Implementar páginas no futuro.
      alert(`${b.label} — em breve.`)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #0F172A 0%, #134E4A 50%, #0F766E 100%)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <header className="px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 backdrop-blur-sm border border-teal-400/25 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-teal-300" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-extrabold text-sm leading-tight truncate">
              Portal <span className="text-teal-300">TEG</span>
            </p>
            <p className="text-slate-400 text-[10px] leading-tight mt-0.5 truncate">
              Olá, {primeiroNome}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 text-xs font-medium"
            title={user.nome}
          >
            <User size={12} />
            {primeiroNome}
          </div>
          <button
            onClick={logout}
            className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all"
            title="Sair"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Banner mural */}
      <div className="px-4 sm:px-6 mb-4">
        <MuralBanner />
      </div>

      {/* Grid 6 botões — ocupa tela inteira */}
      <main className="flex-1 px-4 sm:px-6 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 h-full">
          {BOTOES.map((b) => {
            const Icon = b.icon
            return (
              <button
                key={b.key}
                onClick={() => handleClick(b)}
                className={`group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br ${b.bg} shadow-lg hover:shadow-2xl transition-all active:scale-[0.97] hover:-translate-y-0.5 flex flex-col items-center justify-center p-4 sm:p-6 gap-3 sm:gap-4 min-h-[140px] sm:min-h-[180px]`}
              >
                {/* Glow background */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_70%)]" />

                <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl ${b.iconBg} backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-md`}>
                  <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" strokeWidth={2} />
                </div>

                <span className="relative text-white font-extrabold text-sm sm:text-base text-center leading-tight tracking-tight">
                  {b.label}
                </span>
              </button>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 pb-3 text-center">
        <p className="text-[10px] text-slate-500 font-medium">
          Portal TEG v1.0 · TEG União Engenharia
        </p>
      </footer>
    </div>
  )
}
