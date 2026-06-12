import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeftRight, Plus, Search, X, Save, Loader2,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertCircle,
  Calendar, KeyRound, Truck, Building2,
} from 'lucide-react'
import {
  useMovimentacoes, useRegistrarMovimentacao,
  useEstoqueItens, useBases, useSaldos,
} from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
import type { NovaMovimentacaoPayload, TipoMovimentacao } from '../../types/estoque'
import NumericInput from '../../components/NumericInput'
import { UpperInput, UpperTextarea } from '../../components/UpperInput'

const TIPO_CONFIG: Record<TipoMovimentacao, { label: string; cor: string; bg: string; icon: typeof ArrowLeftRight }> = {
  entrada:           { label: 'Entrada',        cor: 'text-emerald-700', bg: 'bg-emerald-50', icon: ArrowDownCircle  },
  devolucao:         { label: 'Devolu\u00e7\u00e3o',       cor: 'text-teal-700',    bg: 'bg-teal-50',   icon: ArrowDownCircle  },
  transferencia_in:  { label: 'Transf. Entrada', cor: 'text-blue-700',    bg: 'bg-blue-50',   icon: ArrowDownCircle  },
  ajuste_positivo:   { label: 'Ajuste +',        cor: 'text-indigo-700',  bg: 'bg-indigo-50', icon: RefreshCw        },
  saida:             { label: 'Sa\u00edda',           cor: 'text-red-700',     bg: 'bg-red-50',    icon: ArrowUpCircle    },
  transferencia_out: { label: 'Transf. Sa\u00edda',   cor: 'text-orange-700',  bg: 'bg-orange-50', icon: ArrowUpCircle    },
  ajuste_negativo:   { label: 'Ajuste -',        cor: 'text-amber-700',   bg: 'bg-amber-50',  icon: RefreshCw        },
  baixa:             { label: 'Baixa',           cor: 'text-slate-600',   bg: 'bg-slate-100', icon: AlertCircle      },
}

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const toISO = (d: Date) => d.toISOString().slice(0, 10)
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISO(d)
}
type PeriodoPreset = 'todos' | 'hoje' | '7d' | '30d' | 'custom'
const PERIODO_PRESETS: { key: PeriodoPreset; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'hoje',  label: 'Hoje' },
  { key: '7d',    label: '7 dias' },
  { key: '30d',   label: '30 dias' },
  { key: 'custom', label: 'Personalizado' },
]

const EMPTY_PAYLOAD: Partial<NovaMovimentacaoPayload> = {
  tipo: 'entrada', quantidade: 1, valor_unitario: 0,
}

export default function Movimentacoes() {
  const [params, setParams] = useSearchParams()
  const { isLightSidebar: isLight } = useTheme()
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('')
  const [baseFiltro, setBaseFiltro] = useState<string>('')
  const [periodo, setPeriodo] = useState<PeriodoPreset>('todos')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(params.get('nova') === '1')
  const [payload, setPayload] = useState<Partial<NovaMovimentacaoPayload>>({ ...EMPTY_PAYLOAD })

  // Reseta paginação quando qualquer filtro muda
  useEffect(() => { setPage(1) }, [busca, tipoFiltro, baseFiltro, periodo, dateFrom, dateTo])

  // Resolve período preset → dateFrom/dateTo efetivos
  const periodoFiltro = useMemo(() => {
    const hoje = toISO(new Date())
    switch (periodo) {
      case 'hoje':   return { dateFrom: hoje,        dateTo: hoje }
      case '7d':     return { dateFrom: daysAgo(7),  dateTo: hoje }
      case '30d':    return { dateFrom: daysAgo(30), dateTo: hoje }
      case 'custom': return { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
      default:       return { dateFrom: undefined, dateTo: undefined }
    }
  }, [periodo, dateFrom, dateTo])

  const { data: movs = [], isLoading } = useMovimentacoes({
    ...(tipoFiltro ? { tipo: tipoFiltro as TipoMovimentacao } : {}),
    ...(baseFiltro ? { base_id: baseFiltro } : {}),
    ...(busca.trim().length >= 2 ? { busca: busca.trim() } : {}),
    ...(periodoFiltro.dateFrom ? { dateFrom: periodoFiltro.dateFrom } : {}),
    ...(periodoFiltro.dateTo   ? { dateTo:   periodoFiltro.dateTo   } : {}),
    page,
  })
  const registrar = useRegistrarMovimentacao()
  const { data: itens = [] } = useEstoqueItens()
  const { data: bases = [] } = useBases()

  // Tipos que consomem estoque — só faz sentido escolher item com saldo
  const TIPOS_CONSUMO: TipoMovimentacao[] = ['saida', 'transferencia_out', 'ajuste_negativo', 'baixa']
  const tipoConsumo = TIPOS_CONSUMO.includes(payload.tipo as TipoMovimentacao)
  // Só busca saldos quando faz sentido (tipo de consumo + base selecionada)
  const { data: saldos = [] } = useSaldos(
    tipoConsumo && payload.base_id ? payload.base_id : undefined,
  )
  const saldoPorItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of saldos) if (s.saldo > 0) m.set(s.item_id, s.saldo)
    return m
  }, [saldos])
  const itensSelecionaveis = useMemo(() => {
    if (!tipoConsumo || !payload.base_id) return itens
    return itens.filter(i => saldoPorItem.has(i.id))
  }, [itens, saldoPorItem, tipoConsumo, payload.base_id])

  // Busca complementar client-side em descricao/codigo do item (embed nao da
  // pra filtrar via .or no PostgREST). Quando server-side encontra > 0 ja
  // basta; quando 0, tenta o filtro extra de item nessa pagina.
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q || q.length < 2) return movs
    // Server ja filtrou por responsavel/obra/nf; aqui complementa com item.
    const extraItem = movs.filter(m =>
      m.item?.descricao?.toLowerCase().includes(q) ||
      m.item?.codigo?.toLowerCase().includes(q)
    )
    if (extraItem.length === movs.length) return movs
    // Une server result + matches por item (dedup por id)
    const ids = new Set(movs.map(m => m.id))
    extraItem.forEach(m => ids.add(m.id))
    return [...movs, ...extraItem.filter(m => !movs.find(x => x.id === m.id))]
  }, [movs, busca])

  const temFiltroAtivo = !!busca.trim() || !!tipoFiltro || !!baseFiltro || periodo !== 'todos'
  function limparFiltros() {
    setBusca(''); setTipoFiltro(''); setBaseFiltro(''); setPeriodo('todos'); setDateFrom(''); setDateTo('')
  }

  async function handleSave() {
    if (!payload.item_id || !payload.base_id || !payload.tipo || !payload.quantidade) return
    await registrar.mutateAsync(payload as NovaMovimentacaoPayload)
    closeForm()
  }

  const set = (k: keyof NovaMovimentacaoPayload, v: any) => setPayload(p => ({ ...p, [k]: v }))

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  useEffect(() => {
    setShowForm(params.get('nova') === '1')
  }, [params])

  function openForm() {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('nova', '1')
      return next
    })
  }

  function closeForm() {
    setShowForm(false)
    setPayload({ ...EMPTY_PAYLOAD })
    setParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('nova')
      return next
    })
  }

  return (
    <div className="space-y-4">

      {/* -- Header --------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Histórico</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{filtradas.length} registros</p>
        </div>
      </div>

      {/* -- Filtros ------------------------------------------------- */}
      <div className="space-y-2">
        {/* Linha 1: busca + tipo + base */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar item, responsável, obra, NF..."
              className={`w-full pl-9 pr-9 py-2 rounded-xl border text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
                ${isLight ? 'border-slate-200 bg-white text-slate-800' : 'border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-500'}`}
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold
              focus:outline-none focus:ring-2 focus:ring-blue-500/30
              ${isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'}`}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={baseFiltro}
            onChange={e => setBaseFiltro(e.target.value)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold
              focus:outline-none focus:ring-2 focus:ring-blue-500/30
              ${isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'}`}
          >
            <option value="">Todas as bases</option>
            {bases.map(b => (
              <option key={b.id} value={b.id}>{b.nome}</option>
            ))}
          </select>
        </div>

        {/* Linha 2: período + datepicker custom + limpar */}
        <div className="flex gap-2 flex-wrap items-center">
          <Calendar size={13} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          {PERIODO_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                periodo === p.key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : isLight
                    ? 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    : 'bg-white/[0.03] text-slate-400 border-white/[0.08] hover:bg-white/[0.06]'
              }`}
            >
              {p.label}
            </button>
          ))}
          {periodo === 'custom' && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className={`px-2 py-1 rounded-lg border text-[11px] ${
                  isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
                }`}
              />
              <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>até</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className={`px-2 py-1 rounded-lg border text-[11px] ${
                  isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-white/[0.08] bg-white/[0.03] text-slate-300'
                }`}
              />
            </>
          )}
          {temFiltroAtivo && (
            <button
              onClick={limparFiltros}
              className="ml-auto px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors flex items-center gap-1"
            >
              <X size={11} /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* -- Lista --------------------------------------------------- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <ArrowLeftRight size={40} className={isLight ? 'text-slate-200' : 'text-slate-600'} />
          <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma movimentacao encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(mov => {
            const cfg = TIPO_CONFIG[mov.tipo]
            const Icon = cfg.icon
            const isEntrada = ['entrada', 'devolucao', 'transferencia_in', 'ajuste_positivo'].includes(mov.tipo)
            const baseDesconhecida = !mov.base?.nome && !!mov.base_id
            return (
              <div key={mov.id}
                className={`rounded-2xl border p-4 flex items-center gap-3 ${card}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <Icon size={16} className={cfg.cor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      {mov.item?.codigo && (
                        <span className={`font-mono text-[10px] mr-1.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {mov.item.codigo}
                        </span>
                      )}
                      {mov.item?.descricao ?? '--'}
                    </p>
                    {/* Chips de origem */}
                    {mov.cautela_id && (
                      <Link
                        to={`/estoque/cautelas?id=${mov.cautela_id}`}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-1.5 py-0.5 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                        title="De uma cautela — clique pra abrir"
                      >
                        <KeyRound size={9} /> Cautela
                      </Link>
                    )}
                    {mov.recebimento_item_id && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700"
                        title="De um recebimento de pedido"
                      >
                        <Truck size={9} /> Recebimento{mov.nf_numero ? ` · NF ${mov.nf_numero}` : ''}
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Building2 size={9} />
                    <span className={baseDesconhecida ? 'italic text-amber-600' : ''}>
                      {mov.base?.nome ?? (baseDesconhecida ? 'Base removida' : '--')}
                    </span>
                    {mov.responsavel_nome ? <> · {mov.responsavel_nome}</> : null}
                    {mov.obra_nome ? <> · {mov.obra_nome}</> : null}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-extrabold ${isEntrada ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isEntrada ? '+' : '-'}{mov.quantidade} {mov.item?.unidade}
                  </p>
                  <p className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{fmtData(mov.criado_em)}</p>
                </div>
                <span className={`hidden sm:inline-flex items-center rounded-full text-[10px] font-semibold
                  px-2 py-0.5 ${cfg.bg} ${cfg.cor}`}>
                  {cfg.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* -- Paginacao ----------------------------------------------- */}
      {!isLoading && filtradas.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Pagina {page}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40
                ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={filtradas.length < 50}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40
                ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}
            >
              Proxima
            </button>
          </div>
        </div>
      )}

      {/* -- Modal Nova Movimentacao -------------------------------- */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${isLight ? 'bg-white' : 'bg-[#111827]'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Nova Movimentacao</h2>
              <button onClick={closeForm}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Tipo *</label>
                <select value={payload.tipo} onChange={e => set('tipo', e.target.value)}
                  className={inputCls}>
                  {Object.entries(TIPO_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Item *
                  {tipoConsumo && payload.base_id && (
                    <span className={`ml-2 font-normal text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      ({itensSelecionaveis.length} com saldo na base)
                    </span>
                  )}
                  {tipoConsumo && !payload.base_id && (
                    <span className="ml-2 font-normal text-[10px] text-amber-600">
                      Selecione a base primeiro pra filtrar por saldo
                    </span>
                  )}
                </label>
                <select value={payload.item_id ?? ''} onChange={e => set('item_id', e.target.value)}
                  className={inputCls}>
                  <option value="">Selecione...</option>
                  {itensSelecionaveis.map(i => {
                    const saldo = saldoPorItem.get(i.id)
                    const label = tipoConsumo && payload.base_id && saldo != null
                      ? `${i.codigo} -- ${i.descricao}  (saldo: ${saldo})`
                      : `${i.codigo} -- ${i.descricao}`
                    return <option key={i.id} value={i.id}>{label}</option>
                  })}
                </select>
                {tipoConsumo && payload.base_id && itensSelecionaveis.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-600">Nenhum item com saldo nesta base.</p>
                )}
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Base *</label>
                <select value={payload.base_id ?? ''} onChange={e => set('base_id', e.target.value)}
                  className={inputCls}>
                  <option value="">Selecione...</option>
                  {bases.map(b => (
                    <option key={b.id} value={b.id}>{b.nome}</option>
                  ))}
                </select>
              </div>

              {(payload.tipo === 'transferencia_out') && (
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Base Destino *</label>
                  <select value={payload.base_destino_id ?? ''} onChange={e => set('base_destino_id', e.target.value)}
                    className={inputCls}>
                    <option value="">Selecione...</option>
                    {bases.filter(b => b.id !== payload.base_id).map(b => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Quantidade *</label>
                  <NumericInput min={0.001} step={0.001} value={payload.quantidade ?? 1}
                    onChange={v => set('quantidade', v)}
                    className={inputCls} />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Valor Unit. (R$)</label>
                  <NumericInput min={0} step={0.01} value={payload.valor_unitario ?? 0}
                    onChange={v => set('valor_unitario', v)}
                    className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Obra / Destino</label>
                  <UpperInput value={payload.obra_nome ?? ''} onChange={e => set('obra_nome', e.target.value)}
                    className={inputCls} placeholder="Nome da obra..." />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Centro de Custo</label>
                  <input value={payload.centro_custo ?? ''} onChange={e => set('centro_custo', e.target.value)}
                    className={inputCls} placeholder="CC..." />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>NF Numero</label>
                  <input value={payload.nf_numero ?? ''} onChange={e => set('nf_numero', e.target.value)}
                    className={inputCls} placeholder="000000" />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Responsavel</label>
                  <UpperInput value={payload.responsavel_nome ?? ''} onChange={e => set('responsavel_nome', e.target.value)}
                    className={inputCls} placeholder="Nome..." />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Observacao</label>
                <UpperTextarea value={payload.observacao ?? ''} onChange={e => set('observacao', e.target.value)}
                  rows={2} className={`${inputCls} resize-none`} placeholder="Observacoes opcionais..." />
              </div>
            </div>

            <div className={`px-6 py-4 border-t flex justify-end gap-2 ${isLight ? 'border-slate-100' : 'border-white/[0.06]'}`}>
              <button onClick={() => setShowForm(false)}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
                  ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={registrar.isPending || !payload.item_id || !payload.base_id}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                  text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm"
              >
                {registrar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
