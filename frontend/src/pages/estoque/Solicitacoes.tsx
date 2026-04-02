import { useState } from 'react'
import {
  FileBox, Plus, X, Save, Loader2, Trash2,
  CheckCircle2, PackageCheck, Clock, Ban,
  ChevronDown, ChevronRight,
} from 'lucide-react'
import {
  useSolicitacoes, useCriarSolicitacao, useAtualizarSolicitacao,
  useEstoqueItens,
} from '../../hooks/useEstoque'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import type { EstSolicitacao, StatusSolicitacao } from '../../types/estoque'
import NumericInput from '../../components/NumericInput'

const STATUS_CONFIG: Record<StatusSolicitacao, { label: string; bg: string; text: string; dot: string }> = {
  aberta:       { label: 'Aberta',       bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  aprovada:     { label: 'Aprovada',     bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  em_separacao: { label: 'Em Separa\u00e7\u00e3o', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  atendida:     { label: 'Atendida',     bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500'   },
  parcial:      { label: 'Parcial',      bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
  cancelada:    { label: 'Cancelada',    bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400'   },
}

const URGENCIA_CONFIG = {
  normal:  { label: 'Normal',  bg: 'bg-slate-100', text: 'text-slate-600' },
  urgente: { label: 'Urgente', bg: 'bg-amber-50',  text: 'text-amber-700' },
  critica: { label: 'Cr\u00edtica', bg: 'bg-red-50',    text: 'text-red-700'   },
}

const STATUS_TRANSITIONS: Record<string, { next: StatusSolicitacao; label: string; icon: typeof CheckCircle2; color: string }[]> = {
  aberta:       [
    { next: 'aprovada',   label: 'Aprovar',      icon: CheckCircle2, color: 'bg-emerald-600 hover:bg-emerald-700' },
    { next: 'cancelada',  label: 'Cancelar',     icon: Ban,          color: 'bg-red-600 hover:bg-red-700'         },
  ],
  aprovada:     [
    { next: 'em_separacao', label: 'Iniciar Separa\u00e7\u00e3o', icon: PackageCheck, color: 'bg-amber-600 hover:bg-amber-700' },
    { next: 'cancelada',    label: 'Cancelar',          icon: Ban,          color: 'bg-red-600 hover:bg-red-700'     },
  ],
  em_separacao: [
    { next: 'atendida', label: 'Marcar Atendida', icon: CheckCircle2, color: 'bg-green-600 hover:bg-green-700' },
    { next: 'parcial',  label: 'Atendimento Parcial', icon: Clock,    color: 'bg-indigo-600 hover:bg-indigo-700' },
  ],
  parcial: [
    { next: 'atendida', label: 'Marcar Atendida', icon: CheckCircle2, color: 'bg-green-600 hover:bg-green-700' },
  ],
}

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

type ItemForm = { item_id?: string; descricao_livre?: string; quantidade: number; unidade?: string }

export default function Solicitacoes() {
  const { isLightSidebar: isLight } = useTheme()
  const { hasSetorPapel } = useAuth()
  const [statusFiltro, setStatusFiltro] = useState<StatusSolicitacao | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: solicitacoes = [], isLoading } = useSolicitacoes(
    statusFiltro ? statusFiltro as StatusSolicitacao : undefined
  )
  const criarSolicitacao = useCriarSolicitacao()
  const atualizarSolicitacao = useAtualizarSolicitacao()
  const canApproveSaida = hasSetorPapel('estoque', ['supervisor', 'diretor', 'ceo'])
    || hasSetorPapel('patrimonial', ['supervisor', 'diretor', 'ceo'])

  const card = isLight
    ? 'bg-white border-slate-200 shadow-sm'
    : 'bg-white/[0.03] border-white/[0.06]'

  return (
    <div className="space-y-4">

      {/* -- Header --------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{'Solicita\u00e7\u00f5es de Material'}</h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{solicitacoes.length} {'solicita\u00e7\u00f5es'}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
            text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus size={15} /> Nova Solicitacao
        </button>
      </div>

      {/* -- Filtros ------------------------------------------------- */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'aberta', 'aprovada', 'em_separacao', 'atendida', 'parcial', 'cancelada'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFiltro(s)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
              statusFiltro === s
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : isLight
                  ? 'bg-white text-slate-500 border-slate-200'
                  : 'bg-white/[0.03] text-slate-400 border-white/[0.08]'
            }`}
          >
            {s === '' ? 'Todas' : STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* -- Lista --------------------------------------------------- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : solicitacoes.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${card}`}>
          <FileBox size={40} className={isLight ? 'text-slate-200' : 'text-slate-600'} />
          <p className={`font-semibold mt-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Nenhuma solicitacao encontrada</p>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Crie uma nova solicitacao de material</p>
        </div>
      ) : (
        <div className="space-y-2">
          {solicitacoes.map(sol => {
            const cfg = STATUS_CONFIG[sol.status]
            const urgCfg = URGENCIA_CONFIG[sol.urgencia]
            const isExpanded = expandedId === sol.id
            const transitions = (STATUS_TRANSITIONS[sol.status] ?? []).filter(transition => {
              if (sol.status === 'aberta' && transition.next === 'aprovada') {
                return canApproveSaida
              }
              return true
            })

            return (
              <div key={sol.id} className={`rounded-2xl border overflow-hidden ${card}`}>
                <div
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}`}
                  onClick={() => setExpandedId(isExpanded ? null : sol.id)}
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <FileBox size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>{sol.numero}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full text-[10px] font-semibold px-2 py-0.5 ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                      <span className={`inline-flex rounded-full text-[10px] font-semibold px-2 py-0.5 ${urgCfg.bg} ${urgCfg.text}`}>
                        {urgCfg.label}
                      </span>
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {sol.solicitante_nome} - {sol.obra_nome}
                      {sol.centro_custo ? ` - CC: ${sol.centro_custo}` : ''}
                      {' - '}{fmtData(sol.criado_em)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 mr-2 hidden sm:block">
                    <p className={`text-sm font-semibold ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      {sol.itens?.length ?? 0} {(sol.itens?.length ?? 0) === 1 ? 'item' : 'itens'}
                    </p>
                  </div>
                  {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                </div>

                {isExpanded && (
                  <div className={`border-t px-4 py-3 space-y-3 ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                    {/* Items list */}
                    {sol.itens && sol.itens.length > 0 && (
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Itens Solicitados</p>
                        <div className={`divide-y ${isLight ? 'divide-slate-50' : 'divide-white/[0.04]'}`}>
                          {sol.itens.map(item => (
                            <div key={item.id} className="flex items-center justify-between py-1.5">
                              <span className={`text-xs ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                {item.item?.descricao ?? item.descricao_livre ?? '--'}
                              </span>
                              <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                {item.quantidade} {item.unidade ?? item.item?.unidade ?? ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sol.observacao && (
                      <p className={`text-xs italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        {sol.observacao}
                      </p>
                    )}

                    {/* Status transition buttons */}
                    {transitions.length > 0 && (
                      <div className="flex gap-2 pt-1">
                        {transitions.map(t => {
                          const Icon = t.icon
                          return (
                            <button
                              key={t.next}
                              onClick={(e) => {
                                e.stopPropagation()
                                atualizarSolicitacao.mutate({ id: sol.id, status: t.next })
                              }}
                              disabled={atualizarSolicitacao.isPending}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                text-white text-xs font-semibold transition-colors disabled:opacity-50 ${t.color}`}
                            >
                              {atualizarSolicitacao.isPending ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                              {t.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* -- Modal Nova Solicitacao ---------------------------------- */}
      {showForm && (
        <NovaSolicitacaoModal
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            await criarSolicitacao.mutateAsync(data)
            setShowForm(false)
          }}
          saving={criarSolicitacao.isPending}
          isLight={isLight}
        />
      )}
    </div>
  )
}

// -- Nova Solicitacao Modal --------------------------------------------------------
function NovaSolicitacaoModal({
  onClose, onSave, saving, isLight
}: {
  onClose: () => void
  onSave: (data: {
    solicitante_nome: string
    obra_nome: string
    centro_custo?: string
    urgencia: string
    observacao?: string
    itens: ItemForm[]
  }) => void
  saving: boolean
  isLight: boolean
}) {
  const [solicitante, setSolicitante] = useState('')
  const [obra, setObra] = useState('')
  const [centroCusto, setCentroCusto] = useState('')
  const [urgencia, setUrgencia] = useState('normal')
  const [observacao, setObservacao] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([{ quantidade: 1 }])

  const { data: catalogoItens = [] } = useEstoqueItens()

  function addItem() {
    setItens(p => [...p, { quantidade: 1 }])
  }

  function removeItem(idx: number) {
    setItens(p => p.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ItemForm, value: any) {
    setItens(p => p.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function handleSubmit() {
    if (!solicitante || !obra || itens.length === 0) return
    onSave({
      solicitante_nome: solicitante,
      obra_nome: obra,
      centro_custo: centroCusto || undefined,
      urgencia,
      observacao: observacao || undefined,
      itens: itens.filter(i => i.item_id || i.descricao_livre),
    })
  }

  const modalBg = isLight ? 'bg-white' : 'bg-[#111827]'
  const borderB = isLight ? 'border-slate-100' : 'border-white/[0.06]'
  const labelCls = isLight ? 'text-slate-600' : 'text-slate-300'
  const inputCls = isLight
    ? 'input-base'
    : 'input-base bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`${modalBg} rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderB}`}>
          <h2 className={`text-lg font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>Nova Solicitacao de Material</h2>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-white/[0.06] text-slate-400'}`}>
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Solicitante *</label>
              <input value={solicitante} onChange={e => setSolicitante(e.target.value)}
                className={inputCls} placeholder="Nome do solicitante..." />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Obra *</label>
              <input value={obra} onChange={e => setObra(e.target.value)}
                className={inputCls} placeholder="Nome da obra..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Centro de Custo</label>
              <input value={centroCusto} onChange={e => setCentroCusto(e.target.value)}
                className={inputCls} placeholder="CC..." />
            </div>
            <div>
              <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Urgencia</label>
              <select value={urgencia} onChange={e => setUrgencia(e.target.value)}
                className={inputCls}>
                <option value="normal">Normal</option>
                <option value="urgente">Urgente</option>
                <option value="critica">Critica</option>
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-bold mb-1 ${labelCls}`}>Observacao</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
              rows={2} className={`${inputCls} resize-none`} placeholder="Observacoes opcionais..." />
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs font-bold ${labelCls}`}>Itens *</label>
              <button onClick={addItem}
                className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700">
                <Plus size={12} /> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className={`rounded-xl border p-3 ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/[0.04] bg-white/[0.02]'}`}>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <select
                        value={item.item_id ?? ''}
                        onChange={e => {
                          const val = e.target.value
                          if (val) {
                            updateItem(idx, 'item_id', val)
                            updateItem(idx, 'descricao_livre', undefined)
                          } else {
                            updateItem(idx, 'item_id', undefined)
                          }
                        }}
                        className={`${inputCls} text-xs`}
                      >
                        <option value="">Item do catalogo ou livre...</option>
                        {catalogoItens.map(i => (
                          <option key={i.id} value={i.id}>{i.codigo} -- {i.descricao}</option>
                        ))}
                      </select>
                    </div>
                    <NumericInput
                      min={1}
                      value={item.quantidade}
                      onChange={v => updateItem(idx, 'quantidade', v)}
                      className={`w-20 ${inputCls} text-xs text-center`}
                      placeholder="Qtd"
                    />
                    {itens.length > 1 && (
                      <button onClick={() => removeItem(idx)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {!item.item_id && (
                    <input
                      value={item.descricao_livre ?? ''}
                      onChange={e => updateItem(idx, 'descricao_livre', e.target.value)}
                      className={`${inputCls} text-xs mt-2`}
                      placeholder="Descricao livre do item..."
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex justify-end gap-2 ${borderB}`}>
          <button onClick={onClose}
            className={`px-4 py-2 rounded-xl border text-sm font-semibold transition-colors
              ${isLight ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-white/[0.08] text-slate-400 hover:bg-white/[0.04]'}`}>
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !solicitante || !obra || itens.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
              text-white text-sm font-semibold transition-colors disabled:opacity-60 shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Criar Solicitacao
          </button>
        </div>
      </div>
    </div>
  )
}
