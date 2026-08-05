// Fita de abas horizontal — mesmo padrão visual do pipeline do Financeiro
// (CPPipeline/PipelineRail): card arredondado com abas-pílula (ícone + rótulo +
// chip de contagem), a ativa com fundo/borda coloridos.
// EQUIPE: Chamados → Quadro → Respostas → Base. COLABORADOR: Painel → Meus
// Chamados → Base de Conhecimento (contagens escopadas pela RLS aos dele).
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Inbox, Columns3, AlertTriangle, History, MessageSquareText, BookOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getDashboardStats } from '../data/tickets'
import { useTiAuth } from '../data/auth'

type Accent = 'sky' | 'violet' | 'amber' | 'rose' | 'teal' | 'emerald'

// Classes literais (JIT do Tailwind não aceita concat dinâmico).
const ACCENT: Record<Accent, { active: string; idle: string; badgeActive: string }> = {
  sky:     { active: 'bg-sky-500/10 text-sky-700 border-sky-400/40',         idle: 'text-sky-600 hover:bg-slate-50',     badgeActive: 'bg-sky-500/15 text-sky-700' },
  violet:  { active: 'bg-violet-500/10 text-violet-700 border-violet-400/40', idle: 'text-violet-600 hover:bg-slate-50',  badgeActive: 'bg-violet-500/15 text-violet-700' },
  amber:   { active: 'bg-amber-500/10 text-amber-700 border-amber-400/40',    idle: 'text-amber-600 hover:bg-slate-50',   badgeActive: 'bg-amber-500/15 text-amber-700' },
  rose:    { active: 'bg-rose-500/10 text-rose-700 border-rose-400/40',       idle: 'text-rose-600 hover:bg-slate-50',    badgeActive: 'bg-rose-500/15 text-rose-700' },
  teal:    { active: 'bg-teal-500/10 text-teal-700 border-teal-400/40',       idle: 'text-teal-600 hover:bg-slate-50',    badgeActive: 'bg-teal-500/15 text-teal-700' },
  emerald: { active: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/40', idle: 'text-emerald-600 hover:bg-slate-50', badgeActive: 'bg-emerald-500/15 text-emerald-700' },
}

interface Tab {
  to: string
  end?: boolean
  label: string
  icon: LucideIcon
  accent: Accent
  count?: number
}

export function TiTabs() {
  const { isStaff } = useTiAuth()
  // Mesmo queryKey/fn da Home — cache compartilhado do react-query.
  const { data: stats } = useQuery({ queryKey: ['ti', 'stats'], queryFn: getDashboardStats, enabled: isStaff })

  // Fita é da EQUIPE. O colaborador segue o padrão Compras: home = lista
  // Meus Chamados com abas Abertos/Encerrados, sem fita.
  if (!isStaff) return null

  const emAberto = stats ? stats.abertos + stats.emAndamento + stats.aguardando : undefined

  // Só o essencial do dia a dia. As telas de apoio (Precisam de Atenção,
  // Chamados Recentes, Respostas Prontas, Base de Conhecimento) ficam em
  // /ti/mais, alcançáveis pelo submenu do cabeçalho (TiSubmenu).
  const TABS: Tab[] = [
    { to: '/ti/chamados', end: true, label: 'Chamados', icon: Inbox, accent: 'sky', count: stats?.total },
    { to: '/ti/quadro', label: 'Quadro de Chamados', icon: Columns3, accent: 'violet', count: emAberto },
  ]

  return (
    <div className="mb-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-1.5">
      <div className="min-w-0 overflow-x-auto">
        <div className="flex min-w-max items-stretch gap-1.5 md:w-full">
          {TABS.map(({ to, end, label, icon: Icon, accent, count }) => {
            const a = ACCENT[accent]
            return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-[52px] min-w-fit shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition-all md:flex-1 ${
                    isActive ? `border font-bold shadow-sm ${a.active}` : `font-medium ${a.idle}`
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} className="shrink-0" />
                    {label}
                    {count != null && count > 0 && (
                      <span className={`flex h-[24px] min-w-[24px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                        isActive ? a.badgeActive : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </div>
    </div>
  )
}
