import {
  LayoutDashboard, Rocket, Compass, Zap, BarChart3, CheckCircle2,
  ChevronDown, Building2,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import ModuleLayout from './ModuleLayout'
import { EGPContractProvider, useEGPContract } from '../contexts/EGPContractContext'
import { useTheme } from '../contexts/ThemeContext'

const NAV = [
  { to: '/egp',              icon: LayoutDashboard, label: 'Painel',        end: true },
  { to: '/egp/iniciacao',    icon: Rocket,          label: 'Iniciação' },
  { to: '/egp/planejamento', icon: Compass,         label: 'Planejamento' },
  { to: '/egp/execucao',     icon: Zap,             label: 'Execução' },
  { to: '/egp/controle',     icon: BarChart3,       label: 'Controle' },
  { to: '/egp/encerramento', icon: CheckCircle2,    label: 'Encerramento' },
]

function ContractSelector() {
  const { isDark } = useTheme()
  const { portfolio, portfolios, setPortfolioId } = useEGPContract()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const active = portfolios.filter(p => !['cancelada', 'obra_concluida'].includes(p.status))

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${
          isDark
            ? 'bg-slate-800/60 border-slate-700 text-white hover:border-blue-500/50'
            : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400 shadow-sm'
        }`}
      >
        <Building2 size={14} className="text-blue-500 shrink-0" />
        <span className="truncate max-w-[200px]">
          {portfolio?.nome_obra || 'Selecionar contrato'}
        </span>
        {portfolio?.numero_osc && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            {portfolio.numero_osc}
          </span>
        )}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
      </button>

      {open && active.length > 0 && (
        <div className={`absolute top-full left-0 mt-1 w-80 max-h-72 overflow-y-auto rounded-xl border shadow-xl z-50 ${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}>
          {active.map(p => (
            <button
              key={p.id}
              onClick={() => { setPortfolioId(p.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                p.id === portfolio?.id
                  ? isDark ? 'bg-blue-500/10' : 'bg-blue-50'
                  : isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                  {p.nome_obra}
                </p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {p.numero_osc}
                </p>
              </div>
              {p.id === portfolio?.id && (
                <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EGPLayout() {
  return (
    <EGPContractProvider>
      <ModuleLayout
        moduleKey="egp"
        moduleName="EGP"
        moduleEmoji="📊"
        accent="blue"
        nav={NAV}
        moduleSubtitle="Escritório de Gestão de Projetos"
        bottomNavMaxItems={6}
        headerExtra={<ContractSelector />}
      />
    </EGPContractProvider>
  )
}
