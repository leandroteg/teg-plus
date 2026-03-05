import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Search, Plus, Calendar,
  TrendingUp, TrendingDown, Building2,
  ChevronDown, ChevronUp, CalendarDays,
} from 'lucide-react'
import { useContratos } from '../../hooks/useContratos'
import type { Contrato } from '../../types/contratos'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  em_negociacao: { label: 'Em Negociação', dot: 'bg-yellow-400',  bg: 'bg-yellow-50',  text: 'text-yellow-700'  },
  assinado:      { label: 'Assinado',      dot: 'bg-blue-400',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  vigente:       { label: 'Vigente',        dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  suspenso:      { label: 'Suspenso',       dot: 'bg-orange-400',  bg: 'bg-orange-50',   text: 'text-orange-700'  },
  encerrado:     { label: 'Encerrado',      dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-600'   },
  rescindido:    { label: 'Rescindido',     dot: 'bg-red-400',     bg: 'bg-red-50',      text: 'text-red-600'     },
}

const FILTROS_STATUS = [
  { label: 'Todos',          value: '' },
  { label: 'Vigentes',       value: 'vigente' },
  { label: 'Assinados',      value: 'assinado' },
  { label: 'Em Negociação',  value: 'em_negociacao' },
  { label: 'Encerrados',     value: 'encerrado' },
]

const FILTROS_TIPO = [
  { label: 'Todos',    value: '' },
  { label: 'Receita',  value: 'receita' },
  { label: 'Despesa',  value: 'despesa' },
]

function ContratoCard({ contrato }: { contrato: Contrato }) {
  const nav = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[contrato.status]
  const isDespesa = contrato.tipo_contrato === 'despesa'
  const contraparte = isDespesa
    ? contrato.fornecedor?.razao_social ?? contrato.fornecedor?.nome_fantasia
    : contrato.cliente?.nome
  const diasRestantes = Math.ceil(
    (new Date(contrato.data_fim_previsto).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all hover:shadow-md ${
      contrato.status === 'vigente' ? 'border-emerald-200' : 'border-slate-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDespesa ? 'bg-amber-50' : 'bg-emerald-50'
          }`}>
            {isDespesa
              ? <TrendingDown size={16} className="text-amber-600" />
              : <TrendingUp size={16} className="text-emerald-600" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-bold text-slate-800 truncate">{contraparte ?? 'N/D'}</p>
              <p className={`text-sm font-extrabold shrink-0 ${isDespesa ? 'text-amber-600' : 'text-emerald-600'}`}>
                {fmt(contrato.valor_total + contrato.valor_aditivos)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className={`inline-flex items-center gap-1 rounded-full font-semibold px-2 py-0.5 ${cfg?.bg} ${cfg?.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg?.dot}`} />
                {cfg?.label ?? contrato.status}
              </span>
              <span className="bg-slate-100 text-slate-600 font-mono font-semibold rounded-full px-2 py-0.5">
                {contrato.numero}
              </span>
              <span className={`font-semibold rounded-full px-2 py-0.5 ${
                isDespesa ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {isDespesa ? 'A Pagar' : 'A Receber'}
              </span>
            </div>

            {contrato.objeto && (
              <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-1">{contrato.objeto}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {fmtData(contrato.data_inicio)} — {fmtData(contrato.data_fim_previsto)}
              </span>
              {contrato.obra?.nome && (
                <span className="flex items-center gap-1 text-slate-500">
                  <Building2 size={9} /> {contrato.obra.nome}
                </span>
              )}
              {contrato.status === 'vigente' && diasRestantes > 0 && (
                <span className={`font-medium ${diasRestantes < 30 ? 'text-red-500' : diasRestantes < 90 ? 'text-amber-500' : 'text-slate-500'}`}>
                  {diasRestantes} dias restantes
                </span>
              )}
              {contrato.recorrencia !== 'personalizado' && (
                <span className="flex items-center gap-1 text-indigo-500 font-medium">
                  <CalendarDays size={9} /> {contrato.recorrencia}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setExpanded(v => !v)}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => nav(`/contratos/parcelas?contrato=${contrato.id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl
              bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-600
              hover:bg-indigo-100 transition-all"
          >
            <CalendarDays size={11} />
            Ver Parcelas
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalhes</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div><span className="text-slate-400">Valor:</span> <span className="font-semibold text-slate-700">{fmt(contrato.valor_total)}</span></div>
              {contrato.valor_aditivos > 0 && (
                <div><span className="text-slate-400">Aditivos:</span> <span className="font-semibold text-blue-600">{fmt(contrato.valor_aditivos)}</span></div>
              )}
              {contrato.valor_medido > 0 && (
                <div><span className="text-slate-400">Medido:</span> <span className="font-semibold text-emerald-600">{fmt(contrato.valor_medido)}</span></div>
              )}
              {contrato.centro_custo && (
                <div><span className="text-slate-400">CC:</span> <span className="font-semibold text-slate-700">{contrato.centro_custo}</span></div>
              )}
              {contrato.classe_financeira && (
                <div><span className="text-slate-400">Classe:</span> <span className="font-semibold text-violet-600">{contrato.classe_financeira}</span></div>
              )}
              {contrato.indice_reajuste && (
                <div><span className="text-slate-400">Reajuste:</span> <span className="font-semibold text-slate-700">{contrato.indice_reajuste}</span></div>
              )}
              {contrato.garantia_tipo && (
                <div><span className="text-slate-400">Garantia:</span> <span className="font-semibold text-slate-700">{contrato.garantia_tipo}</span></div>
              )}
              {contrato.cliente?.cnpj && (
                <div><span className="text-slate-400">CNPJ:</span> <span className="font-mono text-slate-600">{contrato.cliente.cnpj}</span></div>
              )}
              {contrato.fornecedor?.cnpj && (
                <div><span className="text-slate-400">CNPJ Forn.:</span> <span className="font-mono text-slate-600">{contrato.fornecedor.cnpj}</span></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ListaContratos() {
  const nav = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [busca, setBusca] = useState('')

  const { data: contratos = [], isLoading } = useContratos(
    (statusFilter || tipoFilter) ? {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(tipoFilter ? { tipo_contrato: tipoFilter } : {}),
    } : undefined
  )

  const filtered = contratos.filter(c =>
    !busca
    || c.numero.toLowerCase().includes(busca.toLowerCase())
    || c.objeto?.toLowerCase().includes(busca.toLowerCase())
    || c.cliente?.nome.toLowerCase().includes(busca.toLowerCase())
    || c.fornecedor?.razao_social?.toLowerCase().includes(busca.toLowerCase())
  )

  const totalReceita = filtered
    .filter(c => c.tipo_contrato === 'receita')
    .reduce((s, c) => s + c.valor_total + c.valor_aditivos, 0)
  const totalDespesa = filtered
    .filter(c => c.tipo_contrato === 'despesa')
    .reduce((s, c) => s + c.valor_total + c.valor_aditivos, 0)

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" />
            Contratos
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Gestão de contratos a pagar e a receber</p>
        </div>
        <button
          onClick={() => nav('/contratos/novo')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white
            text-xs font-bold hover:bg-indigo-700 transition-all shadow-sm"
        >
          <Plus size={14} />
          Novo Contrato
        </button>
      </div>

      {/* ── Resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Total</p>
          <p className="text-lg font-extrabold text-slate-800 mt-1">{filtered.length}</p>
          <p className="text-[10px] text-slate-400">contratos</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Receita</p>
          <p className="text-lg font-extrabold text-emerald-600 mt-1">{fmt(totalReceita)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-widest">Despesa</p>
          <p className="text-lg font-extrabold text-amber-600 mt-1">{fmt(totalDespesa)}</p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar número, objeto, contraparte..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white
              text-sm text-slate-700 placeholder-slate-400 focus:outline-none
              focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {FILTROS_STATUS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
                ${statusFilter === f.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200'
                }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {FILTROS_TIPO.map(f => (
            <button key={f.value} onClick={() => setTipoFilter(f.value)}
              className={`px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all
                ${tipoFilter === f.value
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200'
                }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lista ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Nenhum contrato encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Crie um novo contrato para começar</p>
          <button
            onClick={() => nav('/contratos/novo')}
            className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all"
          >
            Criar Contrato
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => <ContratoCard key={c.id} contrato={c} />)}
        </div>
      )}
    </div>
  )
}
