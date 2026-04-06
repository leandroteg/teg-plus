import { useState } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import Ativos from './Ativos'
import Faturas from './Faturas'
import ManutencoesServicos from './ManutencoesServicos'
import AditivosRenovacoes from './AditivosRenovacoes'
import Acordos from './Acordos'

const TABS = [
  { key: 'ativos',    label: 'Ativos' },
  { key: 'faturas',   label: 'Faturas' },
  { key: 'servicos',  label: 'Manutenções e Serviços' },
  { key: 'aditivos',  label: 'Aditivos & Renovações' },
  { key: 'acordos',   label: 'Acordos' },
] as const

type Tab = typeof TABS[number]['key']

export default function Gestao() {
  const { isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('ativos')

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className={`flex items-center gap-1 px-4 pt-4 pb-0 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-all border-b-2 -mb-px ${
              tab === t.key
                ? isDark
                  ? 'border-indigo-400 text-indigo-300'
                  : 'border-indigo-600 text-indigo-700'
                : isDark
                  ? 'border-transparent text-slate-400 hover:text-slate-200'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === 'ativos'   && <Ativos />}
        {tab === 'faturas'  && <Faturas />}
        {tab === 'servicos' && <ManutencoesServicos />}
        {tab === 'aditivos' && <AditivosRenovacoes />}
        {tab === 'acordos'  && <Acordos />}
      </div>
    </div>
  )
}
