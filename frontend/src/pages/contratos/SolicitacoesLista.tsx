import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileSignature, Search, Plus, Eye,
  ClipboardList, FileEdit, FileBarChart, ShieldCheck,
  Send, Archive, Unlock,
} from 'lucide-react'
import { useSolicitacoes, useSolicitacoesDashboard } from '../../hooks/useSolicitacoes'
import type { EtapaSolicitacao, StatusSolicitacao, Solicitacao } from '../../types/contratos'

// ── Etapa visual config ──────────────────────────────────────────────────────

interface EtapaConfig {
  label: string
  icon: typeof ClipboardList
  border: string
  bg: string
  text: string
  dot: string
  pill: string
  pillText: string
}

const ETAPA_CONFIG: Record<string, EtapaConfig> = {
  solicitacao:         { label: 'Solicitacao',       icon: ClipboardList, border: 'border-l-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    pill: 'bg-blue-50',    pillText: 'text-blue-700' },
  preparar_minuta:     { label: 'Preparar Minuta',   icon: FileEdit,      border: 'border-l-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   pill: 'bg-amber-50',   pillText: 'text-amber-700' },
  resumo_executivo:    { label: 'Resumo Executivo',  icon: FileBarChart,  border: 'border-l-purple-500',  bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500',  pill: 'bg-purple-50',  pillText: 'text-purple-700' },
  aprovacao_diretoria: { label: 'Aprov. Diretoria',  icon: ShieldCheck,   border: 'border-l-orange-500',  bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500',  pill: 'bg-orange-50',  pillText: 'text-orange-700' },
  enviar_assinatura:   { label: 'Enviar Assinatura', icon: Send,          border: 'border-l-cyan-500',    bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    pill: 'bg-cyan-50',    pillText: 'text-cyan-700' },
  arquivar:            { label: 'Arquivar',          icon: Archive,       border: 'border-l-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', pill: 'bg-emerald-50', pillText: 'text-emerald-700' },
  liberar_execucao:    { label: 'Liberar Execucao',  icon: Unlock,        border: 'border-l-green-500',   bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500',   pill: 'bg-green-50',   pillText: 'text-green-700' },
  concluido:           { label: 'Concluido',         icon: ShieldCheck,   border: 'border-l-teal-500',    bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-500',    pill: 'bg-teal-50',    pillText: 'text-teal-700' },
  cancelado:           { label: 'Cancelado',         icon: ClipboardList, border: 'border-l-red-500',     bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',     pill: 'bg-red-50',     pillText: 'text-red-700' },
}

const CARD_ETAPAS: EtapaSolicitacao[] = [
  'solicitacao', 'preparar_minuta', 'resumo_executivo',
  'aprovacao_diretoria', 'enviar_assinatura', 'arquivar', 'liberar_execucao',
]

const STATUS_OPTIONS: { value: StatusSolicitacao | ''; label: string }[] = [
  { value: '',                     label: 'Todos os Status' },
  { value: 'rascunho',             label: 'Rascunho' },
  { value: 'em_andamento',         label: 'Em Andamento' },
  { value: 'aguardando_aprovacao', label: 'Aguardando Aprovacao' },
  { value: 'aprovado',             label: 'Aprovado' },
  { value: 'rejeitado',            label: 'Rejeitado' },
  { value: 'cancelado',            label: 'Cancelado' },
  { value: 'concluido',            label: 'Concluido' },
]

const ETAPA_OPTIONS: { value: EtapaSolicitacao | ''; label: string }[] = [
  { value: '', label: 'Todas as Etapas' },
  ...Object.entries(ETAPA_CONFIG).map(([key, cfg]) => ({
    value: key as EtapaSolicitacao,
    label: cfg.label,
  })),
]

const URGENCIA_CONFIG: Record<string, { dot: string; label: string }> = {
  critica: { dot: 'bg-red-500',    label: 'Critica' },
  alta:    { dot: 'bg-orange-500', label: 'Alta' },
  normal:  { dot: 'bg-slate-400',  label: 'Normal' },
  baixa:   { dot: 'bg-green-500',  label: 'Baixa' },
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

// ── Main Component ───────────────────────────────────────────────────────────

export default function SolicitacoesLista() {
  const nav = useNavigate()
  const [etapaFilter, setEtapaFilter] = useState<EtapaSolicitacao | ''>('')
  const [statusFilter, setStatusFilter] = useState<StatusSolicitacao | ''>('')
  const [busca, setBusca] = useState('')

  const { data: dashboard = {}, isLoading: loadingDash } = useSolicitacoesDashboard()
  const { data: solicitacoes = [], isLoading } = useSolicitacoes({
    ...(etapaFilter ? { etapa_atual: etapaFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  })

  const filtered = useMemo(() => {
    if (!busca.trim()) return solicitacoes
    const term = busca.toLowerCase()
    return solicitacoes.filter(s =>
      s.numero?.toLowerCase().includes(term)
      || s.objeto?.toLowerCase().includes(term)
      || s.contraparte_nome?.toLowerCase().includes(term)
    )
  }, [solicitacoes, busca])

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <FileSignature size={20} className="text-indigo-600" />
            Solicitacoes de Contrato
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Fluxo de 7 etapas — da solicitacao a liberacao de execucao
          </p>
        </div>
        <button
          onClick={() => nav('/contratos/solicitacoes/nova')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white
            text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
        >
          <Plus size={14} />
          Nova Solicitacao
        </button>
      </div>

      {/* ── Etapa Cards (7) ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {CARD_ETAPAS.map(etapa => {
          const cfg = ETAPA_CONFIG[etapa]
          const Icon = cfg.icon
          const count = dashboard[etapa] ?? 0
          const isActive = etapaFilter === etapa
          return (
            <button
              key={etapa}
              onClick={() => setEtapaFilter(isActive ? '' : etapa)}
              className={`relative bg-white rounded-2xl border-l-[3px] border border-slate-200
                shadow-sm p-3 hover:shadow-md hover:-translate-y-0.5 transition-all text-left
                ${cfg.border} ${isActive ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${cfg.bg}`}>
                <Icon size={13} className={cfg.text} />
              </div>
              <p className="text-lg font-extrabold text-slate-800 leading-none">
                {loadingDash ? '-' : count}
              </p>
              <p className="text-[9px] font-semibold text-slate-400 mt-1 uppercase tracking-wider leading-tight">
                {cfg.label}
              </p>
            </button>
          )
        })}
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar numero, objeto ou contraparte..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white
              text-sm text-slate-700 placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
        <select
          value={etapaFilter}
          onChange={e => setEtapaFilter(e.target.value as EtapaSolicitacao | '')}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
            focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        >
          {ETAPA_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusSolicitacao | '')}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700
            focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ── Table / Empty / Loading ───────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <FileSignature size={28} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhuma solicitacao encontrada</p>
          <p className="text-xs text-slate-400 mt-1">
            {busca || etapaFilter || statusFilter
              ? 'Tente ajustar os filtros de busca'
              : 'Crie uma nova solicitacao para iniciar o fluxo'}
          </p>
          {!busca && !etapaFilter && !statusFilter && (
            <button
              onClick={() => nav('/contratos/solicitacoes/nova')}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold
                hover:bg-indigo-700 transition-all"
            >
              Criar Solicitacao
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Numero
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Contraparte
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden lg:table-cell">
                    Objeto
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Etapa
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Urgencia
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:table-cell">
                    Valor
                  </th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:table-cell">
                    Data
                  </th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => (
                  <SolicitacaoRow
                    key={s.id}
                    solicitacao={s}
                    onNavigate={() => nav(`/contratos/solicitacoes/${s.id}`)}
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

// ── Row Component ────────────────────────────────────────────────────────────

function SolicitacaoRow({
  solicitacao: s,
  onNavigate,
}: {
  solicitacao: Solicitacao
  onNavigate: () => void
}) {
  const etapa = ETAPA_CONFIG[s.etapa_atual] ?? ETAPA_CONFIG.solicitacao
  const urgencia = URGENCIA_CONFIG[s.urgencia] ?? URGENCIA_CONFIG.normal

  return (
    <tr
      onClick={onNavigate}
      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
    >
      <td className="px-4 py-3">
        <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 rounded-md px-2 py-0.5">
          {s.numero || '-'}
        </span>
      </td>

      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-700 truncate max-w-[180px]">
          {s.contraparte_nome}
        </p>
        {s.obra?.nome && (
          <p className="text-[10px] text-slate-400 truncate">{s.obra.nome}</p>
        )}
      </td>

      <td className="px-4 py-3 hidden lg:table-cell">
        <p className="text-xs text-slate-500 truncate max-w-[240px]">{s.objeto}</p>
      </td>

      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-semibold rounded-full
            px-2.5 py-1 ${etapa.pill} ${etapa.pillText}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${etapa.dot}`} />
          {etapa.label}
        </span>
      </td>

      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${urgencia.dot}`} />
          <span className="text-[10px] font-medium text-slate-500">{urgencia.label}</span>
        </div>
      </td>

      <td className="px-4 py-3 text-right hidden sm:table-cell">
        <span className="text-xs font-bold text-slate-700">
          {s.valor_estimado ? fmt(s.valor_estimado) : '-'}
        </span>
      </td>

      <td className="px-4 py-3 text-right hidden md:table-cell">
        <span className="text-[11px] text-slate-400">{fmtData(s.created_at)}</span>
      </td>

      <td className="px-4 py-3 text-center">
        <button
          onClick={e => { e.stopPropagation(); onNavigate() }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px]
            font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100
            hover:bg-indigo-100 transition-all"
        >
          <Eye size={11} />
          Ver
        </button>
      </td>
    </tr>
  )
}
