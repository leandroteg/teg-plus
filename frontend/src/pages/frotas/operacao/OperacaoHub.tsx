import { useState } from 'react'
import { CalendarDays, Fuel, AlertCircle, Radio, BarChart3 } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import AgendaAlocacao from './AgendaAlocacao'
import AbastecimentosOp from './AbastecimentosOp'
import MultasPedagios from './MultasPedagios'
import TelemetriaOp from './TelemetriaOp'
import Indicadores from './Indicadores'

// ── Tab Config ───────────────────────────────────────────────────────────────

type TabKey = 'agenda' | 'abastecimentos' | 'multas' | 'telemetria' | 'indicadores'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'agenda',          label: 'Agenda'            },
  { key: 'abastecimentos',  label: 'Abastecimentos'    },
  { key: 'multas',          label: 'Multas & Pedágios' },
  { key: 'telemetria',      label: 'Telemetria'        },
  { key: 'indicadores',     label: 'Indicadores'       },
]

const TAB_ICONS: Record<TabKey, React.ElementType> = {
  agenda:         CalendarDays,
  abastecimentos: Fuel,
  multas:         AlertCircle,
  telemetria:     Radio,
  indicadores:    BarChart3,
}

const TAB_ACCENT: Record<TabKey, {
  bg: string; bgActive: string; text: string; textActive: string; border: string
}> = {
  agenda: {
    bg: 'hover:bg-sky-50',       bgActive: 'bg-sky-50',
    text: 'text-sky-600',        textActive: 'text-sky-800',
    border: 'border-sky-500',
  },
  abastecimentos: {
    bg: 'hover:bg-amber-50',     bgActive: 'bg-amber-50',
    text: 'text-amber-600',      textActive: 'text-amber-800',
    border: 'border-amber-500',
  },
  multas: {
    bg: 'hover:bg-rose-50',      bgActive: 'bg-rose-50',
    text: 'text-rose-600',       textActive: 'text-rose-800',
    border: 'border-rose-500',
  },
  telemetria: {
    bg: 'hover:bg-violet-50',    bgActive: 'bg-violet-50',
    text: 'text-violet-600',     textActive: 'text-violet-800',
    border: 'border-violet-500',
  },
  indicadores: {
    bg: 'hover:bg-emerald-50',   bgActive: 'bg-emerald-50',
    text: 'text-emerald-600',    textActive: 'text-emerald-800',
    border: 'border-emerald-500',
  },
}

const TAB_ACCENT_DARK: Record<TabKey, {
  bg: string; bgActive: string; text: string; textActive: string; border: string
}> = {
  agenda: {
    bg: 'hover:bg-sky-500/10',     bgActive: 'bg-sky-500/15',
    text: 'text-sky-400',          textActive: 'text-sky-200',
    border: 'border-sky-500/40',
  },
  abastecimentos: {
    bg: 'hover:bg-amber-500/10',   bgActive: 'bg-amber-500/15',
    text: 'text-amber-400',        textActive: 'text-amber-200',
    border: 'border-amber-500/40',
  },
  multas: {
    bg: 'hover:bg-rose-500/10',    bgActive: 'bg-rose-500/15',
    text: 'text-rose-400',         textActive: 'text-rose-200',
    border: 'border-rose-500/40',
  },
  telemetria: {
    bg: 'hover:bg-violet-500/10',  bgActive: 'bg-violet-500/15',
    text: 'text-violet-400',       textActive: 'text-violet-200',
    border: 'border-violet-500/40',
  },
  indicadores: {
    bg: 'hover:bg-emerald-500/10', bgActive: 'bg-emerald-500/15',
    text: 'text-emerald-400',      textActive: 'text-emerald-200',
    border: 'border-emerald-500/40',
  },
}

const COMPS: Record<TabKey, React.ComponentType> = {
  agenda:         AgendaAlocacao,
  abastecimentos: AbastecimentosOp,
  multas:         MultasPedagios,
  telemetria:     TelemetriaOp,
  indicadores:    Indicadores,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function OperacaoHub() {
  const [active, setActive] = useState<TabKey>('agenda')
  const { isDark } = useTheme()
  const Comp = COMPS[active] ?? AgendaAlocacao

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
