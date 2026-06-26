import { useNavigate } from 'react-router-dom'
import {
  Clock, FileText, Receipt, MessageSquare,
  ClipboardList, BookOpen, ArrowLeft, Smartphone,
  Target, Users, Star, ChevronRight, Wifi, Signal,
  BatteryFull, Lock, ExternalLink, type LucideIcon,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

// Link do Secullum — espelho/registros de ponto do colaborador.
const SECULLUM_PONTO_URL = 'https://autenticador.secullum.com.br/Authorization?response_type=code&client_id=3001&redirect_uri=https://pontoweb.secullum.com.br/Auth'

// ── Tiles do app ──────────────────────────────────────────────────────────────
const TILES: { icon: LucideIcon; label: string; color: string; glow: string; iconColor: string; available: boolean; href?: string }[] = [
  {
    icon: Clock,
    label: 'Acesso\nao Ponto',
    color: 'from-teal-500 to-teal-600',
    glow: 'shadow-teal-500/30',
    iconColor: 'text-white',
    available: true,
    href: SECULLUM_PONTO_URL,
  },
  {
    icon: FileText,
    label: 'Relatório\nde Ponto',
    color: 'from-cyan-500 to-cyan-600',
    glow: 'shadow-cyan-500/30',
    iconColor: 'text-white',
    available: true,
    href: SECULLUM_PONTO_URL,
  },
  {
    icon: Receipt,
    label: 'Holerite',
    color: 'from-emerald-500 to-emerald-600',
    glow: 'shadow-emerald-500/30',
    iconColor: 'text-white',
    available: false,
  },
  {
    icon: MessageSquare,
    label: 'Recados e\nComunicações',
    color: 'from-violet-500 to-violet-600',
    glow: 'shadow-violet-500/30',
    iconColor: 'text-white',
    available: false,
  },
  {
    icon: ClipboardList,
    label: 'Formulários\ne Sorteios',
    color: 'from-indigo-500 to-indigo-600',
    glow: 'shadow-indigo-500/30',
    iconColor: 'text-white',
    available: false,
  },
  {
    icon: BookOpen,
    label: 'Manual do\nColaborador',
    color: 'from-amber-500 to-amber-600',
    glow: 'shadow-amber-500/30',
    iconColor: 'text-white',
    available: false,
  },
]

// ── Features da direita ───────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Clock,
    title: 'Ponto Digital',
    desc: 'Bata o ponto direto pelo celular e acompanhe seu espelho de ponto em tempo real.',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10 border-teal-500/20',
    items: ['Acesso ao ponto', 'Relatório de ponto'],
  },
  {
    icon: Receipt,
    title: 'Holerite',
    desc: 'Consulte seus contracheques a qualquer hora, sem precisar ir ao RH.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    items: ['Holerite mensal', 'Histórico de pagamentos'],
  },
  {
    icon: MessageSquare,
    title: 'Comunicação',
    desc: 'Receba recados da empresa, avisos e resultados de sorteios em primeira mão.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    items: ['Recados e comunicações', 'Formulários RH e sorteios'],
  },
  {
    icon: BookOpen,
    title: 'Manual do Colaborador',
    desc: 'Tudo o que você precisa saber sobre a TEG — processos, políticas, benefícios e acessos.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    items: ['Processos e políticas', 'Acessos TEG+', 'Metas e PDI'],
  },
]

export default function PortalTEG() {
  const { isLightSidebar: isLight } = useTheme()
  const navigate = useNavigate()

  return (
    <div className={`min-h-screen ${isLight ? 'bg-slate-50' : 'bg-[#0b1929]'}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`border-b px-4 sm:px-8 py-4 flex items-center gap-4 ${
        isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
      }`}>
        <button
          onClick={() => navigate(-1)}
          className={`p-2 rounded-lg transition-colors ${
            isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-slate-400'
          }`}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className={`text-lg font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Smartphone size={18} className="text-teal-400" />
            Portal TEG
          </h1>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            O aplicativo do colaborador TEG
          </p>
        </div>
        <div className="ml-auto">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <Lock size={11} />
            Em desenvolvimento
          </span>
        </div>
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-teal-500/15 text-teal-400 border border-teal-500/25 mb-4">
            <Star size={11} />
            Conceito · Programa Energia se Transmite pela União
          </div>
          <h2 className={`text-3xl sm:text-4xl font-bold mb-3 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Tudo que o colaborador precisa
            <span className="block text-teal-400">em um só lugar.</span>
          </h2>
          <p className={`text-base max-w-xl mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Um app simples, leve e direto. Ponto, holerite, recados e o manual da TEG —
            acessíveis pelo celular, sem complicação.
          </p>
          <div className="mt-6 flex justify-center">
            <a href={SECULLUM_PONTO_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold shadow-lg shadow-teal-500/30 transition-all">
              <Clock size={18} /> Acessar meu Ponto <ExternalLink size={15} />
            </a>
          </div>
        </div>

        {/* Layout principal */}
        <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">

          {/* ── Mockup de celular ──────────────────────────────────────────── */}
          <div className="flex-shrink-0 flex justify-center lg:justify-end lg:sticky lg:top-8">
            <div className="relative">
              {/* Glow de fundo */}
              {!isLight && (
                <div className="absolute inset-0 rounded-[44px] bg-teal-500/10 blur-2xl scale-110" />
              )}

              {/* Frame do celular */}
              <div className={`relative w-[240px] rounded-[40px] p-[3px] shadow-2xl ${
                isLight
                  ? 'bg-gradient-to-b from-slate-300 to-slate-400'
                  : 'bg-gradient-to-b from-slate-600 to-slate-800'
              }`}>
                <div className={`rounded-[38px] overflow-hidden ${
                  isLight ? 'bg-white' : 'bg-[#0d1b2e]'
                }`}>

                  {/* Status bar */}
                  <div className={`flex items-center justify-between px-5 pt-3 pb-1 text-[10px] font-semibold ${
                    isLight ? 'text-slate-700 bg-white' : 'text-slate-300 bg-[#0d1b2e]'
                  }`}>
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <Signal size={11} />
                      <Wifi size={11} />
                      <BatteryFull size={11} />
                    </div>
                  </div>

                  {/* Notch */}
                  <div className="flex justify-center mb-2">
                    <div className={`w-20 h-5 rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                  </div>

                  {/* App header */}
                  <div className={`px-4 pt-1 pb-4 ${isLight ? 'bg-white' : 'bg-[#0d1b2e]'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Olá, colaborador!</p>
                        <p className={`text-[13px] font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>Portal TEG</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                        <Users size={14} className="text-white" />
                      </div>
                    </div>

                    {/* Banner de boas-vindas */}
                    <div className="mt-2 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-700 p-3">
                      <p className="text-white text-[10px] font-semibold">Energia se Transmite pela União</p>
                      <p className="text-teal-100 text-[9px] mt-0.5">Programa TEG 2026</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className={`mx-4 mb-3 border-t ${isLight ? 'border-slate-100' : 'border-white/5'}`} />

                  {/* Grid de tiles */}
                  <div className="px-4 pb-2">
                    <p className={`text-[9px] font-semibold mb-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      ACESSO RÁPIDO
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {TILES.map((tile, i) => {
                        const Icon = tile.icon
                        const inner = (
                          <>
                            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tile.color} shadow-lg ${tile.glow} flex items-center justify-center`}>
                              <Icon size={22} className={tile.iconColor} />
                            </div>
                            <p className={`text-center text-[8px] leading-tight ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {tile.label.split('\n').map((l, j) => (
                                <span key={j} className="block">{l}</span>
                              ))}
                            </p>
                          </>
                        )
                        return tile.href ? (
                          <a key={i} href={tile.href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 active:scale-95 transition-transform">{inner}</a>
                        ) : (
                          <div key={i} className="flex flex-col items-center gap-1">{inner}</div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Bottom bar */}
                  <div className={`mt-4 px-4 py-3 flex justify-around border-t ${
                    isLight ? 'border-slate-100 bg-white' : 'border-white/5 bg-[#0d1b2e]'
                  }`}>
                    {[Clock, MessageSquare, BookOpen].map((Icon, i) => (
                      <div key={i} className={`p-2 rounded-xl ${i === 0 ? 'bg-teal-500/15' : ''}`}>
                        <Icon size={16} className={i === 0 ? 'text-teal-400' : isLight ? 'text-slate-400' : 'text-slate-600'} />
                      </div>
                    ))}
                  </div>

                  {/* Home indicator */}
                  <div className="flex justify-center py-2">
                    <div className={`w-20 h-1 rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Features ────────────────────────────────────────────────────── */}
          <div className="flex-1 space-y-4 min-w-0">

            {FEATURES.map((feat, i) => {
              const Icon = feat.icon
              return (
                <div
                  key={i}
                  className={`rounded-2xl border p-5 transition-all ${feat.bg} ${
                    isLight ? 'hover:shadow-md' : 'hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                      isLight ? 'bg-white shadow-sm' : 'bg-white/10'
                    }`}>
                      <Icon size={20} className={feat.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-sm mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {feat.title}
                      </h3>
                      <p className={`text-xs leading-relaxed mb-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {feat.desc}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {feat.items.map((item, j) => (
                          <span
                            key={j}
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${
                              isLight ? 'bg-white text-slate-600 shadow-sm' : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            <ChevronRight size={10} />
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Card de contexto */}
            <div className={`rounded-2xl border p-5 ${
              isLight
                ? 'bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200'
                : 'bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border-teal-500/20'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
                  <Target size={20} className="text-white" />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${isLight ? 'text-teal-800' : 'text-teal-300'}`}>
                    Por que o Portal TEG?
                  </p>
                  <p className={`text-xs ${isLight ? 'text-teal-600' : 'text-teal-500'}`}>
                    Programa Energia se Transmite pela União · 2026
                  </p>
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${isLight ? 'text-teal-700' : 'text-teal-400'}`}>
                O colaborador que bate ponto no canteiro às 6h da manhã não tem acesso fácil
                ao RH. O Portal TEG resolve isso: um ícone no celular, toque único, tudo resolvido.
                Sem precisar ligar, sem precisar esperar.
              </p>
            </div>
          </div>
        </div>

        {/* ── Roadmap ──────────────────────────────────────────────────────── */}
        <div className={`mt-10 rounded-2xl border p-6 ${
          isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
        }`}>
          <h3 className={`font-bold mb-4 flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Star size={16} className="text-amber-400" />
            Roadmap de entrega
          </h3>
          <div className="flex flex-wrap gap-3">
            {[
              { fase: 'Fase 1', label: 'Acesso ao ponto + Holerite', status: 'planned', color: 'teal' },
              { fase: 'Fase 2', label: 'Recados e Formulários', status: 'planned', color: 'violet' },
              { fase: 'Fase 3', label: 'Manual do Colaborador', status: 'planned', color: 'amber' },
              { fase: 'Fase 4', label: 'Metas e PDI + Acessos TEG+', status: 'planned', color: 'indigo' },
            ].map((fase, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                }`}
              >
                <span className={`text-xs font-bold text-${fase.color}-400`}>{fase.fase}</span>
                <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{fase.label}</span>
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-medium">
                  Em breve
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
