import {
  HardHat, ClipboardList, CloudSun, Wallet, Receipt,
  Users, ArrowRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useObrasKPIs, useApontamentos } from '../../hooks/useObras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

const STATUS_APONTAMENTO: Record<string, { label: string; light: string; dark: string }> = {
  rascunho:   { label: 'Rascunho',   light: 'bg-slate-100 text-slate-600', dark: 'bg-slate-500/15 text-slate-400' },
  confirmado: { label: 'Confirmado', light: 'bg-blue-100 text-blue-700',   dark: 'bg-blue-500/15 text-blue-300'  },
  validado:   { label: 'Validado',   light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
}

// ── KPI accent map (static classes for Tailwind JIT) ─────────────────────────

const ACCENT_MAP: Record<string, { iconBgLight: string; iconBgDark: string; iconText: string }> = {
  blue:   { iconBgLight: 'bg-blue-50',   iconBgDark: 'bg-blue-500/10',   iconText: 'text-blue-500' },
  amber:  { iconBgLight: 'bg-amber-50',  iconBgDark: 'bg-amber-500/10',  iconText: 'text-amber-500' },
  violet: { iconBgLight: 'bg-violet-50', iconBgDark: 'bg-violet-500/10', iconText: 'text-violet-500' },
  rose:   { iconBgLight: 'bg-rose-50',   iconBgDark: 'bg-rose-500/10',   iconText: 'text-rose-500' },
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent, isLight,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof HardHat
  accent: string
  isLight: boolean
}) {
  const a = ACCENT_MAP[accent] ?? ACCENT_MAP.blue
  return (
    <div className={`rounded-2xl border p-5 ${isLight
      ? 'bg-white border-slate-200 shadow-sm'
      : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight
          ? a.iconBgLight
          : a.iconBgDark
        }`}>
          <Icon size={18} className={a.iconText} />
        </div>
        <p className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {label}
        </p>
      </div>
      <p className={`text-3xl font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{sub}</p>
      )}
    </div>
  )
}

// ── Quick Link ───────────────────────────────────────────────────────────────

function QuickLink({
  to, label, desc, icon: Icon, isLight,
}: {
  to: string; label: string; desc: string; icon: typeof HardHat; isLight: boolean
}) {
  return (
    <Link
      to={to}
      className={`group rounded-2xl border p-4 flex items-center gap-4 transition-colors ${isLight
        ? 'bg-white border-slate-200 shadow-sm hover:border-teal-300 hover:shadow-md'
        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]'
      }`}
    >
      <Icon size={20} className={`shrink-0 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{label}</p>
        <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{desc}</p>
      </div>
      <ArrowRight size={16} className={`shrink-0 transition-transform group-hover:translate-x-1 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
    </Link>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ObrasHome() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: kpis, isLoading } = useObrasKPIs()
  const { data: recentApontamentos = [] } = useApontamentos()

  const latest5 = recentApontamentos.slice(0, 5)

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          Painel de Obras
        </h1>
        <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Visao geral de apontamentos, RDOs, adiantamentos e equipes
        </p>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`rounded-2xl h-28 animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.03]'}`} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Apontamentos Hoje"
            value={kpis?.apontamentos_hoje ?? 0}
            sub="registros do dia"
            icon={ClipboardList}
            accent="blue"
            isLight={isLight}
          />
          <KpiCard
            label="RDOs Pendentes"
            value={kpis?.rdos_pendentes ?? 0}
            sub="aguardando finalizar"
            icon={CloudSun}
            accent="amber"
            isLight={isLight}
          />
          <KpiCard
            label="Adiantamentos Abertos"
            value={kpis?.adiantamentos_abertos ?? 0}
            sub="aguardando prestacao"
            icon={Wallet}
            accent="violet"
            isLight={isLight}
          />
          <KpiCard
            label="Prestacoes Pendentes"
            value={kpis?.prestacoes_pendentes ?? 0}
            sub="aguardando aprovacao"
            icon={Receipt}
            accent="rose"
            isLight={isLight}
          />
        </div>
      )}

      {/* Recent Activity */}
      <div className={`rounded-2xl border p-5 ${isLight
        ? 'bg-white border-slate-200 shadow-sm'
        : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-white'}`}>
            <ClipboardList size={16} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            Apontamentos Recentes
          </h2>
          <Link
            to="/obras/apontamentos"
            className={`text-xs font-medium flex items-center gap-1 ${isLight ? 'text-teal-600 hover:text-teal-700' : 'text-teal-400 hover:text-teal-300'}`}
          >
            Ver todos <ArrowRight size={12} />
          </Link>
        </div>

        {latest5.length === 0 ? (
          <p className={`text-sm text-center py-8 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum apontamento registrado
          </p>
        ) : (
          <div className="space-y-2">
            {latest5.map(ap => {
              const st = STATUS_APONTAMENTO[ap.status] ?? STATUS_APONTAMENTO.rascunho
              return (
                <div
                  key={ap.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isLight
                    ? 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                    : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      {ap.atividade}
                    </p>
                    <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {ap.obra?.nome ?? '—'}{ap.frente?.nome ? ` / ${ap.frente.nome}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {ap.quantidade_executada} {ap.unidade ?? 'un'}
                    </p>
                    <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {fmtDate(ap.data_apontamento)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className={`text-sm font-semibold mb-3 ${isLight ? 'text-slate-700' : 'text-white'}`}>
          Acesso Rapido
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink to="/obras/apontamentos" label="Apontamentos" desc="Registro diario de producao" icon={ClipboardList} isLight={isLight} />
          <QuickLink to="/obras/rdo" label="RDO" desc="Relatorio diario de obra" icon={CloudSun} isLight={isLight} />
          <QuickLink to="/obras/adiantamentos" label="Adiantamentos" desc="Solicitacoes e prestacao de contas" icon={Wallet} isLight={isLight} />
          <QuickLink to="/obras/prestacao" label="Prestacao de Contas" desc="Despesas e reembolsos" icon={Receipt} isLight={isLight} />
          <QuickLink to="/obras/equipe" label="Equipes" desc="Colaboradores por obra e frente" icon={Users} isLight={isLight} />
        </div>
      </div>
    </div>
  )
}
