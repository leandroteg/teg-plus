import { useMemo, useState } from 'react'
import {
  Archive, ArrowDownUp, Landmark, TrendingDown, MapPin,
  Search, X, LayoutList, LayoutGrid, ArrowUp, ArrowDown, Plus,
} from 'lucide-react'
import PatrimonialLegacy from '../estoque/Patrimonial'
import { useImobilizados } from '../../hooks/usePatrimonial'
import { useBases } from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'

// ── Pipeline stages ──────────────────────────────────────────────────────────

type TabKey = 'aguardando' | 'patrimonio' | 'depreciado' | 'baixado'

interface TabDef {
  key: TabKey
  label: string
  icon: React.ElementType
  filter: (pct: number, status: string) => boolean
}

const TABS: TabDef[] = [
  { key: 'aguardando',  label: 'Aguardando Entrada', icon: ArrowDownUp,   filter: (_p, s) => s === 'pendente_registro' },
  { key: 'patrimonio',  label: 'Patrimonio',         icon: Landmark,      filter: (_p, s) => ['ativo', 'cedido', 'em_transferencia'].includes(s) },
  { key: 'depreciado',  label: 'Depreciado',         icon: TrendingDown,  filter: (p, s) => p >= 100 && s !== 'baixado' },
  { key: 'baixado',     label: 'Baixado',            icon: Archive,       filter: (_p, s) => s === 'baixado' },
]

type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; dot: string; badge: string; border: string }

const TAB_ACCENT: Record<TabKey, AccentSet> = {
  aguardando: { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  dot:'bg-violet-500',  badge:'bg-violet-200/80 text-violet-700',  border:'border-violet-200' },
  patrimonio: { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', dot:'bg-emerald-500', badge:'bg-emerald-200/80 text-emerald-700', border:'border-emerald-200' },
  depreciado: { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   dot:'bg-amber-500',   badge:'bg-amber-200/80 text-amber-700',   border:'border-amber-200' },
  baixado:    { bg:'bg-slate-50',   bgActive:'bg-slate-100',   text:'text-slate-500',   textActive:'text-slate-800',   dot:'bg-slate-400',   badge:'bg-slate-200/80 text-slate-600',   border:'border-slate-200' },
}

const TAB_ACCENT_DARK: Record<TabKey, AccentSet> = {
  aguardando: { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',  text:'text-violet-400',  textActive:'text-violet-200',  dot:'bg-violet-400',  badge:'bg-violet-500/15 text-violet-300',  border:'border-violet-500/20' },
  patrimonio: { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15', text:'text-emerald-400', textActive:'text-emerald-200', dot:'bg-emerald-400', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
  depreciado: { bg:'bg-amber-500/5',   bgActive:'bg-amber-500/15',   text:'text-amber-400',   textActive:'text-amber-200',   dot:'bg-amber-400',   badge:'bg-amber-500/15 text-amber-300',   border:'border-amber-500/20' },
  baixado:    { bg:'bg-white/[0.02]',  bgActive:'bg-white/[0.06]',   text:'text-slate-500',   textActive:'text-slate-200',   dot:'bg-slate-500',   badge:'bg-white/[0.06] text-slate-400',   border:'border-white/[0.08]' },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PatrimonioPage() {
  const { isDark } = useTheme()
  const isLight = !isDark
  const [tab, setTab] = useState<TabKey>('patrimonio')
  const [filtroBase, setFiltroBase] = useState('')
  const { data: bases = [] } = useBases()
  const { data: imobilizados = [] } = useImobilizados(
    filtroBase ? { base_id: filtroBase } : undefined
  )

  const counts = useMemo(() => {
    return Object.fromEntries(TABS.map(t => [
      t.key,
      imobilizados.filter(i => t.filter(i.percentual_depreciado ?? 0, i.status)).length,
    ])) as Record<TabKey, number>
  }, [imobilizados])

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <Landmark size={18} className="text-amber-500" /> Patrimonio
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Gestao completa dos imobilizados por etapa do ciclo de vida
          </p>
        </div>
        {/* Filtro por Base */}
        <div className="flex items-center gap-2">
          <MapPin size={13} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <select
            value={filtroBase}
            onChange={e => setFiltroBase(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
              isDark
                ? 'border-white/[0.08] bg-white/[0.03] text-slate-300'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            <option value="">Todas as Bases</option>
            {bases.filter(b => b.ativa).map(b => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pipeline tabs */}
      <div className={`flex gap-1 p-1 pb-2 rounded-t-2xl border-b overflow-x-auto hide-scrollbar ${
        isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
      }`}>
        {TABS.map(stage => {
          const count = counts[stage.key] ?? 0
          const isActive = tab === stage.key
          const Icon = stage.icon
          const a = isDark ? TAB_ACCENT_DARK[stage.key] : TAB_ACCENT[stage.key]
          return (
            <button key={stage.key} onClick={() => setTab(stage.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive
                  ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm`
                  : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              <Icon size={15} className="shrink-0" /> {stage.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${
                  isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content — delegates to legacy Patrimonial component */}
      <div className="min-h-[300px]">
        {tab === 'aguardando' && (
          <div className="p-4">
            <PatrimonialLegacy forcedStatusFiltro="pendente_registro" hideHeader />
          </div>
        )}
        {tab === 'patrimonio' && (
          <div className="p-4">
            <PatrimonialLegacy allowedStatuses={['ativo', 'cedido', 'em_transferencia']} hideHeader />
          </div>
        )}
        {tab === 'depreciado' && (
          <div className="p-4">
            <PatrimonialLegacy showDepreciadosOnly hideHeader />
          </div>
        )}
        {tab === 'baixado' && (
          <div className="p-4">
            <PatrimonialLegacy forcedStatusFiltro="baixado" hideHeader />
          </div>
        )}
      </div>
    </div>
  )
}
