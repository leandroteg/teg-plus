import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight, Plus, Search, X, Save, Loader2,
  ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertCircle,
} from 'lucide-react'
import {
  useMovimentacoes, useRegistrarMovimentacao,
  useEstoqueItens, useBases,
} from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
import type { NovaMovimentacaoPayload, TipoMovimentacao } from '../../types/estoque'
import NumericInput from '../../components/NumericInput'

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

const EMPTY_PAYLOAD: Partial<NovaMovimentacaoPayload> = {
  tipo: 'entrada', quantidade: 1, valor_unitario: 0,
}

export default function Movimentacoes() {
  const [params, setParams] = useSearchParams()
  const { isLightSidebar: isLight } = useTheme()
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<string>('')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(params.get('nova') === '1')
  const [payload, setPayload] = useState<Partial<NovaMovimentacaoPayload>>({ ...EMPTY_PAYLOAD })

  const { data: movs = [], isLoading } = useMovimentacoes({
    ...(tipoFiltro ? { tipo: tipoFiltro as TipoMovimentacao } : {}),
    page,
  })
  const registrar = useRegistrarMovimentacao()
  const { data: itens = [] } = useEstoqueItens()
  const { data: bases = [] } = useBases()

  const filtradas = busca.trim()
    ? movs.filter(m =>
        m.item?.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
        m.item?.codigo?.toLowerCase().includes(busca.toLowerCase()) ||
        m.responsavel_nome?.toLowerCase().includes(busca.toLowerCase())
      )
    : movs

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
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{'Movimenta\u00e7\u00f5es'}</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{filtradas.length} registros</p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Nova Movimentacao
        </button>
      </div>

      {/* -- Filtros ------------------------------------------------- */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por item ou responsavel..."
            className={`w-full pl-9 pr-4 py-2 rounded-xl border text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400
              ${isLight ? 'border-slate-200 bg-white text-slate-800' : 'border-white/[0.08] bg-white/[0.03] text-slate-200 placeholder:text-slate-500'}`}
          />
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
            return (
              <div key={mov.id}
                className={`rounded-2xl border p-4 flex items-center gap-3 ${card}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                  <Icon size={16} className={cfg.cor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    {mov.item?.descricao ?? '--'}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {mov.base?.nome ?? '--'}
                    {mov.responsavel_nome ? ` - ${mov.responsavel_nome}` : ''}
                    {mov.obra_nome ? ` - ${mov.obra_nome}` : ''}
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
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Item *</label>
                <select value={payload.item_id ?? ''} onChange={e => set('item_id', e.target.value)}
                  className={inputCls}>
                  <option value="">Selecione...</option>
                  {itens.map(i => (
                    <option key={i.id} value={i.id}>{i.codigo} -- {i.descricao}</option>
                  ))}
                </select>
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
                  <input value={payload.obra_nome ?? ''} onChange={e => set('obra_nome', e.target.value)}
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
                  <input value={payload.responsavel_nome ?? ''} onChange={e => set('responsavel_nome', e.target.value)}
                    className={inputCls} placeholder="Nome..." />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-bold mb-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Observacao</label>
                <textarea value={payload.observacao ?? ''} onChange={e => set('observacao', e.target.value)}
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
