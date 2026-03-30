import { useState, useMemo } from 'react'
import {
  Search, Plus, Car, Cog, Gauge, Timer,
  FileText, ShieldAlert, Wrench, ClipboardList, MapPin, Warehouse,
  LayoutGrid, LayoutList,
} from 'lucide-react'
import { useTheme } from '../../../contexts/ThemeContext'
import { useVeiculos, useOrdensServico } from '../../../hooks/useFrotas'
import type { FroVeiculo } from '../../../types/frotas'

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

function diasAte(dateStr?: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

function docAlertColor(dias: number | null, isLight: boolean): string {
  if (dias === null) return ''
  if (dias <= 0)  return isLight ? 'text-red-600'    : 'text-red-400'
  if (dias <= 15) return isLight ? 'text-orange-600' : 'text-orange-400'
  if (dias <= 30) return isLight ? 'text-amber-600'  : 'text-amber-400'
  return ''
}

function preventivaColor(
  kmProx?: number, kmAtual?: number, dataProx?: string, isLight = false
): 'green' | 'yellow' | 'red' {
  // por data
  if (dataProx) {
    const d = diasAte(dataProx)
    if (d !== null) {
      if (d <= 0)  return 'red'
      if (d <= 30) return 'yellow'
    }
  }
  // por km
  if (kmProx !== undefined && kmAtual !== undefined) {
    const diff = kmProx - kmAtual
    if (diff <= 0)    return 'red'
    if (diff <= 2000) return 'yellow'
  }
  return 'green'
}

const PREV_STYLES: Record<'green' | 'yellow' | 'red', { light: string; dark: string }> = {
  green:  { light: 'bg-emerald-50 text-emerald-700 border-emerald-200', dark: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  yellow: { light: 'bg-amber-50 text-amber-700 border-amber-200',       dark: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  red:    { light: 'bg-red-50 text-red-700 border-red-200',             dark: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

// ── OSBadge ───────────────────────────────────────────────────────────────────

interface OSBadgeProps { count: number; isLight: boolean }

function OSBadge({ count, isLight }: OSBadgeProps) {
  if (count === 0) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
      isLight ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/10 text-red-400 border-red-500/20'
    }`}>
      <Wrench size={9} />
      {count} OS aberta{count > 1 ? 's' : ''}
    </span>
  )
}

// ── PropBadge ─────────────────────────────────────────────────────────────────

const PROP_MAP = {
  propria: { label: 'Próprio', light: 'bg-emerald-50 text-emerald-700',  dark: 'bg-emerald-500/10 text-emerald-400' },
  locada:  { label: 'Locado',  light: 'bg-amber-50 text-amber-700',      dark: 'bg-amber-500/10 text-amber-400'    },
  cedida:  { label: 'Cedido',  light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/10 text-slate-400'    },
}

// ── VeiculoCard ───────────────────────────────────────────────────────────────

interface VeiculoCardProps {
  v: FroVeiculo
  osCount: number
  isLight: boolean
  onAlocar: (id: string) => void
  onOS: (id: string) => void
  onChecklist: (id: string) => void
}

function VeiculoCard({ v, osCount, isLight, onAlocar, onOS, onChecklist }: VeiculoCardProps) {
  const isMaquina = v.tipo_ativo === 'maquina'
  const prop = PROP_MAP[v.propriedade]
  const prevColor = preventivaColor(v.km_proxima_preventiva, v.hodometro_atual, v.data_proxima_preventiva, isLight)
  const prevStyle = PREV_STYLES[prevColor]

  const diasCrlv   = diasAte(v.vencimento_crlv)
  const diasSeguro = diasAte(v.vencimento_seguro)
  const crlvColor   = docAlertColor(diasCrlv, isLight)
  const seguroColor = docAlertColor(diasSeguro, isLight)

  const identificador = isMaquina && v.numero_serie ? v.numero_serie : v.placa

  return (
    <div className={`rounded-2xl border shadow-sm transition-all hover:shadow-md ${
      isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon box */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isMaquina
              ? (isLight ? 'bg-violet-50' : 'bg-violet-500/10')
              : (isLight ? 'bg-sky-50'    : 'bg-sky-500/10')
          }`}>
            {isMaquina
              ? <Cog  size={16} className={isLight ? 'text-violet-600' : 'text-violet-400'} />
              : <Car  size={16} className={isLight ? 'text-sky-600'    : 'text-sky-400'} />
            }
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title + OSBadge */}
            <div className="flex items-start justify-between gap-1 mb-0.5">
              <p className={`text-sm font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {identificador}
              </p>
              {osCount > 0 && <OSBadge count={osCount} isLight={isLight} />}
            </div>

            {/* Subtitle */}
            <p className="text-[11px] text-slate-500 truncate">
              {v.marca} {v.modelo}{v.ano_mod ? ` · ${v.ano_mod}` : ''}
            </p>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {/* Propriedade */}
              <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? prop.light : prop.dark}`}>
                {prop.label}
              </span>

              {/* Preventiva */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${isLight ? prevStyle.light : prevStyle.dark}`}>
                <Wrench size={9} />
                {isMaquina && v.km_proxima_preventiva
                  ? `Prev. ${fmtNum(v.km_proxima_preventiva)} h`
                  : v.km_proxima_preventiva
                  ? `Prev. ${fmtNum(v.km_proxima_preventiva)} km`
                  : v.data_proxima_preventiva
                  ? `Prev. ${new Date(v.data_proxima_preventiva).toLocaleDateString('pt-BR')}`
                  : 'Preventiva OK'}
              </span>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-400">
              {/* KM / Hs */}
              {isMaquina ? (
                v.horimetro_atual !== undefined && (
                  <span className="flex items-center gap-1">
                    <Timer size={10} /> {fmtNum(v.horimetro_atual)} h
                  </span>
                )
              ) : (
                <span className="flex items-center gap-1">
                  <Gauge size={10} /> {fmtNum(v.hodometro_atual)} km
                </span>
              )}

              {/* CRLV alert */}
              {crlvColor && (
                <span className={`flex items-center gap-1 font-semibold ${crlvColor}`}>
                  <FileText size={9} />
                  CRLV {diasCrlv !== null && diasCrlv <= 0 ? 'vencido' : `${diasCrlv}d`}
                </span>
              )}

              {/* Seguro alert */}
              {seguroColor && (
                <span className={`flex items-center gap-1 font-semibold ${seguroColor}`}>
                  <FileText size={9} />
                  Seguro {diasSeguro !== null && diasSeguro <= 0 ? 'vencido' : `${diasSeguro}d`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions footer */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={() => onAlocar(v.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all ${
            isLight
              ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/[0.18]'
          }`}
        >
          <MapPin size={11} /> Alocar
        </button>
        <button
          onClick={() => onOS(v.id)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all ${
            isLight
              ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              : 'bg-white/[0.04] border-white/[0.06] text-slate-300 hover:bg-white/[0.08]'
          }`}
        >
          <Wrench size={11} /> OS
        </button>
        <button
          onClick={() => onChecklist(v.id)}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all ${
            isLight
              ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              : 'bg-white/[0.04] border-white/[0.06] text-slate-300 hover:bg-white/[0.08]'
          }`}
        >
          <ClipboardList size={11} />
        </button>
      </div>
    </div>
  )
}

// ── VeiculoRow (table row) ────────────────────────────────────────────────────

interface VeiculoRowProps {
  v: FroVeiculo
  osCount: number
  isLight: boolean
  idx: number
  onAlocar: (id: string) => void
  onOS: (id: string) => void
  onChecklist: (id: string) => void
}

function VeiculoRow({ v, osCount, isLight, idx, onAlocar, onOS, onChecklist }: VeiculoRowProps) {
  const isMaquina = v.tipo_ativo === 'maquina'
  const prop = PROP_MAP[v.propriedade]
  const prevColor = preventivaColor(v.km_proxima_preventiva, v.hodometro_atual, v.data_proxima_preventiva, isLight)
  const prevStyle = PREV_STYLES[prevColor]
  const diasCrlv   = diasAte(v.vencimento_crlv)
  const diasSeguro = diasAte(v.vencimento_seguro)
  const crlvColor   = docAlertColor(diasCrlv, isLight)
  const seguroColor = docAlertColor(diasSeguro, isLight)
  const identificador = isMaquina && v.numero_serie ? v.numero_serie : v.placa

  const trCls = `border-t transition-colors ${
    isLight
      ? `border-slate-100 hover:bg-rose-50/30 ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`
      : `border-white/[0.04] hover:bg-white/[0.02] ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`
  }`

  return (
    <tr className={trCls}>
      {/* Ativo */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            isMaquina
              ? (isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/10 text-violet-400')
              : (isLight ? 'bg-sky-50 text-sky-600'       : 'bg-sky-500/10 text-sky-400')
          }`}>
            {isMaquina ? <Cog size={13} /> : <Car size={13} />}
          </div>
          <div>
            <p className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {identificador}
            </p>
            <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              {isMaquina ? 'Máquina' : 'Veículo'}
            </p>
          </div>
        </div>
      </td>

      {/* Marca/Modelo */}
      <td className="px-4 py-3">
        <p className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
          {v.marca} {v.modelo}
        </p>
        {v.ano_mod && (
          <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{v.ano_mod}</p>
        )}
      </td>

      {/* Propriedade */}
      <td className="px-4 py-3">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? prop.light : prop.dark}`}>
          {prop.label}
        </span>
      </td>

      {/* KM / Hs */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          {isMaquina
            ? <><Timer size={11} /> {v.horimetro_atual !== undefined ? fmtNum(v.horimetro_atual) + ' h' : '—'}</>
            : <><Gauge size={11} /> {fmtNum(v.hodometro_atual)} km</>
          }
        </span>
      </td>

      {/* Próxima Preventiva */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${isLight ? prevStyle.light : prevStyle.dark}`}>
          <Wrench size={9} />
          {isMaquina && v.km_proxima_preventiva
            ? `${fmtNum(v.km_proxima_preventiva)} h`
            : v.km_proxima_preventiva
            ? `${fmtNum(v.km_proxima_preventiva)} km`
            : v.data_proxima_preventiva
            ? new Date(v.data_proxima_preventiva).toLocaleDateString('pt-BR')
            : 'OK'}
        </span>
      </td>

      {/* Documentos */}
      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          {crlvColor ? (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${crlvColor}`}>
              <FileText size={9} />
              CRLV {diasCrlv !== null && diasCrlv <= 0 ? 'VENCIDO' : `${diasCrlv}d`}
            </span>
          ) : null}
          {seguroColor ? (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${seguroColor}`}>
              <ShieldAlert size={9} />
              Seguro {diasSeguro !== null && diasSeguro <= 0 ? 'VENCIDO' : `${diasSeguro}d`}
            </span>
          ) : null}
          {!crlvColor && !seguroColor && (
            <span className={`text-[10px] ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>OK</span>
          )}
        </div>
      </td>

      {/* OS */}
      <td className="px-4 py-3">
        <OSBadge count={osCount} isLight={isLight} />
        {osCount === 0 && <span className={`text-[10px] ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>—</span>}
      </td>

      {/* Ações */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onAlocar(v.id)}
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${
              isLight
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30'
                : 'bg-rose-500/90 text-white hover:bg-rose-500'
            }`}
          >
            <MapPin size={10} /> Alocar
          </button>
          <button
            onClick={() => onOS(v.id)}
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
              isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Wrench size={10} /> OS
          </button>
          <button
            onClick={() => onChecklist(v.id)}
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
              isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ClipboardList size={10} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Patio ─────────────────────────────────────────────────────────────────────

export default function Patio() {
  const { isLightSidebar: isLight } = useTheme()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  const { data: veiculos = [], isLoading } = useVeiculos({ status: 'disponivel' })
  const { data: ordens  = [] } = useOrdensServico({
    status: ['pendente', 'aberta', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'em_execucao'],
  })

  // map veiculo_id → OS count
  const osCountMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const os of ordens) {
      m[os.veiculo_id] = (m[os.veiculo_id] ?? 0) + 1
    }
    return m
  }, [ordens])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return veiculos
    return veiculos.filter(v =>
      v.placa.toLowerCase().includes(q) ||
      v.marca.toLowerCase().includes(q) ||
      v.modelo.toLowerCase().includes(q) ||
      (v.numero_serie ?? '').toLowerCase().includes(q)
    )
  }, [veiculos, search])

  // stub handlers — real modals would live in a parent layer
  const handleAlocar    = (_id: string) => { /* TODO: abrir modal alocação */ }
  const handleOS        = (_id: string) => { /* TODO: abrir modal OS */ }
  const handleChecklist = (_id: string) => { /* TODO: abrir modal checklist */ }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Warehouse size={18} className="text-rose-500" />
            Pátio
            <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'
            }`}>
              {veiculos.length} disponíve{veiculos.length === 1 ? 'l' : 'is'}
            </span>
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Ativos prontos para uso, sem alocação ativa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar placa, modelo..."
              className={`pl-8 pr-3 py-2 rounded-xl border text-xs w-52 transition-all focus:outline-none focus:ring-2 ${
                isLight
                  ? 'bg-white border-slate-200 focus:ring-rose-500/20 focus:border-rose-400'
                  : 'bg-slate-800/60 border-slate-700 text-white focus:ring-rose-500/20 focus:border-rose-500'
              }`}
            />
          </div>

          {/* View toggle */}
          <div className={`flex items-center rounded-xl border overflow-hidden ${
            isLight ? 'border-slate-200 bg-slate-50' : 'border-white/[0.06] bg-slate-800/40'
          }`}>
            <button
              onClick={() => setViewMode('table')}
              title="Visualização em tabela"
              className={`flex items-center justify-center w-8 h-8 transition-colors ${
                viewMode === 'table'
                  ? (isLight ? 'bg-white text-slate-800 shadow-sm' : 'bg-slate-700 text-white')
                  : (isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300')
              }`}
            >
              <LayoutList size={14} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              title="Visualização em cards"
              className={`flex items-center justify-center w-8 h-8 transition-colors ${
                viewMode === 'cards'
                  ? (isLight ? 'bg-white text-slate-800 shadow-sm' : 'bg-slate-700 text-white')
                  : (isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300')
              }`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>

          <button className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-all ${
            isLight
              ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30'
              : 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/20'
          }`}>
            <Plus size={13} /> Novo Ativo
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-16 rounded-2xl border ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/30 border-white/[0.06]'
        }`}>
          <Warehouse size={36} className={`mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
          <p className={`font-semibold text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            {search ? 'Nenhum ativo encontrado' : 'Pátio vazio'}
          </p>
          <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {search
              ? `Sem resultados para "${search}"`
              : 'Todos os ativos estão alocados ou em manutenção'}
          </p>
        </div>
      )}

      {/* Cards view */}
      {!isLoading && filtered.length > 0 && viewMode === 'cards' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(v => (
            <VeiculoCard
              key={v.id}
              v={v}
              osCount={osCountMap[v.id] ?? 0}
              isLight={isLight}
              onAlocar={handleAlocar}
              onOS={handleOS}
              onChecklist={handleChecklist}
            />
          ))}
        </div>
      )}

      {/* Table view */}
      {!isLoading && filtered.length > 0 && viewMode === 'table' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-800/40 border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isLight ? 'bg-slate-50 border-b border-slate-100' : 'bg-slate-800/60 border-b border-white/[0.04]'}>
                <tr>
                  {(['Ativo', 'Marca / Modelo', 'Propriedade', 'KM / Hs', 'Próx. Preventiva', 'Documentos', 'OS', ''] as const).map(h => (
                    <th key={h} className={`text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    } ${h === '' ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((v, idx) => (
                  <VeiculoRow
                    key={v.id}
                    v={v}
                    osCount={osCountMap[v.id] ?? 0}
                    isLight={isLight}
                    idx={idx}
                    onAlocar={handleAlocar}
                    onOS={handleOS}
                    onChecklist={handleChecklist}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
