import { useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { Building2, Receipt, Wrench, FileSignature, Handshake } from 'lucide-react'
import Ativos from './Ativos'
import Faturas from './Faturas'
import ManutencoesServicos from './ManutencoesServicos'
import AditivosRenovacoes from './AditivosRenovacoes'
import Acordos from './Acordos'

const TABS = [
  { key: 'ativos',   label: 'Ativos',                  icon: Building2,      bg: 'bg-indigo-50',  text: 'text-indigo-700',  ring: 'ring-indigo-500' },
  { key: 'faturas',  label: 'Faturas',                  icon: Receipt,        bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-500' },
  { key: 'servicos', label: 'Manutenções e Serviços',   icon: Wrench,         bg: 'bg-amber-50',   text: 'text-amber-700',  ring: 'ring-amber-500' },
  { key: 'aditivos', label: 'Aditivos & Renovações',    icon: FileSignature,  bg: 'bg-violet-50',  text: 'text-violet-700', ring: 'ring-violet-500' },
  { key: 'acordos',  label: 'Acordos',                  icon: Handshake,      bg: 'bg-cyan-50',    text: 'text-cyan-700',   ring: 'ring-cyan-500' },
] as const

type Tab = typeof TABS[number]['key']

export default function Gestao() {
  const { isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('ativos')

  return (
    <div className="flex flex-col h-full">
      {/* Tabs — pills arredondadas (padrão GestaoContratos) */}
      <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar px-4 pt-4 pb-2">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs whitespace-nowrap transition-all shrink-0 ${
                active
                  ? isDark
                    ? `bg-white/[0.08] text-white font-bold shadow-sm ring-1 ring-white/[0.15]`
                    : `${t.bg} ${t.text} font-bold shadow-sm ring-1 ${t.ring}`
                  : isDark
                    ? 'bg-white/[0.03] text-slate-400 font-medium hover:bg-white/[0.06]'
                    : 'bg-slate-50 text-slate-500 font-medium hover:bg-slate-100'
              }`}
            >
              <Icon size={13} className="shrink-0" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'ativos'   && <Ativos />}
        {tab === 'faturas'  && <Faturas />}
        {tab === 'servicos' && <ManutencoesServicos />}
        {tab === 'aditivos' && <AditivosRenovacoes />}
        {tab === 'acordos'  && <Acordos />}
      </div>
    </div>
  )
}
