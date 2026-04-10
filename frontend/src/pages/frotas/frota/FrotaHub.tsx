import { useState } from 'react'
import { LogIn, Warehouse, ClipboardCheck, MapPin } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useVeiculos } from '../../../hooks/useFrotas'
import EmEntrada      from './EmEntrada'
import Patio          from './Patio'
import ChecklistSaida from './ChecklistSaida'
import Alocados       from './Alocados'

// ── Tab Config ───────────────────────────────────────────────────────────────

type TabKey = 'em_entrada' | 'patio' | 'checklist_saida' | 'alocados'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'em_entrada',      label: 'Em Entrada'      },
  { key: 'patio',           label: 'Pátio'            },
  { key: 'checklist_saida', label: 'Checklist Saída'  },
  { key: 'alocados',        label: 'Alocados'         },
]

const TAB_ICONS: Record<TabKey, React.ElementType> = {
  em_entrada:      LogIn,
  patio:           Warehouse,
  checklist_saida: ClipboardCheck,
  alocados:        MapPin,
}

const TAB_ACCENT: Record<TabKey, {
  bg: string; bgActive: string; text: string; textActive: string; border: string
}> = {
  em_entrada: {
    bg: 'hover:bg-amber-50',    bgActive: 'bg-amber-50',
    text: 'text-amber-600',     textActive: 'text-amber-800',
    border: 'border-amber-500',
  },
  patio: {
    bg: 'hover:bg-sky-50',      bgActive: 'bg-sky-50',
    text: 'text-sky-600',       textActive: 'text-sky-800',
    border: 'border-sky-500',
  },
  checklist_saida: {
    bg: 'hover:bg-rose-50',     bgActive: 'bg-rose-50',
    text: 'text-rose-600',      textActive: 'text-rose-800',
    border: 'border-rose-500',
  },
  alocados: {
    bg: 'hover:bg-emerald-50',  bgActive: 'bg-emerald-50',
    text: 'text-emerald-600',   textActive: 'text-emerald-800',
    border: 'border-emerald-500',
  },
}

const TAB_ACCENT_DARK: Record<TabKey, {
  bg: string; bgActive: string; text: string; textActive: string; border: string
}> = {
  em_entrada: {
    bg: 'hover:bg-amber-500/10',   bgActive: 'bg-amber-500/15',
    text: 'text-amber-400',        textActive: 'text-amber-200',
    border: 'border-amber-500/40',
  },
  patio: {
    bg: 'hover:bg-sky-500/10',     bgActive: 'bg-sky-500/15',
    text: 'text-sky-400',          textActive: 'text-sky-200',
    border: 'border-sky-500/40',
  },
  checklist_saida: {
    bg: 'hover:bg-rose-500/10',    bgActive: 'bg-rose-500/15',
    text: 'text-rose-400',         textActive: 'text-rose-200',
    border: 'border-rose-500/40',
  },
  alocados: {
    bg: 'hover:bg-emerald-500/10', bgActive: 'bg-emerald-500/15',
    text: 'text-emerald-400',      textActive: 'text-emerald-200',
    border: 'border-emerald-500/40',
  },
}

const COMPS: Record<TabKey, React.ComponentType> = {
  em_entrada: EmEntrada,
  patio: Patio,
  checklist_saida: ChecklistSaida,
  alocados: Alocados,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FrotaHub() {
  const [active, setActive] = useState<TabKey>('patio')
  const { isDark } = useTheme()
  const { data: veiculos = [] } = useVeiculos()
  const counts: Record<TabKey, number> = {
    em_entrada: veiculos.filter(v => v.status === 'em_entrada').length,
    patio: veiculos.filter(v => v.status === 'disponivel').length,
    checklist_saida: veiculos.filter(v => v.status === 'aguardando_saida').length,
    alocados: veiculos.filter(v => v.status === 'em_uso').length,
  }
  const Comp = COMPS[active] ?? Patio

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
