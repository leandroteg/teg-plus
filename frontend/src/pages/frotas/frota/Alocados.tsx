import { useState, useMemo } from 'react'
import { MapPin, Wrench, CornerDownLeft, X, Car, Cog, CalendarDays, Building2, LayoutGrid, LayoutList, User, Search } from 'lucide-react'
import { UpperTextarea } from '../../../components/UpperInput'
import { useTheme } from '../../../contexts/ThemeContext'
import { useAlocacoes, useEncerrarAlocacao, useOrdensServico, useVeiculos } from '../../../hooks/useFrotas'
import VeiculoDetalhesModal from '../../../components/frotas/VeiculoDetalhesModal'
import { formatCodigoCategoria } from '../../../components/frotas/veiculoObs'
import type { FroAlocacao, FroVeiculo } from '../../../types/frotas'

// ── OSBadge ───────────────────────────────────────────────────────────────────

function OSBadge({ count, isLight }: { count: number; isLight: boolean }) {
  if (count === 0) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
      isLight ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/10 text-red-400 border-red-500/20'
    }`}>
      <Wrench size={9} />
      {count} OS
    </span>
  )
}

// ── RetornoModal ─────────────────────────────────────────────────────────────

interface RetornoModalProps {
  alocacao: FroAlocacao
  isLight: boolean
  onClose: () => void
  onConfirm: (params: {
    id: string
    hodometro_retorno?: number
    horimetro_retorno?: number
    observacoes?: string
  }) => void
  isPending: boolean
}

function RetornoModal({ alocacao, isLight, onClose, onConfirm, isPending }: RetornoModalProps) {
  const isMaquina = alocacao.veiculo?.categoria === undefined
    ? false
    : false // will detect from veiculo info below — default to km

  // We use veiculo to detect tipo_ativo if available
  // Since FroAlocacao.veiculo is Pick<..., 'id'|'placa'|'modelo'|'marca'|'categoria'>
  // we infer maquina from horimetro fields presence — treat as vehicle by default
  const [hodometro, setHodometro] = useState('')
  const [horimetro, setHorimetro] = useState('')
  const [obs, setObs]             = useState('')

  const identificador = alocacao.veiculo?.placa ?? alocacao.veiculo_id

  function handleSubmit() {
    onConfirm({
      id: alocacao.id,
      hodometro_retorno: hodometro ? Number(hodometro) : undefined,
      horimetro_retorno: horimetro ? Number(horimetro) : undefined,
      observacoes: obs || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#1e293b] border-white/[0.08]'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${
          isLight ? 'border-slate-100' : 'border-white/[0.06]'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isLight ? 'bg-rose-50 text-rose-600' : 'bg-rose-500/10 text-rose-400'
            }`}>
              <CornerDownLeft size={15} />
            </div>
            <div>
              <p className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                Registrar Retorno
              </p>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {identificador} — {alocacao.veiculo?.marca} {alocacao.veiculo?.modelo}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'
            }`}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Hodômetro retorno (km)
              </label>
              <input
                type="number"
                value={hodometro}
                onChange={e => setHodometro(e.target.value)}
                placeholder="Ex: 125400"
                className={`w-full px-3 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                  isLight
                    ? 'bg-white border-slate-200 focus:ring-rose-500/20 focus:border-rose-400'
                    : 'bg-slate-800/60 border-slate-700 text-white focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-500'
                }`}
              />
            </div>
            <div>
              <label className={`text-xs font-semibold block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Horímetro retorno (h)
              </label>
              <input
                type="number"
                value={horimetro}
                onChange={e => setHorimetro(e.target.value)}
                placeholder="Ex: 3200"
                className={`w-full px-3 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
                  isLight
                    ? 'bg-white border-slate-200 focus:ring-rose-500/20 focus:border-rose-400'
                    : 'bg-slate-800/60 border-slate-700 text-white focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-500'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`text-xs font-semibold block mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Observações
            </label>
            <UpperTextarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Condições do retorno, ocorrências, etc."
              rows={3}
              className={`w-full px-3 py-2 rounded-xl border text-sm resize-none transition-all focus:outline-none focus:ring-2 ${
                isLight
                  ? 'bg-white border-slate-200 focus:ring-rose-500/20 focus:border-rose-400'
                  : 'bg-slate-800/60 border-slate-700 text-white focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-500'
              }`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${
          isLight ? 'border-slate-100' : 'border-white/[0.06]'
        }`}>
          <button
            onClick={onClose}
            disabled={isPending}
            className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
              isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
              isPending ? 'opacity-60 cursor-not-allowed' : ''
            } ${
              isLight
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/30'
                : 'bg-rose-500/90 text-white hover:bg-rose-500 shadow-sm shadow-rose-500/20'
            }`}
          >
            {isPending ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CornerDownLeft size={12} />
            )}
            {isPending ? 'Registrando...' : 'Confirmar Retorno'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

// ── AlocacaoCard ──────────────────────────────────────────────────────────────

interface AlocacaoCardProps {
  a: FroAlocacao
  veic?: FroVeiculo
  osCount: number
  isLight: boolean
  onRetorno: (a: FroAlocacao) => void
  onOpen: (a: FroAlocacao) => void
}

function AlocacaoCard({ a, veic, osCount, isLight, onRetorno, onOpen }: AlocacaoCardProps) {
  const isMaquina = veic?.tipo_ativo === 'maquina'
  const retAtrasado = a.data_retorno_prev && new Date(a.data_retorno_prev) < new Date()
  const { codigo, categoria } = veic ? formatCodigoCategoria(veic) : { codigo: a.veiculo?.placa ?? '—', categoria: '' }

  return (
    <div
      onClick={() => onOpen(a)}
      className={`rounded-2xl border shadow-sm transition-all hover:shadow-md cursor-pointer ${
        isLight ? 'bg-white border-slate-200 hover:border-rose-200' : 'bg-[#1e293b] border-white/[0.06] hover:border-rose-500/30'
      }`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
        {/* Top line: Icon + Codigo/Categoria/Modelo-Placa */}
        <div className="flex items-center gap-3">
          {/* Icon box */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isMaquina
              ? (isLight ? 'bg-violet-50' : 'bg-violet-500/10')
              : (isLight ? 'bg-sky-50'    : 'bg-sky-500/10')
          }`}>
            {isMaquina
              ? <Cog size={16} className={isLight ? 'text-violet-600' : 'text-violet-400'} />
              : <Car size={16} className={isLight ? 'text-sky-600'    : 'text-sky-400'} />
            }
          </div>

          {/* Codigo + Categoria (menor) / Modelo - Placa */}
          <div className="min-w-0 sm:w-56 shrink-0">
            <div className="flex items-baseline gap-2 truncate">
              <span className={`text-sm font-extrabold font-mono truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{codigo}</span>
              {categoria && (
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                  {categoria}
                </span>
              )}
              {osCount > 0 && <OSBadge count={osCount} isLight={isLight} />}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              {a.veiculo?.marca} {a.veiculo?.modelo}
              <span className={isLight ? 'text-slate-300' : 'text-slate-600'}> · </span>
              <span className="font-mono font-semibold">{a.veiculo?.placa}</span>
            </p>
          </div>
        </div>

        {/* Obra / CC badge */}
        <div className="shrink-0">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full max-w-[180px] truncate ${
            isLight ? 'bg-rose-50 text-rose-700' : 'bg-rose-500/10 text-rose-300'
          }`}>
            <Building2 size={9} className="shrink-0" />
            {a.obra?.nome ?? a.centro_custo_id ?? 'Sem destino'}
          </span>
        </div>

        {/* Dates + responsável */}
        <div className="hidden md:flex items-center gap-x-3 text-[10px] text-slate-400 shrink-0">
          <span className="flex items-center gap-1">
            <CalendarDays size={10} /> Saída: {fmtDate(a.data_saida)}
          </span>
          <span className={`flex items-center gap-1 ${retAtrasado ? (isLight ? 'text-red-600 font-semibold' : 'text-red-400 font-semibold') : ''}`}>
            <CalendarDays size={10} /> Ret: {fmtDate(a.data_retorno_prev)}{retAtrasado ? ' ⚠' : ''}
          </span>
          {a.responsavel_nome && (
            <span className="flex items-center gap-1">
              <User size={10} /> {a.responsavel_nome}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="hidden sm:block flex-1" />

        {/* Action */}
        <button
          onClick={e => { e.stopPropagation(); onRetorno(a) }}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-semibold transition-all w-full sm:w-auto ${
            isLight
              ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600'
              : 'bg-white/[0.04] border-white/[0.06] text-slate-300 hover:bg-rose-500/10 hover:border-rose-500/25 hover:text-rose-300'
          }`}
        >
          <CornerDownLeft size={11} /> Registrar Retorno
        </button>
      </div>
    </div>
  )
}

// ── Alocados ──────────────────────────────────────────────────────────────────

export default function Alocados() {
  const { isDark } = useTheme()
  const isLight = !isDark
  const [retornoAloc, setRetornoAloc] = useState<FroAlocacao | null>(null)
  const [detalheVeiculo, setDetalheVeiculo] = useState<FroVeiculo | null>(null)
  const [detalheAloc, setDetalheAloc] = useState<FroAlocacao | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [busca, setBusca] = useState('')
  const [filtroObra, setFiltroObra] = useState<string>('todas')
  const [filtroResp, setFiltroResp] = useState<string>('todos')

  const { data: alocacoesAll = [], isLoading } = useAlocacoes({ status: 'ativa' })
  const { data: veiculosAll = [] } = useVeiculos()
  const { data: ordens    = [] } = useOrdensServico({
    status: ['pendente', 'aberta', 'em_cotacao', 'aguardando_aprovacao', 'aprovada', 'em_execucao'],
  })
  const encerrar = useEncerrarAlocacao()

  // Mapa veiculo completo (pra modal)
  const veicMap = useMemo(() => {
    const m = new Map<string, FroVeiculo>()
    veiculosAll.forEach(v => m.set(v.id, v))
    return m
  }, [veiculosAll])

  // Filtros dinâmicos
  const obrasUnicas = useMemo(() => {
    const s = new Set<string>()
    alocacoesAll.forEach(a => { if (a.obra?.nome) s.add(a.obra.nome) })
    return Array.from(s).sort()
  }, [alocacoesAll])

  const respsUnicos = useMemo(() => {
    const s = new Set<string>()
    alocacoesAll.forEach(a => { if (a.responsavel_nome?.trim()) s.add(a.responsavel_nome.trim()) })
    return Array.from(s).sort()
  }, [alocacoesAll])

  // Aplicar filtros
  const alocacoes = useMemo(() => {
    let list = alocacoesAll
    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(a => {
        const v = veicMap.get(a.veiculo_id)
        return a.veiculo?.placa?.toLowerCase().includes(q) ||
          a.veiculo?.marca?.toLowerCase().includes(q) ||
          a.veiculo?.modelo?.toLowerCase().includes(q) ||
          (v?.codigo_interno ?? '').toLowerCase().includes(q) ||
          a.obra?.nome?.toLowerCase().includes(q) ||
          a.responsavel_nome?.toLowerCase().includes(q)
      })
    }
    if (filtroObra !== 'todas') list = list.filter(a => a.obra?.nome === filtroObra)
    if (filtroResp !== 'todos') list = list.filter(a => a.responsavel_nome === filtroResp)
    return list
  }, [alocacoesAll, veicMap, busca, filtroObra, filtroResp])

  // map veiculo_id → OS count
  const osCountMap: Record<string, number> = {}
  for (const os of ordens) {
    osCountMap[os.veiculo_id] = (osCountMap[os.veiculo_id] ?? 0) + 1
  }

  function openDetalhe(a: FroAlocacao) {
    const v = veicMap.get(a.veiculo_id)
    if (!v) return
    setDetalheVeiculo(v)
    setDetalheAloc(a)
  }

  function handleConfirmarRetorno(params: {
    id: string
    hodometro_retorno?: number
    horimetro_retorno?: number
    observacoes?: string
  }) {
    encerrar.mutate(params, {
      onSuccess: () => setRetornoAloc(null),
    })
  }

  // ── Desktop table headers
  const thCls = `text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3 ${
    isLight ? 'text-slate-500' : 'text-slate-400'
  }`

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <MapPin size={18} className="text-rose-500" />
            Alocados
            {alocacoes.length > 0 && (
              <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/15 text-rose-400'
              }`}>
                {alocacoes.length} em uso
              </span>
            )}
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Ativos com alocação ativa em obras ou centros de custo
          </p>
        </div>

        {/* View toggle + total */}
        {alocacoes.length > 0 && (
          <div className={`flex items-center self-start sm:self-auto rounded-xl border overflow-hidden ${
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
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Filtros inteligentes */}
      {!isLoading && alocacoesAll.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Código, placa, modelo, obra, resp..."
              className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
                isLight ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/[0.06] text-slate-200'
              }`}
            />
          </div>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold outline-none max-w-[220px] ${
              isLight ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/[0.06] text-slate-200'
            }`}>
            <option value="todas">Todas obras</option>
            {obrasUnicas.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={filtroResp} onChange={e => setFiltroResp(e.target.value)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold outline-none max-w-[200px] ${
              isLight ? 'bg-white border-slate-200' : 'bg-white/[0.04] border-white/[0.06] text-slate-200'
            }`}>
            <option value="todos">Todos responsáveis</option>
            {respsUnicos.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className={`ml-auto text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {alocacoes.length} resultado{alocacoes.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && alocacoes.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/30 border-white/[0.06]'
        }`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
            isLight ? 'bg-slate-100' : 'bg-slate-700/40'
          }`}>
            <MapPin size={24} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          </div>
          <p className={`font-semibold text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Nenhum ativo alocado
          </p>
          <p className={`text-xs mt-1.5 max-w-xs text-center leading-relaxed ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Ativos do pátio disponível podem ser alocados a obras e centros de custo. Alocações ativas aparecerão aqui.
          </p>
        </div>
      )}

      {/* Table view */}
      {!isLoading && alocacoes.length > 0 && viewMode === 'table' && (
        <div className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-800/40 border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={isLight ? 'bg-slate-50 border-b border-slate-100' : 'bg-slate-800/60 border-b border-white/[0.04]'}>
                <tr>
                  <th className={thCls}>Ativo</th>
                  <th className={thCls}>Obra / CC</th>
                  <th className={thCls}>Responsável</th>
                  <th className={thCls}>Saída</th>
                  <th className={thCls}>Ret. Previsto</th>
                  <th className={thCls}>OS</th>
                  <th className={thCls + ' text-right'}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {alocacoes.map((a, idx) => {
                  const v = veicMap.get(a.veiculo_id)
                  const isMaquina = v?.tipo_ativo === 'maquina'
                  const { codigo, categoria } = v ? formatCodigoCategoria(v) : { codigo: a.veiculo?.placa ?? '—', categoria: '' }
                  const osCount = osCountMap[a.veiculo_id] ?? 0
                  const retAtrasado = a.data_retorno_prev && new Date(a.data_retorno_prev) < new Date()

                  const trCls = `border-t transition-colors cursor-pointer ${
                    isLight
                      ? `border-slate-100 hover:bg-rose-50/20 ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`
                      : `border-white/[0.04] hover:bg-white/[0.02] ${idx % 2 === 0 ? '' : 'bg-white/[0.01]'}`
                  }`

                  return (
                    <tr key={a.id} className={trCls} onClick={() => openDetalhe(a)}>
                      {/* Ativo */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isMaquina
                              ? (isLight ? 'bg-violet-50 text-violet-600' : 'bg-violet-500/10 text-violet-400')
                              : (isLight ? 'bg-sky-50 text-sky-600'       : 'bg-sky-500/10 text-sky-400')
                          }`}>
                            {isMaquina ? <Cog size={13} /> : <Car size={13} />}
                          </div>
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className={`text-xs font-extrabold font-mono ${isLight ? 'text-slate-800' : 'text-white'}`}>{codigo}</span>
                              {categoria && (
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${isLight ? 'text-rose-600' : 'text-rose-400'}`}>
                                  {categoria}
                                </span>
                              )}
                            </div>
                            <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                              {a.veiculo?.marca} {a.veiculo?.modelo}
                              <span className={isLight ? 'text-slate-300' : 'text-slate-600'}> · </span>
                              <span className="font-mono">{a.veiculo?.placa}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Obra */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={12} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                          <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {a.obra?.nome ?? a.centro_custo_id ?? '—'}
                          </span>
                        </div>
                      </td>

                      {/* Responsável */}
                      <td className="px-4 py-3">
                        <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                          {a.responsavel_nome ?? '—'}
                        </span>
                      </td>

                      {/* Saída */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-xs">
                          <CalendarDays size={11} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                          <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>
                            {fmtDate(a.data_saida)}
                          </span>
                        </div>
                      </td>

                      {/* Retorno previsto */}
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${
                          retAtrasado
                            ? (isLight ? 'text-red-600' : 'text-red-400')
                            : (isLight ? 'text-slate-600' : 'text-slate-300')
                        }`}>
                          {fmtDate(a.data_retorno_prev)}
                          {retAtrasado && ' ⚠'}
                        </span>
                      </td>

                      {/* OS */}
                      <td className="px-4 py-3">
                        <OSBadge count={osCount} isLight={isLight} />
                        {osCount === 0 && (
                          <span className={`text-[10px] ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>—</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setRetornoAloc(a)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all ${
                            isLight
                              ? 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600'
                              : 'bg-slate-700/60 text-slate-300 hover:bg-rose-500/10 hover:text-rose-400'
                          }`}
                        >
                          <CornerDownLeft size={12} /> Registrar Retorno
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards view */}
      {!isLoading && alocacoes.length > 0 && viewMode === 'cards' && (
        <div className="space-y-2">
          {alocacoes.map(a => (
            <AlocacaoCard
              key={a.id}
              a={a}
              veic={veicMap.get(a.veiculo_id)}
              osCount={osCountMap[a.veiculo_id] ?? 0}
              isLight={isLight}
              onRetorno={setRetornoAloc}
              onOpen={openDetalhe}
            />
          ))}
        </div>
      )}

      {/* Retorno Modal */}
      {retornoAloc && (
        <RetornoModal
          alocacao={retornoAloc}
          isLight={isLight}
          onClose={() => setRetornoAloc(null)}
          onConfirm={handleConfirmarRetorno}
          isPending={encerrar.isPending}
        />
      )}

      {/* Modal Detalhes */}
      {detalheVeiculo && detalheAloc && (
        <VeiculoDetalhesModal
          veiculo={detalheVeiculo}
          isLight={isLight}
          osCount={osCountMap[detalheAloc.veiculo_id] ?? 0}
          alocacaoInfo={{
            id: detalheAloc.id,
            obraId: detalheAloc.obra_id,
            obra: detalheAloc.obra?.nome,
            responsavel: detalheAloc.responsavel_nome ?? undefined,
            dataSaida: detalheAloc.data_saida,
            dataRetornoPrev: detalheAloc.data_retorno_prev,
            observacoes: detalheAloc.observacoes ?? undefined,
          }}
          onClose={() => { setDetalheVeiculo(null); setDetalheAloc(null) }}
          onRegistrarRetorno={() => {
            setRetornoAloc(detalheAloc)
            setDetalheVeiculo(null)
            setDetalheAloc(null)
          }}
        />
      )}
    </div>
  )
}
