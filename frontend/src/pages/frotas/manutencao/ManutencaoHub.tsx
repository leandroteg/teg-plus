import { useState } from 'react'
import { CalendarDays, ClipboardList, Wrench, History } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useOrdensServico, useChecklists } from '../../../hooks/useFrotas'
import Planejamento         from './Planejamento'
import ChecklistsManutencao from './ChecklistsManutencao'
import OSAbertas            from './OSAbertas'
import HistoricoOS          from './HistoricoOS'

// ── Tab Config ───────────────────────────────────────────────────────────────

type TabKey = 'planejamento' | 'checklists' | 'os' | 'historico'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'planejamento', label: 'Planejamento' },
  { key: 'checklists',   label: 'Checklists'   },
  { key: 'os',           label: 'OS Abertas'   },
  { key: 'historico',    label: 'Histórico'     },
]

const TAB_ICONS: Record<TabKey, React.ElementType> = {
  planejamento: CalendarDays,
  checklists:   ClipboardList,
  os:           Wrench,
  historico:    History,
}

const TAB_ACCENT: Record<TabKey, {
  bg: string; bgActive: string; text: string; textActive: string; border: string
}> = {
  planejamento: {
    bg: 'hover:bg-sky-50',       bgActive: 'bg-sky-50',
    text: 'text-sky-600',        textActive: 'text-sky-800',
    border: 'border-sky-500',
  },
  checklists: {
    bg: 'hover:bg-violet-50',    bgActive: 'bg-violet-50',
    text: 'text-violet-600',     textActive: 'text-violet-800',
    border: 'border-violet-500',
  },
  os: {
    bg: 'hover:bg-rose-50',      bgActive: 'bg-rose-50',
    text: 'text-rose-600',       textActive: 'text-rose-800',
    border: 'border-rose-500',
  },
  historico: {
    bg: 'hover:bg-emerald-50',   bgActive: 'bg-emerald-50',
    text: 'text-emerald-600',    textActive: 'text-emerald-800',
    border: 'border-emerald-500',
  },
}

const TAB_ACCENT_DARK: Record<TabKey, {
  bg: string; bgActive: string; text: string; textActive: string; border: string
}> = {
  planejamento: {
    bg: 'hover:bg-sky-500/10',     bgActive: 'bg-sky-500/15',
    text: 'text-sky-400',          textActive: 'text-sky-200',
    border: 'border-sky-500/40',
  },
  checklists: {
    bg: 'hover:bg-violet-500/10',  bgActive: 'bg-violet-500/15',
    text: 'text-violet-400',       textActive: 'text-violet-200',
    border: 'border-violet-500/40',
  },
  os: {
    bg: 'hover:bg-rose-500/10',    bgActive: 'bg-rose-500/15',
    text: 'text-rose-400',         textActive: 'text-rose-200',
    border: 'border-rose-500/40',
  },
  historico: {
    bg: 'hover:bg-emerald-500/10', bgActive: 'bg-emerald-500/15',
    text: 'text-emerald-400',      textActive: 'text-emerald-200',
    border: 'border-emerald-500/40',
  },
}

const COMPS: Record<TabKey, React.ComponentType> = {
  planejamento: Planejamento,
  checklists:   ChecklistsManutencao,
  os:           OSAbertas,
  historico:    HistoricoOS,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ManutencaoHub() {
  const [active, setActive] = useState<TabKey>('planejamento')
  const { isDark } = useTheme()
  const { data: ordens = [] } = useOrdensServico()
  const { data: checklists = [] } = useChecklists()
  const counts: Record<TabKey, number> = {
    planejamento: 0,
    checklists: 0,
    os: ordens.filter(o => !['concluida', 'cancelada', 'rejeitada'].includes(o.status)).length,
    historico: ordens.filter(o => o.status === 'concluida').length,
  }
  const Comp = COMPS[active] ?? Planejamento

  return (
    <div className="flex flex-col h-full -mx-4 md:mx-0">
      <div className="px-3 sm:px-4 md:px-6 pt-4 pb-3">
        <div className={`flex gap-1 overflow-x-auto hide-scrollbar rounded-2xl border p-1 ${
          isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
        }`}>
          {TABS.map((tab) => {
            const isActive = active === tab.key
            const Icon = TAB_ICONS[tab.key]
            const accent = isDark ? TAB_ACCENT_DARK[tab.key] : TAB_ACCENT[tab.key]
            return (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                className={`min-w-fit whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-all md:px-4 md:py-2.5 md:flex-1 ${
                  isActive
                    ? `${accent.bgActive} ${accent.textActive} ${accent.border} font-bold shadow-sm`
                    : `${accent.bg} ${accent.text} border-transparent font-medium ${isDark ? 'hover:bg-white/[0.06] hover:shadow-sm' : 'hover:bg-white hover:shadow-sm'}`
                } flex items-center justify-center gap-2`}
              >
                <Icon size={15} className="shrink-0" />
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    isActive ? 'bg-white/25 text-current' : isDark ? 'bg-white/[0.08] text-slate-400' : 'bg-slate-200/80 text-slate-500'
                  }`}>
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-3 sm:px-4 md:px-6">
        <Comp />
      </div>
    </div>
  )
}
