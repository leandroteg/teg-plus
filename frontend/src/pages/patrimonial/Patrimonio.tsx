import { useMemo, useState } from 'react'
import { Archive, ArrowDownUp, Landmark, PackageCheck, TrendingDown, MapPin } from 'lucide-react'
import PatrimonialLegacy from '../estoque/Patrimonial'
import { useImobilizados } from '../../hooks/usePatrimonial'
import { useBases } from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'

const TABS = [
  { key: 'aguardando', label: 'Aguardando Entrada', icon: ArrowDownUp, accent: { active: 'bg-violet-50 text-violet-800 border-violet-500', idle: 'text-violet-600 hover:bg-violet-50', badge: 'bg-violet-100 text-violet-700', darkActive: 'bg-violet-500/10 text-violet-300 border-violet-400/40', darkIdle: 'text-violet-300 hover:bg-white/[0.03]', darkBadge: 'bg-violet-500/15 text-violet-200' }, filter: (pct: number, status: string) => status === 'pendente_registro' },
  { key: 'patrimonio', label: 'Patrim\u00f4nio', icon: Landmark, accent: { active: 'bg-emerald-50 text-emerald-800 border-emerald-500', idle: 'text-emerald-600 hover:bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', darkActive: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/40', darkIdle: 'text-emerald-300 hover:bg-white/[0.03]', darkBadge: 'bg-emerald-500/15 text-emerald-200' }, filter: (_pct: number, status: string) => ['ativo', 'cedido', 'em_transferencia'].includes(status) },
  { key: 'depreciado', label: 'Depreciado', icon: TrendingDown, accent: { active: 'bg-amber-50 text-amber-800 border-amber-500', idle: 'text-amber-600 hover:bg-amber-50', badge: 'bg-amber-100 text-amber-700', darkActive: 'bg-amber-500/10 text-amber-300 border-amber-400/40', darkIdle: 'text-amber-300 hover:bg-white/[0.03]', darkBadge: 'bg-amber-500/15 text-amber-200' }, filter: (pct: number, status: string) => pct >= 100 && status !== 'baixado' },
  { key: 'baixado', label: 'Baixado', icon: Archive, accent: { active: 'bg-slate-100 text-slate-800 border-slate-400', idle: 'text-slate-600 hover:bg-slate-50', badge: 'bg-slate-200 text-slate-600', darkActive: 'bg-slate-500/10 text-slate-200 border-slate-400/40', darkIdle: 'text-slate-300 hover:bg-white/[0.03]', darkBadge: 'bg-slate-500/15 text-slate-200' }, filter: (_pct: number, status: string) => status === 'baixado' },
]

export default function PatrimonioPage() {
  const { isLightSidebar: isLight } = useTheme()
  const [tab, setTab] = useState(TABS[1].key)
  const [filtroBase, setFiltroBase] = useState('')
  const { data: bases = [] } = useBases()
  const { data: imobilizados = [] } = useImobilizados(
    filtroBase ? { base_id: filtroBase } : undefined
  )

  const counts = useMemo(() => {
    return Object.fromEntries(TABS.map(t => [
      t.key,
      imobilizados.filter(i => t.filter(i.percentual_depreciado ?? 0, i.status)).length,
    ]))
  }, [imobilizados])

  return (
    <div className="space-y-4">
      <div>
        <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{'Patrim\u00f4nio'}</h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{'Gest\u00e3o completa dos imobilizados por etapa do ciclo de vida'}</p>
      </div>

      {/* Filtro por Base */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <MapPin size={13} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <select
            value={filtroBase}
            onChange={e => setFiltroBase(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
              isLight
                ? 'border-slate-200 bg-white text-slate-600'
                : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
            }`}
          >
            <option value="">Todas as Bases</option>
            {bases.map(b => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={`overflow-x-auto hide-scrollbar rounded-2xl border p-1 ${
        isLight ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.02]'
      }`}>
        <div className="flex min-w-max items-stretch gap-1">
        {TABS.map(item => {
          const active = item.key === tab
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex min-h-[52px] items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition-all border shrink-0 ${
                active
                  ? `${isLight ? item.accent.active : item.accent.darkActive} shadow-sm`
                  : `${isLight ? item.accent.idle : item.accent.darkIdle} border-transparent`
              }`}
            >
              <Icon size={13} className="shrink-0" />
              {item.label}
              <span className={`rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-[10px] font-bold ${
                active
                  ? isLight ? item.accent.badge : item.accent.darkBadge
                  : isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/[0.06] text-slate-500'
              }`}>
                {counts[item.key] ?? 0}
              </span>
            </button>
          )
        })}
        </div>
      </div>

      {tab === 'aguardando' && (
        <PatrimonialLegacy forcedStatusFiltro="pendente_registro" hideHeader />
      )}
      {tab === 'patrimonio' && (
        <PatrimonialLegacy allowedStatuses={['ativo', 'cedido', 'em_transferencia']} hideHeader />
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
