import { useState, useMemo } from 'react'
import {
  Search, Plus, Car, Cog, Gauge, Timer, AlertTriangle,
  FileText, ShieldAlert, Wrench, ClipboardList, MapPin, Warehouse,
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
  const hasDocAlert = crlvColor !== '' || seguroColor !== ''

  const identificador = isMaquina && v.numero_serie ? v.numero_serie : v.placa

  return (
    <div className={`rounded-2xl border transition-all duration-200 hover:shadow-lg group ${
      isLight
        ? 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-rose-500/10'
        : 'bg-slate-800/50 border-white/[0.06] hover:border-rose-500/40 hover:shadow-rose-500/5'
    }`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-base font-extrabold tracking-wide ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {identificador}
              </span>
              {osCount > 0 && <OSBadge count={osCount} isLight={isLight} />}
            </div>
            <p className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {v.marca} {v.modelo} {v.ano_mod ? `· ${v.ano_mod}` : ''}
            </p>
          </div>
          {/* Tipo badge */}
          <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            isMaquina
              ? (isLight ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-violet-500/10 text-violet-400 border-violet-500/20')
              : (isLight ? 'bg-sky-50 text-sky-700 border-sky-200'           : 'bg-sky-500/10 text-sky-400 border-sky-500/20')
          }`}>
            {isMaquina ? <Cog size={9} /> : <Car size={9} />}
            {isMaquina ? 'Máquina' : 'Veículo'}
          </span>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLight ? prop.light : prop.dark}`}>
            {prop.label}
          </span>

          {/* Odômetro / Horímetro */}
          {isMaquina ? (
            v.horimetro_atual !== undefined && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-700/60 text-slate-300'
              }`}>
                <Timer size={9} />
                {fmtNum(v.horimetro_atual)} h
              </span>
            )
          ) : (
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
              isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-700/60 text-slate-300'
            }`}>
              <Gauge size={9} />
              {fmtNum(v.hodometro_atual)} km
            </span>
          )}

          {/* Próxima preventiva */}
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${isLight ? prevStyle.light : prevStyle.dark}`}>
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

        {/* Document alerts */}
        {hasDocAlert && (
          <div className={`flex flex-wrap gap-1.5 mb-3 p-2 rounded-xl ${
            isLight ? 'bg-red-50 border border-red-100' : 'bg-red-500/5 border border-red-500/10'
          }`}>
            <AlertTriangle size={11} className={isLight ? 'text-red-500 mt-px' : 'text-red-400 mt-px'} />
            {crlvColor && (
              <span className={`text-[10px] font-semibold ${crlvColor}`}>
                <FileText size={9} className="inline mr-0.5" />
                CRLV {diasCrlv !== null && diasCrlv <= 0 ? 'VENCIDO' : `vence em ${diasCrlv}d`}
              </span>
            )}
            {seguroColor && (
              <span className={`text-[10px] font-semibold ${seguroColor}`}>
                <ShieldAlert size={9} className="inline mr-0.5" />
                Seguro {diasSeguro !== null && diasSeguro <= 0 ? 'VENCIDO' : `vence em ${diasSeguro}d`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-1 px-4 pb-4`}>
        <button
          onClick={() => onAlocar(v.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-xl transition-all ${
            isLight
              ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30'
              : 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/20'
          }`}
        >
          <MapPin size={11} /> Alocar
        </button>
        <button
          onClick={() => onOS(v.id)}
          className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
            isLight
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Wrench size={11} /> OS
        </button>
        <button
          onClick={() => onChecklist(v.id)}
          className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
            isLight
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <ClipboardList size={11} /> Checklist
        </button>
      </div>
    </div>
  )
}

// ── Patio ─────────────────────────────────────────────────────────────────────

export default function Patio() {
  const { isLightSidebar: isLight } = useTheme()
  const [search, setSearch] = useState('')

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

      {/* Grid */}
      {!isLoading && filtered.length > 0 && (
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
    </div>
  )
}
