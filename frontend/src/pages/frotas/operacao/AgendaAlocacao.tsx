import { useState, useMemo } from 'react'
import {
  CalendarDays,
  Plus,
  CornerDownLeft,
  X,
  LayoutList,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { UpperTextarea } from '../../../components/UpperInput'
import {
  useAlocacoes,
  useCriarAlocacao,
  useEncerrarAlocacao,
  useVeiculos,
} from '../../../hooks/useFrotas'
import { useTheme } from '../../../contexts/ThemeContext'
import { formatCodigoCategoria } from '../../../components/frotas/veiculoObs'
import type { FroAlocacao, FroVeiculo } from '../../../types/frotas'

// ── Types ────────────────────────────────────────────────────────────────────
type ViewMode = 'tabela' | 'timeline' | 'calendario'

// ── Helpers ───────────────────────────────────────────────────────────────────
const FMT = (d: string) => new Date(d).toLocaleDateString('pt-BR')

function diasAlocado(dataSaida: string): number {
  const diff = Date.now() - new Date(dataSaida).getTime()
  return Math.max(0, Math.floor(diff / 86400000))
}

function isVencido(data?: string): boolean {
  if (!data) return false
  return new Date(data) < new Date()
}

/** Returns array of Date objects from start to end (inclusive) */
function dateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const endNorm = new Date(end)
  endNorm.setHours(0, 0, 0, 0)
  while (cur <= endNorm) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function getEndDate(al: FroAlocacao): Date {
  if (al.data_retorno_real) return new Date(al.data_retorno_real)
  if (al.data_retorno_prev) return new Date(al.data_retorno_prev)
  // If no end date, show as ongoing until today+1
  return new Date()
}

// ── Retorno Modal ─────────────────────────────────────────────────────────────
function RetornoModal({
  alocacao,
  onClose,
  isLight,
}: {
  alocacao: FroAlocacao
  onClose: () => void
  isLight: boolean
}) {
  const encerrar = useEncerrarAlocacao()
  const [hodometro, setHodometro] = useState('')
  const [obs, setObs] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await encerrar.mutateAsync({
      id: alocacao.id,
      hodometro_retorno: hodometro ? +hodometro : undefined,
      observacoes: obs || undefined,
    })
    onClose()
  }

  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
      : 'bg-white/6 border border-white/12 text-white'
  }`
  const lbl = `block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 ${
          isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Registrar Retorno
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isLight
                ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`p-3 rounded-xl text-sm ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/4 border border-white/8'}`}>
          <p className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            {alocacao.veiculo?.placa} — {alocacao.veiculo?.marca} {alocacao.veiculo?.modelo}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Saída: {FMT(alocacao.data_saida)} · {alocacao.obra?.nome ?? 'Sem obra'}
          </p>
        </div>

        <div>
          <label className={lbl}>Hodômetro de Retorno (km)</label>
          <input
            type="number"
            className={inp}
            value={hodometro}
            onChange={e => setHodometro(e.target.value)}
            placeholder="Ex: 58320"
          />
        </div>

        <div>
          <label className={lbl}>Observações</label>
          <UpperTextarea
            className={`${inp} resize-none`}
            rows={2}
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Condições do veículo, ocorrências..."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 font-medium py-2.5 rounded-xl border text-sm ${
              isLight
                ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                : 'border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={encerrar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm shadow-rose-500/20 text-sm text-white font-semibold disabled:opacity-50"
          >
            {encerrar.isPending ? 'Registrando...' : 'Confirmar Retorno'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Nova Alocação Modal ───────────────────────────────────────────────────────
function NovaAlocacaoModal({
  onClose,
  isLight,
}: {
  onClose: () => void
  isLight: boolean
}) {
  const criar = useCriarAlocacao()
  const { data: veiculos = [] } = useVeiculos({ status: 'disponivel' })
  const [form, setForm] = useState({
    veiculo_id: '',
    obra_id: '',
    responsavel_nome: '',
    data_saida: new Date().toISOString().split('T')[0],
    data_retorno_prev: '',
    observacoes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await criar.mutateAsync({
      veiculo_id: form.veiculo_id,
      obra_id: form.obra_id || undefined,
      responsavel_nome: form.responsavel_nome || undefined,
      data_saida: form.data_saida,
      data_retorno_prev: form.data_retorno_prev || undefined,
      observacoes: form.observacoes || undefined,
      status: 'ativa',
    })
    onClose()
  }

  const inp = `w-full px-3 py-2 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/40 ${
    isLight
      ? 'bg-white border border-slate-200 shadow-sm text-slate-800'
      : 'bg-white/6 border border-white/12 text-white'
  }`
  const sel = inp + (isLight ? '' : ' [&>option]:bg-slate-900')
  const lbl = `block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 ${
          isLight ? 'bg-white border border-slate-200' : 'bg-[#1e293b] border border-white/[0.06]'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Nova Alocação
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isLight
                ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Veículo *</label>
            <select
              className={sel}
              value={form.veiculo_id}
              onChange={e => setForm(f => ({ ...f, veiculo_id: e.target.value }))}
              required
            >
              <option value="">Selecione...</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>
                  {v.placa} — {v.marca} {v.modelo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>Obra / CC</label>
            <input
              className={inp}
              value={form.obra_id}
              onChange={e => setForm(f => ({ ...f, obra_id: e.target.value }))}
              placeholder="ID ou código da obra"
            />
          </div>
        </div>

        <div>
          <label className={lbl}>Responsável</label>
          <input
            className={inp}
            value={form.responsavel_nome}
            onChange={e => setForm(f => ({ ...f, responsavel_nome: e.target.value }))}
            placeholder="Nome do responsável"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Data de Saída *</label>
            <input
              type="date"
              className={inp}
              value={form.data_saida}
              onChange={e => setForm(f => ({ ...f, data_saida: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className={lbl}>Retorno Previsto</label>
            <input
              type="date"
              className={inp}
              value={form.data_retorno_prev}
              onChange={e => setForm(f => ({ ...f, data_retorno_prev: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className={lbl}>Observações</label>
          <UpperTextarea
            className={`${inp} resize-none`}
            rows={2}
            value={form.observacoes}
            onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            placeholder="Detalhes da alocação..."
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 font-medium py-2.5 rounded-xl border text-sm ${
              isLight
                ? 'border-slate-200 text-slate-500 hover:bg-slate-50'
                : 'border-white/10 text-slate-400 hover:bg-white/5'
            }`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={criar.isPending}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm shadow-rose-500/20 text-sm text-white font-semibold disabled:opacity-50"
          >
            {criar.isPending ? 'Criando...' : 'Criar Alocação'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── View Toggle ──────────────────────────────────────────────────────────────
function ViewToggle({
  viewMode,
  setViewMode,
  isLight,
}: {
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  isLight: boolean
}) {
  const views: { key: ViewMode; icon: typeof LayoutList; label: string }[] = [
    { key: 'tabela', icon: LayoutList, label: 'Tabela' },
    { key: 'timeline', icon: BarChart3, label: 'Timeline' },
    { key: 'calendario', icon: CalendarDays, label: 'Calendário' },
  ]

  return (
    <div
      className={`inline-flex rounded-xl p-1 ${
        isLight ? 'bg-slate-100 border border-slate-200' : 'bg-white/5 border border-white/8'
      }`}
    >
      {views.map(v => {
        const active = viewMode === v.key
        return (
          <button
            key={v.key}
            onClick={() => setViewMode(v.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active
                ? isLight
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'bg-white/10 text-rose-400 shadow-sm'
                : isLight
                  ? 'text-slate-500 hover:text-slate-700'
                  : 'text-slate-400 hover:text-white'
            }`}
          >
            <v.icon size={13} />
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Timeline / Gantt View ────────────────────────────────────────────────────
function TimelineView({
  alocacoes,
  veiculosMap,
  isLight,
}: {
  alocacoes: FroAlocacao[]
  veiculosMap: Map<string, FroVeiculo>
  isLight: boolean
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Default range: start of current month - 7 days to end of current month + 7 days
  const defaultStart = addDays(startOfMonth(today), -7)
  const defaultEnd = addDays(endOfMonth(today), 7)

  const [rangeStart, setRangeStart] = useState(defaultStart)
  const [rangeEnd, setRangeEnd] = useState(defaultEnd)

  const days = useMemo(() => dateRange(rangeStart, rangeEnd), [rangeStart, rangeEnd])
  const totalDays = days.length

  // Group allocations by vehicle placa (com codigo + categoria)
  const vehicleRows = useMemo(() => {
    const map = new Map<string, {
      placa: string
      codigo: string
      categoria: string
      modelo: string
      allocations: FroAlocacao[]
    }>()
    for (const al of alocacoes) {
      const placa = al.veiculo?.placa ?? 'Sem placa'
      if (!map.has(placa)) {
        const veic = al.veiculo_id ? veiculosMap.get(al.veiculo_id) : undefined
        const { codigo, categoria } = veic
          ? formatCodigoCategoria(veic)
          : { codigo: placa, categoria: '' }
        map.set(placa, {
          placa,
          codigo,
          categoria,
          modelo: `${al.veiculo?.marca ?? ''} ${al.veiculo?.modelo ?? ''}`.trim(),
          allocations: [],
        })
      }
      map.get(placa)!.allocations.push(al)
    }
    return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [alocacoes, veiculosMap])

  function navigate(direction: 'prev' | 'next') {
    const shift = direction === 'prev' ? -14 : 14
    setRangeStart(addDays(rangeStart, shift))
    setRangeEnd(addDays(rangeEnd, shift))
  }

  function goToday() {
    setRangeStart(addDays(startOfMonth(today), -7))
    setRangeEnd(addDays(endOfMonth(today), 7))
  }

  // Calculate the "today" position as a percentage
  const todayIdx = diffDays(rangeStart, today)
  const todayPct = totalDays > 0 ? (todayIdx / totalDays) * 100 : -1

  // Column width: each day gets equal width
  const colW = totalDays > 0 ? 100 / totalDays : 1

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    al: FroAlocacao
    x: number
    y: number
  } | null>(null)

  const card = `rounded-2xl shadow-sm border ${
    isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'
  }`

  return (
    <div className={`${card} overflow-hidden`}>
      {/* Navigation header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          isLight ? 'border-slate-200' : 'border-white/8'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('prev')}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToday}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              isLight
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => navigate('next')}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className={`text-xs font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {rangeStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} —{' '}
          {rangeEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>

      {vehicleRows.length === 0 ? (
        <div className="p-12 text-center min-h-[320px] flex flex-col items-center justify-center">
          <BarChart3
            size={32}
            className={`mx-auto mb-2 opacity-30 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}
          />
          <p className="text-sm text-slate-500">Nenhuma alocação no período</p>
        </div>
      ) : (
        <div className="overflow-x-auto relative pb-1">
          {/* Day headers */}
          <div className="flex min-w-[800px]">
            {/* Vehicle label column */}
            <div
              className={`flex-shrink-0 w-36 sm:w-44 border-r px-3 py-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/4 border-white/8'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Veículo
              </span>
            </div>
            {/* Day columns header */}
            <div className="flex-1 flex relative">
              {days.map((d, i) => {
                const isToday = isSameDay(d, today)
                const isWknd = isWeekend(d)
                const isFirstOfMonth = d.getDate() === 1
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-[22px] text-center border-r py-1 ${
                      isToday
                        ? isLight
                          ? 'bg-rose-50 border-rose-200'
                          : 'bg-rose-500/10 border-rose-500/20'
                        : isWknd
                          ? isLight
                            ? 'bg-slate-50/80 border-slate-100'
                            : 'bg-white/[0.02] border-white/[0.04]'
                          : isLight
                            ? 'border-slate-100'
                            : 'border-white/[0.04]'
                    }`}
                  >
                    {isFirstOfMonth && (
                      <p className="text-[8px] font-bold text-rose-500 leading-none mb-0.5">
                        {MONTHS_PT[d.getMonth()]?.slice(0, 3).toUpperCase()}
                      </p>
                    )}
                    <p
                      className={`text-[9px] leading-none ${
                        isToday
                          ? 'font-bold text-rose-600'
                          : isWknd
                            ? 'text-slate-400'
                            : isLight
                              ? 'text-slate-500'
                              : 'text-slate-500'
                      }`}
                    >
                      {d.getDate()}
                    </p>
                    <p className="text-[7px] text-slate-400 leading-none">
                      {WEEKDAYS_PT[d.getDay()]?.charAt(0)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Vehicle rows */}
          {vehicleRows.map(row => (
            <div
              key={row.placa}
              className={`flex min-w-[800px] border-t ${
                isLight ? 'border-slate-100' : 'border-white/[0.04]'
              }`}
            >
              {/* Vehicle label: CODIGO · CATEGORIA / MODELO · PLACA */}
              <div
                className={`flex-shrink-0 w-44 sm:w-52 border-r px-3 py-2.5 ${
                  isLight ? 'border-slate-200' : 'border-white/8'
                }`}
              >
                <div className="flex items-baseline gap-1.5 truncate">
                  <span className={`text-xs font-extrabold font-mono truncate ${
                    isLight ? 'text-slate-800' : 'text-white'
                  }`}>
                    {row.codigo}
                  </span>
                  {row.categoria && (
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      isLight ? 'text-rose-600' : 'text-rose-400'
                    }`}>
                      {row.categoria}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 truncate">
                  {row.modelo}
                  <span className={isLight ? 'text-slate-300' : 'text-slate-600'}> · </span>
                  <span className="font-mono font-semibold">{row.placa}</span>
                </p>
              </div>
              {/* Bars area */}
              <div className="flex-1 relative" style={{ minHeight: 40 }}>
                {/* Weekend stripes background */}
                <div className="absolute inset-0 flex">
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className={`flex-1 min-w-[22px] ${
                        isSameDay(d, today)
                          ? isLight
                            ? 'bg-rose-50/50'
                            : 'bg-rose-500/5'
                          : isWeekend(d)
                            ? isLight
                              ? 'bg-slate-50/60'
                              : 'bg-white/[0.01]'
                            : ''
                      }`}
                    />
                  ))}
                </div>

                {/* Today marker */}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-rose-500/60 z-10"
                    style={{ left: `${todayPct}%` }}
                  />
                )}

                {/* Allocation bars */}
                {row.allocations.map(al => {
                  const start = new Date(al.data_saida)
                  start.setHours(0, 0, 0, 0)
                  const end = getEndDate(al)
                  end.setHours(0, 0, 0, 0)

                  const startOff = diffDays(rangeStart, start)
                  const endOff = diffDays(rangeStart, end)

                  // Clamp to visible range
                  const visStart = Math.max(0, startOff)
                  const visEnd = Math.min(totalDays - 1, endOff)

                  if (visStart > totalDays - 1 || visEnd < 0) return null

                  const leftPct = visStart * colW
                  const widthPct = Math.max(colW, (visEnd - visStart + 1) * colW)

                  const isActive = al.status === 'ativa'
                  const barColor = isActive
                    ? 'bg-emerald-500 hover:bg-emerald-400'
                    : 'bg-slate-400 hover:bg-slate-500'

                  return (
                    <div
                      key={al.id}
                      className={`absolute top-2 h-6 rounded-lg ${barColor} cursor-pointer transition-colors z-20 flex items-center px-1.5 overflow-hidden shadow-sm`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      onMouseEnter={e => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        setTooltip({ al, x: rect.left + rect.width / 2, y: rect.top - 8 })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <span className="text-[9px] font-semibold text-white truncate whitespace-nowrap">
                        {al.obra?.nome ?? al.responsavel_nome ?? ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Floating tooltip */}
          {tooltip && (
            <div
              className={`fixed z-50 px-3 py-2 rounded-xl shadow-xl text-xs pointer-events-none ${
                isLight
                  ? 'bg-white border border-slate-200 text-slate-800'
                  : 'bg-[#1e293b] border border-white/10 text-white'
              }`}
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <p className="font-bold">
                {tooltip.al.veiculo?.placa} — {tooltip.al.veiculo?.marca}{' '}
                {tooltip.al.veiculo?.modelo}
              </p>
              <p className="text-slate-500 mt-0.5">
                {tooltip.al.obra?.nome ?? 'Sem obra'} · {tooltip.al.responsavel_nome ?? '—'}
              </p>
              <p className="text-slate-500">
                {FMT(tooltip.al.data_saida)} →{' '}
                {tooltip.al.data_retorno_real
                  ? FMT(tooltip.al.data_retorno_real)
                  : tooltip.al.data_retorno_prev
                    ? FMT(tooltip.al.data_retorno_prev)
                    : 'Em aberto'}
              </p>
              <span
                className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  tooltip.al.status === 'ativa'
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : tooltip.al.status === 'encerrada'
                      ? 'bg-slate-500/15 text-slate-600'
                      : 'bg-red-500/15 text-red-500'
                }`}
              >
                {tooltip.al.status.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Calendar Grid View ───────────────────────────────────────────────────────
function CalendarView({
  alocacoes,
  isLight,
}: {
  alocacoes: FroAlocacao[]
  isLight: boolean
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [currentMonth, setCurrentMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  function navigate(dir: 'prev' | 'next') {
    setCurrentMonth(new Date(year, month + (dir === 'prev' ? -1 : 1), 1))
  }

  function goToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1)
  const lastDay = endOfMonth(firstDay)
  const startOffset = firstDay.getDay() // 0=Sun
  const totalCells = startOffset + lastDay.getDate()
  const rows = Math.ceil(totalCells / 7)

  // Build a map: day-of-month -> allocations active on that day
  const dayAllocMap = useMemo(() => {
    const map = new Map<number, FroAlocacao[]>()
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dayDate = new Date(year, month, d)
      dayDate.setHours(0, 0, 0, 0)
      const matching = alocacoes.filter(al => {
        const start = new Date(al.data_saida)
        start.setHours(0, 0, 0, 0)
        const end = getEndDate(al)
        end.setHours(0, 0, 0, 0)
        return dayDate >= start && dayDate <= end
      })
      if (matching.length > 0) map.set(d, matching)
    }
    return map
  }, [alocacoes, year, month, lastDay])

  const card = `rounded-2xl shadow-sm border ${
    isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'
  }`

  return (
    <div className={`${card} overflow-hidden min-h-[420px]`}>
      {/* Month navigation */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          isLight ? 'border-slate-200' : 'border-white/8'
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('prev')}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToday}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              isLight
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => navigate('next')}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/10 text-slate-400'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <span className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {MONTHS_PT[month]} {year}
        </span>
      </div>

      {/* Weekday headers */}
      <div
        className={`grid grid-cols-7 border-b ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/4 border-white/8'
        }`}
      >
        {WEEKDAYS_PT.map(wd => (
          <div
            key={wd}
            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center py-2"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7">
        {Array.from({ length: rows * 7 }).map((_, idx) => {
          const dayNum = idx - startOffset + 1
          const isValidDay = dayNum >= 1 && dayNum <= lastDay.getDate()
          const dayDate = isValidDay ? new Date(year, month, dayNum) : null
          const isToday = dayDate ? isSameDay(dayDate, today) : false
          const isWknd = dayDate ? isWeekend(dayDate) : false
          const allocs = isValidDay ? dayAllocMap.get(dayNum) ?? [] : []

          return (
            <div
              key={idx}
              className={`min-h-[72px] sm:min-h-[88px] border-b border-r p-1 ${
                !isValidDay
                  ? isLight
                    ? 'bg-slate-50/50 border-slate-100'
                    : 'bg-white/[0.01] border-white/[0.03]'
                  : isToday
                    ? isLight
                      ? 'bg-rose-50/60 border-slate-200'
                      : 'bg-rose-500/5 border-white/[0.06]'
                    : isWknd
                      ? isLight
                        ? 'bg-slate-50/50 border-slate-100'
                        : 'bg-white/[0.02] border-white/[0.04]'
                      : isLight
                        ? 'border-slate-100'
                        : 'border-white/[0.04]'
              }`}
            >
              {isValidDay && (
                <>
                  <span
                    className={`text-[10px] font-bold ${
                      isToday
                        ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white'
                        : isLight
                          ? 'text-slate-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {dayNum}
                  </span>
                  <div className="mt-0.5 space-y-0.5 overflow-hidden">
                    {allocs.slice(0, 3).map(al => {
                      const isActive = al.status === 'ativa'
                      return (
                        <div
                          key={al.id}
                          className={`rounded px-1 py-px truncate text-[9px] font-semibold cursor-default ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                          }`}
                          title={`${al.veiculo?.placa} - ${al.obra?.nome ?? 'Sem obra'} (${al.responsavel_nome ?? '—'})`}
                        >
                          {al.veiculo?.placa} · {al.obra?.nome?.slice(0, 10) ?? '—'}
                        </div>
                      )
                    })}
                    {allocs.length > 3 && (
                      <p className="text-[8px] text-slate-400 font-semibold pl-1">
                        +{allocs.length - 3} mais
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AgendaAlocacao() {
  const { isDark } = useTheme()
  const isLight = !isDark
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')

  // For table view, keep the original active-only query
  const { data: alocacoesAtivas = [], isLoading: loadingAtivas } = useAlocacoes({ status: 'ativa' })
  // For timeline/calendar, load all statuses
  const { data: todasAlocacoes = [], isLoading: loadingTodas } = useAlocacoes()
  // Veiculos para extrair codigo_interno + categoria
  const { data: veiculosList = [] } = useVeiculos()
  const veiculosMap = useMemo(() => {
    const m = new Map<string, FroVeiculo>()
    veiculosList.forEach(v => m.set(v.id, v))
    return m
  }, [veiculosList])

  const [novaModal, setNovaModal] = useState(false)
  const [retornoAloc, setRetornoAloc] = useState<FroAlocacao | null>(null)

  // Filtros — default: mostrar so 'ativa' (sem canceladas/encerradas)
  const [filtroAtivo, setFiltroAtivo] = useState('')
  const [filtroPessoa, setFiltroPessoa] = useState('')
  const [filtroObra, setFiltroObra] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'' | 'ativa' | 'encerrada' | 'cancelada'>('ativa')

  const raw = viewMode === 'tabela' ? alocacoesAtivas : todasAlocacoes

  // Opcoes unicas para selects
  const veiculosUnicos = useMemo(() => [...new Set(raw.map(a => a.veiculo?.placa).filter(Boolean))].sort() as string[], [raw])
  const pessoasUnicas = useMemo(() => [...new Set(raw.map(a => a.responsavel_nome).filter(Boolean))].sort() as string[], [raw])
  const obrasUnicas = useMemo(() => [...new Set(raw.map(a => (a.obra as any)?.nome).filter(Boolean))].sort() as string[], [raw])

  const alocacoes = useMemo(() => {
    let items = raw
    if (filtroAtivo) items = items.filter(a => a.veiculo?.placa === filtroAtivo)
    if (filtroPessoa) items = items.filter(a => a.responsavel_nome === filtroPessoa)
    if (filtroObra) items = items.filter(a => (a.obra as any)?.nome === filtroObra)
    if (filtroStatus) items = items.filter(a => a.status === filtroStatus)
    return items
  }, [raw, filtroAtivo, filtroPessoa, filtroObra, filtroStatus])

  const hasFilters = !!(filtroAtivo || filtroPessoa || filtroObra || filtroStatus)
  const clearFilters = () => { setFiltroAtivo(''); setFiltroPessoa(''); setFiltroObra(''); setFiltroStatus('') }
  const isLoading = viewMode === 'tabela' ? loadingAtivas : loadingTodas

  const card = `rounded-2xl shadow-sm border ${
    isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.06]'
  }`
  const th = `text-[10px] font-bold uppercase tracking-wide text-slate-500 px-4 py-3 text-left`

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className={`text-xl font-bold flex items-center gap-2 ${
              isLight ? 'text-slate-800' : 'text-white'
            }`}
          >
            <CalendarDays size={20} className="text-rose-500" />
            Agenda de Alocação
          </h1>
          <p className="text-sm text-slate-500">
            {alocacoesAtivas.length} ativo{alocacoesAtivas.length !== 1 ? 's' : ''} em campo
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle viewMode={viewMode} setViewMode={setViewMode} isLight={isLight} />
          <button
            onClick={() => setNovaModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 shadow-sm shadow-rose-500/20 text-sm text-white font-semibold"
          >
            <Plus size={15} /> Nova Alocação
          </button>
        </div>
      </div>

      {/* Filtros — em uma unica linha com scroll horizontal em mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <select value={filtroAtivo} onChange={e => setFiltroAtivo(e.target.value)}
          className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
            filtroAtivo
              ? isLight ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-400/40 bg-rose-500/10 text-rose-300'
              : isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
          }`}>
          <option value="">Todos veiculos</option>
          {veiculosUnicos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroPessoa} onChange={e => setFiltroPessoa(e.target.value)}
          className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
            filtroPessoa
              ? isLight ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-400/40 bg-rose-500/10 text-rose-300'
              : isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
          }`}>
          <option value="">Todos responsaveis</option>
          {pessoasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}
          className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
            filtroObra
              ? isLight ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-400/40 bg-rose-500/10 text-rose-300'
              : isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
          }`}>
          <option value="">Todas obras</option>
          {obrasUnicas.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {viewMode !== 'tabela' && (
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as '' | 'ativa' | 'encerrada' | 'cancelada')}
            className={`shrink-0 px-3 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
              filtroStatus
                ? isLight ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-400/40 bg-rose-500/10 text-rose-300'
                : isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
            }`}>
            <option value="ativa">Ativas</option>
            <option value="encerrada">Encerradas</option>
            <option value="cancelada">Canceladas</option>
            <option value="">Todos status</option>
          </select>
        )}
        {hasFilters && (
          <button onClick={clearFilters}
            className={`shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-white/[0.06]'
            }`}>
            <X size={12} /> Limpar
          </button>
        )}
        <span className={`shrink-0 ml-auto pl-2 text-[11px] whitespace-nowrap ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {alocacoes.length} resultado{alocacoes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-xl h-14 animate-pulse ${
                isLight ? 'bg-slate-100' : 'bg-white/5'
              }`}
            />
          ))}
        </div>
      ) : viewMode === 'tabela' ? (
        /* ── Table View ──────────────────────────────────────────────── */
        alocacoes.length === 0 ? (
          <div className={`${card} p-12 text-center`}>
            <CalendarDays
              size={32}
              className={`mx-auto mb-2 opacity-30 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}
            />
            <p className="text-sm text-slate-500">Nenhuma alocação ativa no momento</p>
          </div>
        ) : (
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead
                  className={`border-b ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/4 border-white/8'
                  }`}
                >
                  <tr>
                    <th className={th}>Ativo</th>
                    <th className={th}>Obra / CC</th>
                    <th className={th}>Responsável</th>
                    <th className={th}>Saída</th>
                    <th className={th}>Retorno Prev.</th>
                    <th className={th}>Dias Alocado</th>
                    <th className={th}>Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {(alocacoes as FroAlocacao[]).map(al => {
                    const vencido = isVencido(al.data_retorno_prev)
                    return (
                      <tr
                        key={al.id}
                        className={`transition-colors ${
                          isLight ? 'hover:bg-slate-50' : 'hover:bg-white/3'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p
                            className={`text-sm font-bold ${
                              isLight ? 'text-slate-800' : 'text-white'
                            }`}
                          >
                            {al.veiculo?.placa}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {al.veiculo?.marca} {al.veiculo?.modelo}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className={`text-sm ${
                              isLight ? 'text-slate-700' : 'text-slate-200'
                            }`}
                          >
                            {al.obra?.nome ?? '—'}
                          </p>
                          {al.obra?.codigo && (
                            <p className="text-[10px] text-slate-500">{al.obra.codigo}</p>
                          )}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm ${
                            isLight ? 'text-slate-700' : 'text-slate-300'
                          }`}
                        >
                          {al.responsavel_nome ?? '—'}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm ${
                            isLight ? 'text-slate-700' : 'text-slate-300'
                          }`}
                        >
                          {FMT(al.data_saida)}
                        </td>
                        <td className="px-4 py-3">
                          {al.data_retorno_prev ? (
                            <span
                              className={`text-sm font-semibold ${
                                vencido ? 'text-red-500' : isLight ? 'text-slate-700' : 'text-slate-300'
                              }`}
                            >
                              {FMT(al.data_retorno_prev)}
                              {vencido && (
                                <span className="ml-1 text-[10px] font-bold text-red-500">
                                  ATRASADO
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-bold ${
                              isLight ? 'text-slate-800' : 'text-white'
                            }`}
                          >
                            {diasAlocado(al.data_saida)} d
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setRetornoAloc(al)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                          >
                            <CornerDownLeft size={12} /> Retorno
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : viewMode === 'timeline' ? (
        /* ── Timeline View ───────────────────────────────────────────── */
        <TimelineView alocacoes={alocacoes} veiculosMap={veiculosMap} isLight={isLight} />
      ) : (
        /* ── Calendar View ───────────────────────────────────────────── */
        <CalendarView alocacoes={alocacoes} isLight={isLight} />
      )}

      {novaModal && (
        <NovaAlocacaoModal onClose={() => setNovaModal(false)} isLight={isLight} />
      )}
      {retornoAloc && (
        <RetornoModal
          alocacao={retornoAloc}
          onClose={() => setRetornoAloc(null)}
          isLight={isLight}
        />
      )}
    </div>
  )
}
