import { useState } from 'react'
import { CalendarDays, Fuel, AlertCircle, Radio, BarChart3 } from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import AgendaAlocacao from './AgendaAlocacao'
import AbastecimentosOp from './AbastecimentosOp'
import MultasPedagios from './MultasPedagios'
import TelemetriaOp from './TelemetriaOp'
import Indicadores from './Indicadores'

// ── Tab Config ────────────────────────────────────────────────────────────────
type TabKey = 'agenda' | 'abastecimentos' | 'multas' | 'telemetria' | 'indicadores'

const TABS: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: 'agenda',          label: 'Agenda',            icon: CalendarDays },
  { key: 'abastecimentos',  label: 'Abastecimentos',    icon: Fuel },
  { key: 'multas',          label: 'Multas & Pedágios', icon: AlertCircle },
  { key: 'telemetria',      label: 'Telemetria',        icon: Radio },
  { key: 'indicadores',     label: 'Indicadores',       icon: BarChart3 },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function OperacaoHub() {
  const { isLightSidebar: isLight } = useTheme()
  const [active, setActive] = useState<TabKey>('agenda')

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className={`flex gap-1 px-4 pt-4 pb-0 border-b overflow-x-auto ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-white/[0.06]'
      }`}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = active === key
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-xl border-b-2 transition-all ${
                isActive
                  ? isLight
                    ? 'border-b-rose-500 text-rose-700 bg-rose-50'
                    : 'border-b-rose-400 text-rose-300 bg-rose-500/10'
                  : isLight
                    ? 'border-b-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    : 'border-b-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {active === 'agenda'         && <AgendaAlocacao />}
        {active === 'abastecimentos' && <AbastecimentosOp />}
        {active === 'multas'         && <MultasPedagios />}
        {active === 'telemetria'     && <TelemetriaOp />}
        {active === 'indicadores'    && <Indicadores />}
      </div>
    </div>
  )
}
