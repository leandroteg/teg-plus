import { useMemo, useState } from 'react'
import PatrimonialLegacy from '../estoque/Patrimonial'
import { useImobilizados } from '../../hooks/usePatrimonial'
import { useTheme } from '../../contexts/ThemeContext'

const TABS = [
  { key: 'aguardando', label: 'Aguardando Entrada', filter: (pct: number, status: string) => status === 'pendente_registro' },
  { key: 'patrimonio', label: 'Patrimonio', filter: (_pct: number, status: string) => ['ativo', 'cedido', 'em_transferencia', 'em_manutencao'].includes(status) },
  { key: 'depreciado', label: 'Depreciado', filter: (pct: number, status: string) => pct >= 100 && status !== 'baixado' },
  { key: 'baixado', label: 'Baixado', filter: (_pct: number, status: string) => status === 'baixado' },
]

export default function PatrimonioPage() {
  const { isLightSidebar: isLight } = useTheme()
  const [tab, setTab] = useState(TABS[1].key)
  const { data: imobilizados = [] } = useImobilizados()

  const counts = useMemo(() => {
    return Object.fromEntries(TABS.map(t => [
      t.key,
      imobilizados.filter(i => t.filter(i.percentual_depreciado ?? 0, i.status)).length,
    ]))
  }, [imobilizados])

  return (
    <div className="space-y-4">
      <div>
        <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Patrimonio</h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Gestao completa dos imobilizados por etapa do ciclo de vida</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(item => {
          const active = item.key === tab
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition-all ${
                active
                  ? 'bg-amber-500 text-white shadow-sm'
                  : isLight
                    ? 'bg-white text-slate-500 border border-slate-200'
                    : 'bg-white/[0.03] text-slate-400 border border-white/[0.08]'
              }`}
            >
              {item.label} <span className={active ? 'text-white/80' : ''}>({counts[item.key] ?? 0})</span>
            </button>
          )
        })}
      </div>

      {tab === 'aguardando' && (
        <PatrimonialLegacy forcedStatusFiltro="pendente_registro" hideHeader />
      )}
      {tab === 'patrimonio' && (
        <PatrimonialLegacy allowedStatuses={['ativo', 'cedido', 'em_transferencia', 'em_manutencao']} hideHeader />
      )}
      {tab === 'depreciado' && (
        <PatrimonialLegacy showDepreciadosOnly hideHeader />
      )}
      {tab === 'baixado' && (
        <PatrimonialLegacy forcedStatusFiltro="baixado" hideHeader />
      )}
    </div>
  )
}
