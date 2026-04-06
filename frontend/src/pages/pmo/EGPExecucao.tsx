import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Zap, CalendarDays, BarChart3, DollarSign, AlertTriangle,
  ClipboardList, Plus, Trash2, Save, Edit3, X, Check,
  ShoppingCart, Truck, FileSignature, ChevronRight,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  usePortfolio, useTarefas, useAtualizarTarefa,
  useHistograma,
  useRiscosEGP, useCriarRisco, useAtualizarRisco, useDeletarRisco,
  usePlanoAcao, useCriarAcao, useAtualizarAcao, useDeletarAcao,
} from '../../hooks/usePMO'
import type { PMOTarefa, PMORisco, PMOPlanoAcao, PMOHistograma } from '../../types/pmo'

type Tab = 'cronograma' | 'histograma' | 'custos' | 'riscos' | 'plano_acao'

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'cronograma', label: 'Cronograma', icon: CalendarDays },
  { key: 'histograma', label: 'Histograma', icon: BarChart3 },
  { key: 'custos', label: 'Custos', icon: DollarSign },
  { key: 'riscos', label: 'Riscos', icon: AlertTriangle },
  { key: 'plano_acao', label: 'Plano de Ação', icon: ClipboardList },
]

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`

const PROB_LABELS: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', muito_alta: 'Muito Alta' }
const IMP_LABELS: Record<string, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', muito_alto: 'Muito Alto' }
const STATUS_RISCO_LABELS: Record<string, string> = { aberto: 'Aberto', mitigando: 'Mitigando', fechado: 'Fechado', aceito: 'Aceito' }
const STATUS_ACAO_LABELS: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em Andamento', concluida: 'Concluída', cancelada: 'Cancelada' }

// ── Main ────────────────────────────────────────────────────────────────────

export default function EGPExecucao() {
  const { isLightSidebar: isLight } = useTheme()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('cronograma')

  const { data: portfolio } = usePortfolio(portfolioId)

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button
        onClick={() => nav('/egp/execucao')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Zap size={20} className="text-violet-500" />
          Execução
        </h1>
        {portfolio && (
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            {portfolio.nome_obra} - {portfolio.numero_osc}
          </p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((t, idx) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <div key={t.key} className="flex items-center gap-1">
              {idx > 0 && (
                <ChevronRight size={14} className={isLight ? 'text-slate-300' : 'text-slate-600'} />
              )}
              <button
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  active
                    ? 'bg-violet-500 text-white shadow-md shadow-violet-500/25'
                    : isLight
                      ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            </div>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'cronograma' && <CronogramaPanel portfolioId={portfolioId} obraId={portfolio?.obra_id} isLight={isLight} />}
      {tab === 'histograma' && <HistogramaPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'custos' && <CustosPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'riscos' && <RiscosPanel portfolioId={portfolioId} isLight={isLight} />}
      {tab === 'plano_acao' && <PlanoAcaoPanel portfolioId={portfolioId} isLight={isLight} />}
    </div>
  )
}

// ── Spinner ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  )
}

// ── Cronograma Panel ────────────────────────────────────────────────────────

function CronogramaPanel({ portfolioId, obraId, isLight }: { portfolioId?: string; obraId?: string; isLight: boolean }) {
  const { data: tarefas, isLoading } = useTarefas(portfolioId)
  const atualizar = useAtualizarTarefa()
  const nav = useNavigate()
  const [editId, setEditId] = useState<string | null>(null)
  const [editPct, setEditPct] = useState(0)

  const thCls = `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-20 rounded-lg border px-2 py-1.5 text-sm text-center transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-violet-500/20 focus:border-violet-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-violet-500/20 focus:border-violet-500 text-white'
  }`

  const handleSavePct = async (t: PMOTarefa) => {
    await atualizar.mutateAsync({ id: t.id, percentual_concluido: editPct })
    setEditId(null)
  }

  const statusCls = (s: string) => {
    const map: Record<string, string> = {
      concluido: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400',
      em_andamento: isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/15 text-violet-400',
      a_fazer: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400',
      nao_iniciado: isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400',
      cancelado: isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400',
    }
    return map[s] ?? map.a_fazer
  }

  if (isLoading) return <Spinner />

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
              <th className={thCls}>Tarefa</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Início Real</th>
              <th className={thCls}>Término Real</th>
              <th className={thCls}>% Concluído</th>
              <th className={thCls}>Despachos</th>
              <th className={`${thCls} w-16`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(tarefas ?? []).map(t => {
              const isEditing = editId === t.id
              return (
                <tr key={t.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                  <td className={tdCls}>
                    <span className="font-medium">{t.tarefa}</span>
                    {t.responsavel && <span className={`block text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{t.responsavel}</span>}
                  </td>
                  <td className={tdCls}>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCls(t.status)}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className={tdCls}>{t.data_inicio_real ?? '-'}</td>
                  <td className={tdCls}>{t.data_termino_real ?? '-'}</td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={0} max={100}
                          value={editPct}
                          onChange={e => setEditPct(Number(e.target.value))}
                          className={inputCls}
                        />
                        <span className="text-xs">%</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className={`w-16 h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`}>
                          <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${t.percentual_concluido}%` }} />
                        </div>
                        <span className="text-xs font-semibold">{t.percentual_concluido}%</span>
                      </div>
                    )}
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => nav(`/compras/requisicoes/nova?obra_id=${obraId}`)}
                        title="Solicitar Compra"
                        className={`p-1 rounded-lg transition-colors ${isLight ? 'hover:bg-violet-50 text-violet-500' : 'hover:bg-violet-500/10 text-violet-400'}`}
                      >
                        <ShoppingCart size={14} />
                      </button>
                      <button
                        onClick={() => nav(`/logistica/solicitacoes/nova?obra_id=${obraId}`)}
                        title="Solicitar Transporte"
                        className={`p-1 rounded-lg transition-colors ${isLight ? 'hover:bg-violet-50 text-violet-500' : 'hover:bg-violet-500/10 text-violet-400'}`}
                      >
                        <Truck size={14} />
                      </button>
                      <button
                        onClick={() => nav(`/contratos/solicitacoes/nova?obra_id=${obraId}`)}
                        title="Solicitar Contratação"
                        className={`p-1 rounded-lg transition-colors ${isLight ? 'hover:bg-violet-50 text-violet-500' : 'hover:bg-violet-500/10 text-violet-400'}`}
                      >
                        <FileSignature size={14} />
                      </button>
                    </div>
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleSavePct(t)} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditId(t.id); setEditPct(t.percentual_concluido) }}
                        className={`${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                        <Edit3 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {(tarefas ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className={`text-center py-10 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Nenhuma tarefa encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Histograma Panel ────────────────────────────────────────────────────────

function HistogramaPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useHistograma(portfolioId)

  if (isLoading) return <Spinner />

  const grouped = (items ?? []).reduce<Record<string, PMOHistograma[]>>((acc, h) => {
    const cat = h.categoria ?? 'outros'
    ;(acc[cat] ??= []).push(h)
    return acc
  }, {})

  const catLabels: Record<string, string> = { mod: 'MOD', moi: 'MOI', maquinario: 'Maquinário' }
  const thCls = `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`

  if (Object.keys(grouped).length === 0) {
    return (
      <div className={`rounded-2xl border p-5 ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <p className={`text-center py-10 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Nenhum dado de histograma encontrado
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([cat, rows]) => (
        <div key={cat} className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className={`px-5 py-3 border-b ${isLight ? 'bg-slate-50 border-slate-100' : 'bg-white/[0.02] border-white/[0.04]'}`}>
            <h3 className={`text-sm font-bold ${isLight ? 'text-slate-700' : 'text-white'}`}>
              {catLabels[cat] ?? cat}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
                  <th className={thCls}>Função</th>
                  <th className={thCls}>Mes/Semana</th>
                  <th className={thCls}>Planejado</th>
                  <th className={thCls}>Real</th>
                  <th className={thCls}>Delta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(h => {
                  const isCritical = h.quantidade_real < h.quantidade_planejada * 0.7
                  const rowCls = isCritical
                    ? isLight ? 'bg-red-50' : 'bg-red-500/5'
                    : ''
                  return (
                    <tr key={h.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'} ${rowCls}`}>
                      <td className={tdCls}>{h.funcao}</td>
                      <td className={tdCls}>{h.mes ?? h.semana ?? '-'}</td>
                      <td className={tdCls}>{h.quantidade_planejada}</td>
                      <td className={`${tdCls} ${isCritical ? 'text-red-500 font-semibold' : ''}`}>
                        {h.quantidade_real}
                      </td>
                      <td className={tdCls}>
                        <span className={`text-xs font-semibold ${
                          h.quantidade_real >= h.quantidade_planejada
                            ? 'text-emerald-500'
                            : isCritical ? 'text-red-500' : 'text-amber-500'
                        }`}>
                          {h.quantidade_real - h.quantidade_planejada}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Custos Panel ────────────────────────────────────────────────────────────

function CustosPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: portfolio, isLoading } = usePortfolio(portfolioId)

  if (isLoading) return <Spinner />

  const planejado = portfolio?.custo_planejado ?? 0
  const real = portfolio?.custo_real ?? 0
  const delta = planejado - real
  const idc = real > 0 ? planejado / real : 0

  const cardCls = `rounded-2xl border p-5 ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  }`
  const labelCls = `text-xs font-semibold uppercase tracking-wide mb-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`

  const idcColor = idc >= 1 ? 'text-emerald-500' : idc >= 0.9 ? 'text-amber-500' : 'text-red-500'
  const deltaColor = delta >= 0 ? 'text-emerald-500' : 'text-red-500'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className={cardCls}>
        <p className={labelCls}>Custo Planejado</p>
        <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {fmtBRL(planejado)}
        </p>
      </div>
      <div className={cardCls}>
        <p className={labelCls}>Custo Real</p>
        <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {fmtBRL(real)}
        </p>
      </div>
      <div className={cardCls}>
        <p className={labelCls}>Delta (Plan - Real)</p>
        <p className={`text-lg font-bold ${deltaColor}`}>
          {fmtBRL(delta)}
        </p>
      </div>
      <div className={cardCls}>
        <p className={labelCls}>IDC (Plan / Real)</p>
        <p className={`text-lg font-bold ${idcColor}`}>
          {real > 0 ? idc.toFixed(2) : '-'}
        </p>
        <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          {idc >= 1 ? 'Dentro do orçamento' : idc >= 0.9 ? 'Atenção' : real > 0 ? 'Acima do orçamento' : 'Sem dados'}
        </p>
      </div>

      <div className={cardCls}>
        <p className={labelCls}>Valor Total OSC</p>
        <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {fmtBRL(portfolio?.valor_total_osc ?? 0)}
        </p>
      </div>
      <div className={cardCls}>
        <p className={labelCls}>Valor Faturado</p>
        <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {fmtBRL(portfolio?.valor_faturado ?? 0)}
        </p>
      </div>
      <div className={cardCls}>
        <p className={labelCls}>% Faturado</p>
        <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {portfolio?.valor_total_osc ? fmtPct(portfolio.valor_faturado / portfolio.valor_total_osc) : '-'}
        </p>
      </div>
      <div className={cardCls}>
        <p className={labelCls}>Custo Orçado</p>
        <p className={`text-lg font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          {fmtBRL(portfolio?.custo_orcado ?? 0)}
        </p>
      </div>
    </div>
  )
}

// ── Riscos Panel ────────────────────────────────────────────────────────────

function RiscosPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = useRiscosEGP(portfolioId)
  const criar = useCriarRisco()
  const atualizar = useAtualizarRisco()
  const deletar = useDeletarRisco()

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<PMORisco>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<PMORisco>>({ descricao: '', categoria: '', probabilidade: 'media', impacto: 'medio', resposta: '', responsavel: '', status: 'aberto' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const thCls = `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-full rounded-lg border px-2 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-violet-500/20 focus:border-violet-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-violet-500/20 focus:border-violet-500 text-white'
  }`

  const handleAdd = async () => {
    if (!portfolioId || !newRow.descricao) return
    await criar.mutateAsync({ ...newRow, portfolio_id: portfolioId })
    setNewRow({ descricao: '', categoria: '', probabilidade: 'media', impacto: 'medio', resposta: '', responsavel: '', status: 'aberto' })
    setAdding(false)
  }

  const handleUpdate = async () => {
    if (!editId) return
    await atualizar.mutateAsync({ id: editId, ...editRow })
    setEditId(null)
  }

  const handleDelete = async (id: string) => {
    if (!portfolioId) return
    await deletar.mutateAsync({ id, portfolio_id: portfolioId })
    setDeleteConfirm(null)
  }

  if (isLoading) return <Spinner />

  const probKeys = ['baixa', 'media', 'alta', 'muito_alta'] as const
  const impKeys = ['baixo', 'medio', 'alto', 'muito_alto'] as const
  const matrixCount = (p: string, i: string) =>
    (items ?? []).filter(r => r.probabilidade === p && r.impacto === i && r.status !== 'fechado').length

  const matrixColor = (pi: number, ii: number) => {
    const score = (pi + 1) * (ii + 1)
    if (score >= 12) return isLight ? 'bg-red-200 text-red-800' : 'bg-red-500/30 text-red-300'
    if (score >= 6) return isLight ? 'bg-amber-200 text-amber-800' : 'bg-amber-500/30 text-amber-300'
    if (score >= 3) return isLight ? 'bg-yellow-100 text-yellow-800' : 'bg-yellow-500/20 text-yellow-300'
    return isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'
  }

  const cardCls = `rounded-2xl border p-5 ${
    isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
  }`

  return (
    <div className="space-y-4">
      {/* Matrix */}
      <div className={cardCls}>
        <h3 className={`text-sm font-bold mb-4 ${isLight ? 'text-slate-700' : 'text-white'}`}>
          Matriz Probabilidade x Impacto
        </h3>
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className={`text-[10px] px-3 py-2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}></th>
                {impKeys.map(i => (
                  <th key={i} className={`text-[10px] uppercase font-semibold px-3 py-2 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {IMP_LABELS[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...probKeys].reverse().map((p, pi) => (
                <tr key={p}>
                  <td className={`text-[10px] uppercase font-semibold px-3 py-2 text-right ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    {PROB_LABELS[p]}
                  </td>
                  {impKeys.map((i, ii) => {
                    const count = matrixCount(p, i)
                    const reversedPi = probKeys.length - 1 - pi
                    return (
                      <td key={i} className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${matrixColor(reversedPi, ii)}`}>
                          {count || ''}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
                <th className={thCls}>Descrição</th>
                <th className={thCls}>Categoria</th>
                <th className={thCls}>Prob.</th>
                <th className={thCls}>Impacto</th>
                <th className={thCls}>Resposta</th>
                <th className={thCls}>Responsável</th>
                <th className={thCls}>Status</th>
                <th className={`${thCls} w-20`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map(item => {
                const isEditing = editId === item.id
                return (
                  <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                    <td className={tdCls}>
                      {isEditing ? <input className={inputCls} value={editRow.descricao ?? ''} onChange={e => setEditRow(r => ({ ...r, descricao: e.target.value }))} /> : item.descricao}
                    </td>
                    <td className={tdCls}>
                      {isEditing ? <input className={inputCls} value={editRow.categoria ?? ''} onChange={e => setEditRow(r => ({ ...r, categoria: e.target.value }))} /> : item.categoria ?? '-'}
                    </td>
                    <td className={tdCls}>
                      {isEditing ? (
                        <select className={inputCls} value={editRow.probabilidade ?? 'media'} onChange={e => setEditRow(r => ({ ...r, probabilidade: e.target.value as PMORisco['probabilidade'] }))}>
                          {Object.entries(PROB_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : PROB_LABELS[item.probabilidade ?? ''] ?? '-'}
                    </td>
                    <td className={tdCls}>
                      {isEditing ? (
                        <select className={inputCls} value={editRow.impacto ?? 'medio'} onChange={e => setEditRow(r => ({ ...r, impacto: e.target.value as PMORisco['impacto'] }))}>
                          {Object.entries(IMP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : IMP_LABELS[item.impacto ?? ''] ?? '-'}
                    </td>
                    <td className={tdCls}>
                      {isEditing ? <input className={inputCls} value={editRow.resposta ?? ''} onChange={e => setEditRow(r => ({ ...r, resposta: e.target.value }))} /> : item.resposta ?? '-'}
                    </td>
                    <td className={tdCls}>
                      {isEditing ? <input className={inputCls} value={editRow.responsavel ?? ''} onChange={e => setEditRow(r => ({ ...r, responsavel: e.target.value }))} /> : item.responsavel ?? '-'}
                    </td>
                    <td className={tdCls}>
                      {isEditing ? (
                        <select className={inputCls} value={editRow.status ?? 'aberto'} onChange={e => setEditRow(r => ({ ...r, status: e.target.value as PMORisco['status'] }))}>
                          {Object.entries(STATUS_RISCO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      ) : (
                        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.status === 'fechado'
                            ? isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400'
                            : item.status === 'mitigando'
                              ? isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-400'
                              : isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400'
                        }`}>
                          {STATUS_RISCO_LABELS[item.status] ?? item.status}
                        </span>
                      )}
                    </td>
                    <td className={tdCls}>
                      {deleteConfirm === item.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-600"><Check size={14} /></button>
                          <button onClick={() => setDeleteConfirm(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                        </div>
                      ) : isEditing ? (
                        <div className="flex items-center gap-1">
                          <button onClick={handleUpdate} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                          <button onClick={() => setEditId(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setEditId(item.id); setEditRow(item) }} className={`${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><Edit3 size={14} /></button>
                          <button onClick={() => setDeleteConfirm(item.id)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}

              {adding && (
                <tr className={`border-t ${isLight ? 'border-slate-100 bg-violet-50/30' : 'border-white/[0.04] bg-violet-500/5'}`}>
                  <td className={tdCls}><input className={inputCls} placeholder="Descrição" value={newRow.descricao ?? ''} onChange={e => setNewRow(r => ({ ...r, descricao: e.target.value }))} /></td>
                  <td className={tdCls}><input className={inputCls} placeholder="Categoria" value={newRow.categoria ?? ''} onChange={e => setNewRow(r => ({ ...r, categoria: e.target.value }))} /></td>
                  <td className={tdCls}>
                    <select className={inputCls} value={newRow.probabilidade ?? 'media'} onChange={e => setNewRow(r => ({ ...r, probabilidade: e.target.value as PMORisco['probabilidade'] }))}>
                      {Object.entries(PROB_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className={tdCls}>
                    <select className={inputCls} value={newRow.impacto ?? 'medio'} onChange={e => setNewRow(r => ({ ...r, impacto: e.target.value as PMORisco['impacto'] }))}>
                      {Object.entries(IMP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className={tdCls}><input className={inputCls} placeholder="Resposta" value={newRow.resposta ?? ''} onChange={e => setNewRow(r => ({ ...r, resposta: e.target.value }))} /></td>
                  <td className={tdCls}><input className={inputCls} placeholder="Responsável" value={newRow.responsavel ?? ''} onChange={e => setNewRow(r => ({ ...r, responsavel: e.target.value }))} /></td>
                  <td className={tdCls}>
                    <select className={inputCls} value={newRow.status ?? 'aberto'} onChange={e => setNewRow(r => ({ ...r, status: e.target.value as PMORisco['status'] }))}>
                      {Object.entries(STATUS_RISCO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1">
                      <button onClick={handleAdd} disabled={criar.isPending} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                      <button onClick={() => setAdding(false)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!adding && (
          <div className={`px-4 py-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
            <button
              onClick={() => setAdding(true)}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                isLight ? 'text-violet-600 hover:text-violet-700' : 'text-violet-400 hover:text-violet-300'
              }`}
            >
              <Plus size={14} /> Adicionar risco
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Plano de Acao Panel ─────────────────────────────────────────────────────

function PlanoAcaoPanel({ portfolioId, isLight }: { portfolioId?: string; isLight: boolean }) {
  const { data: items, isLoading } = usePlanoAcao(portfolioId)
  const criar = useCriarAcao()
  const atualizar = useAtualizarAcao()
  const deletar = useDeletarAcao()

  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<Partial<PMOPlanoAcao>>({})
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState<Partial<PMOPlanoAcao>>({ descricao: '', tipo_desvio: '', responsavel: '', prazo: '', status: 'pendente', evidencia_url: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const thCls = `text-[10px] uppercase tracking-wide font-semibold px-3 py-2 text-left ${isLight ? 'text-slate-400' : 'text-slate-500'}`
  const tdCls = `px-3 py-2.5 text-sm ${isLight ? 'text-slate-700' : 'text-slate-200'}`
  const inputCls = `w-full rounded-lg border px-2 py-1.5 text-sm transition-all focus:outline-none focus:ring-2 ${
    isLight
      ? 'bg-white border-slate-200 focus:ring-violet-500/20 focus:border-violet-400 text-slate-700'
      : 'bg-slate-800/60 border-slate-700 focus:ring-violet-500/20 focus:border-violet-500 text-white'
  }`

  const handleAdd = async () => {
    if (!portfolioId || !newRow.descricao) return
    await criar.mutateAsync({ ...newRow, portfolio_id: portfolioId })
    setNewRow({ descricao: '', tipo_desvio: '', responsavel: '', prazo: '', status: 'pendente', evidencia_url: '' })
    setAdding(false)
  }

  const handleUpdate = async () => {
    if (!editId) return
    await atualizar.mutateAsync({ id: editId, ...editRow })
    setEditId(null)
  }

  const handleDelete = async (id: string) => {
    if (!portfolioId) return
    await deletar.mutateAsync({ id, portfolio_id: portfolioId })
    setDeleteConfirm(null)
  }

  const statusBadgeCls = (s: string) => {
    const map: Record<string, string> = {
      pendente: isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-500/15 text-slate-400',
      em_andamento: isLight ? 'bg-violet-100 text-violet-700' : 'bg-violet-500/15 text-violet-400',
      concluida: isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/15 text-emerald-400',
      cancelada: isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/15 text-red-400',
    }
    return map[s] ?? map.pendente
  }

  if (isLoading) return <Spinner />

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
    }`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}>
              <th className={thCls}>Descrição</th>
              <th className={thCls}>Tipo Desvio</th>
              <th className={thCls}>Responsável</th>
              <th className={thCls}>Prazo</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Evidência</th>
              <th className={`${thCls} w-20`}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map(item => {
              const isEditing = editId === item.id
              return (
                <tr key={item.id} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.descricao ?? ''} onChange={e => setEditRow(r => ({ ...r, descricao: e.target.value }))} /> : item.descricao}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.tipo_desvio ?? ''} onChange={e => setEditRow(r => ({ ...r, tipo_desvio: e.target.value }))} /> : item.tipo_desvio ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input className={inputCls} value={editRow.responsavel ?? ''} onChange={e => setEditRow(r => ({ ...r, responsavel: e.target.value }))} /> : item.responsavel ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? <input type="date" className={inputCls} value={editRow.prazo ?? ''} onChange={e => setEditRow(r => ({ ...r, prazo: e.target.value }))} /> : item.prazo ?? '-'}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <select className={inputCls} value={editRow.status ?? 'pendente'} onChange={e => setEditRow(r => ({ ...r, status: e.target.value as PMOPlanoAcao['status'] }))}>
                        {Object.entries(STATUS_ACAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadgeCls(item.status)}`}>
                        {STATUS_ACAO_LABELS[item.status] ?? item.status}
                      </span>
                    )}
                  </td>
                  <td className={tdCls}>
                    {isEditing ? (
                      <input className={inputCls} placeholder="URL" value={editRow.evidencia_url ?? ''} onChange={e => setEditRow(r => ({ ...r, evidencia_url: e.target.value }))} />
                    ) : item.evidencia_url ? (
                      <a href={item.evidencia_url} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:underline text-xs">Ver</a>
                    ) : '-'}
                  </td>
                  <td className={tdCls}>
                    {deleteConfirm === item.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-600"><Check size={14} /></button>
                        <button onClick={() => setDeleteConfirm(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : isEditing ? (
                      <div className="flex items-center gap-1">
                        <button onClick={handleUpdate} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditId(item.id); setEditRow(item) }} className={`${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><Edit3 size={14} /></button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="text-red-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}

            {adding && (
              <tr className={`border-t ${isLight ? 'border-slate-100 bg-violet-50/30' : 'border-white/[0.04] bg-violet-500/5'}`}>
                <td className={tdCls}><input className={inputCls} placeholder="Descrição" value={newRow.descricao ?? ''} onChange={e => setNewRow(r => ({ ...r, descricao: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Tipo desvio" value={newRow.tipo_desvio ?? ''} onChange={e => setNewRow(r => ({ ...r, tipo_desvio: e.target.value }))} /></td>
                <td className={tdCls}><input className={inputCls} placeholder="Responsável" value={newRow.responsavel ?? ''} onChange={e => setNewRow(r => ({ ...r, responsavel: e.target.value }))} /></td>
                <td className={tdCls}><input type="date" className={inputCls} value={newRow.prazo ?? ''} onChange={e => setNewRow(r => ({ ...r, prazo: e.target.value }))} /></td>
                <td className={tdCls}>
                  <select className={inputCls} value={newRow.status ?? 'pendente'} onChange={e => setNewRow(r => ({ ...r, status: e.target.value as PMOPlanoAcao['status'] }))}>
                    {Object.entries(STATUS_ACAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className={tdCls}><input className={inputCls} placeholder="URL evidência" value={newRow.evidencia_url ?? ''} onChange={e => setNewRow(r => ({ ...r, evidencia_url: e.target.value }))} /></td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1">
                    <button onClick={handleAdd} disabled={criar.isPending} className="text-emerald-500 hover:text-emerald-600"><Check size={14} /></button>
                    <button onClick={() => setAdding(false)} className={isLight ? 'text-slate-400' : 'text-slate-500'}><X size={14} /></button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!adding && (
        <div className={`px-4 py-3 border-t ${isLight ? 'border-slate-100' : 'border-white/[0.04]'}`}>
          <button
            onClick={() => setAdding(true)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isLight ? 'text-violet-600 hover:text-violet-700' : 'text-violet-400 hover:text-violet-300'
            }`}
          >
            <Plus size={14} /> Adicionar ação
          </button>
        </div>
      )}
    </div>
  )
}
