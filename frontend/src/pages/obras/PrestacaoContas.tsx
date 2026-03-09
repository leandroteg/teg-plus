import { useState } from 'react'
import { Receipt, Filter } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { usePrestacaoContas } from '../../hooks/useObras'
import { useLookupObras } from '../../hooks/useLookups'
import type { CategoriaPrestacao, StatusPrestacao, FormaPagamentoPrestacao } from '../../types/obras'

// ── Helpers ──────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const STATUS_CONFIG: Record<StatusPrestacao, { label: string; light: string; dark: string }> = {
  pendente:   { label: 'Pendente',    light: 'bg-amber-100 text-amber-700',     dark: 'bg-amber-500/15 text-amber-300' },
  em_analise: { label: 'Em Analise',  light: 'bg-blue-100 text-blue-700',       dark: 'bg-blue-500/15 text-blue-300' },
  aprovada:   { label: 'Aprovada',    light: 'bg-emerald-100 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
  rejeitada:  { label: 'Rejeitada',   light: 'bg-red-100 text-red-700',         dark: 'bg-red-500/15 text-red-300' },
  compensada: { label: 'Compensada',  light: 'bg-slate-100 text-slate-600',     dark: 'bg-slate-500/15 text-slate-400' },
}

const CATEGORIA_CONFIG: Record<CategoriaPrestacao, { label: string; light: string; dark: string }> = {
  combustivel:             { label: 'Combustivel',       light: 'bg-orange-100 text-orange-700', dark: 'bg-orange-500/15 text-orange-300' },
  alimentacao:             { label: 'Alimentacao',       light: 'bg-green-100 text-green-700',   dark: 'bg-green-500/15 text-green-300' },
  hospedagem:              { label: 'Hospedagem',        light: 'bg-indigo-100 text-indigo-700', dark: 'bg-indigo-500/15 text-indigo-300' },
  transporte:              { label: 'Transporte',        light: 'bg-sky-100 text-sky-700',       dark: 'bg-sky-500/15 text-sky-300' },
  material_consumo:        { label: 'Mat. Consumo',      light: 'bg-teal-100 text-teal-700',     dark: 'bg-teal-500/15 text-teal-300' },
  manutencao_emergencial:  { label: 'Manut. Emerg.',     light: 'bg-red-100 text-red-700',       dark: 'bg-red-500/15 text-red-300' },
  servico_terceiro:        { label: 'Serv. Terceiro',    light: 'bg-purple-100 text-purple-700', dark: 'bg-purple-500/15 text-purple-300' },
  locacao_equipamento:     { label: 'Locacao Equip.',    light: 'bg-amber-100 text-amber-700',   dark: 'bg-amber-500/15 text-amber-300' },
  telefonia_internet:      { label: 'Tel./Internet',     light: 'bg-cyan-100 text-cyan-700',     dark: 'bg-cyan-500/15 text-cyan-300' },
  outro:                   { label: 'Outro',             light: 'bg-slate-100 text-slate-600',   dark: 'bg-slate-500/15 text-slate-400' },
}

const FORMA_PAG_LABEL: Record<FormaPagamentoPrestacao, string> = {
  dinheiro:           'Dinheiro',
  cartao_corporativo: 'Cartao Corp.',
  pix:                'PIX',
  transferencia:      'Transferencia',
  adiantamento:       'Adiantamento',
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PrestacaoContas() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [obraFilter, setObraFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: prestacoes = [], isLoading } = usePrestacaoContas({
    obra_id: obraFilter || undefined,
    status: statusFilter || undefined,
  })

  // Summary by status
  const totalPendente = prestacoes
    .filter(p => p.status === 'pendente' || p.status === 'em_analise')
    .reduce((s, p) => s + p.valor, 0)
  const totalAprovada = prestacoes
    .filter(p => p.status === 'aprovada')
    .reduce((s, p) => s + p.valor, 0)
  const totalRejeitada = prestacoes
    .filter(p => p.status === 'rejeitada')
    .reduce((s, p) => s + p.valor, 0)
  const totalGeral = prestacoes.reduce((s, p) => s + p.valor, 0)

  const selectClass = `px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${isLight
    ? 'border border-slate-200 bg-white text-slate-600'
    : 'bg-white/[0.06] border border-white/[0.1] text-slate-300 [&>option]:bg-slate-900'
  }`

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <Receipt size={20} className={isLight ? 'text-rose-600' : 'text-rose-400'} />
          Prestacao de Contas
        </h1>
        <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {prestacoes.length} registros
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Geral', val: BRL(totalGeral), accent: 'slate' },
          { label: 'Pendente / Em Analise', val: BRL(totalPendente), accent: 'amber' },
          { label: 'Aprovadas', val: BRL(totalAprovada), accent: 'emerald' },
          { label: 'Rejeitadas', val: BRL(totalRejeitada), accent: 'red' },
        ].map(card => (
          <div
            key={card.label}
            className={`rounded-2xl border p-4 border-l-4 ${isLight
              ? `bg-white border-slate-200 shadow-sm border-l-${card.accent}-500`
              : `bg-white/[0.03] border-white/[0.06] border-l-${card.accent}-500`
            }`}
          >
            <p className={`text-[10px] uppercase tracking-wider mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {card.label}
            </p>
            <p className={`text-lg font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {card.val}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
        <select value={obraFilter} onChange={e => setObraFilter(e.target.value)} className={selectClass}>
          <option value="">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className={`w-8 h-8 border-[3px] rounded-full animate-spin ${isLight
            ? 'border-teal-500 border-t-transparent'
            : 'border-teal-400 border-t-transparent'
          }`} />
        </div>
      ) : prestacoes.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${isLight
          ? 'bg-white border-slate-200'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Receipt size={40} className={`mx-auto mb-3 ${isLight ? 'text-slate-200' : 'text-slate-700'}`} />
          <p className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Nenhuma prestacao de contas encontrada
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`${isLight
                  ? 'bg-slate-50 text-slate-600'
                  : 'bg-white/[0.02] text-slate-400'
                } text-xs font-semibold uppercase tracking-wider`}>
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Obra</th>
                  <th className="text-center px-4 py-3">Categoria</th>
                  <th className="text-left px-4 py-3">Descricao</th>
                  <th className="text-right px-4 py-3">Valor</th>
                  <th className="text-left px-4 py-3">Pagamento</th>
                  <th className="text-left px-4 py-3">Fornecedor</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {prestacoes.map(p => {
                  const st = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pendente
                  const cat = CATEGORIA_CONFIG[p.categoria] ?? CATEGORIA_CONFIG.outro
                  return (
                    <tr
                      key={p.id}
                      className={`border-b ${isLight
                        ? 'border-slate-100 hover:bg-slate-50'
                        : 'border-white/[0.04] hover:bg-white/[0.02]'
                      } transition-colors`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {fmtDate(p.data_gasto)}
                      </td>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {p.obra?.nome ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? cat.light : cat.dark}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm max-w-[180px] truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {p.descricao}
                      </td>
                      <td className={`px-4 py-3 text-sm font-bold text-right ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {BRL(p.valor)}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {FORMA_PAG_LABEL[p.forma_pagamento] ?? p.forma_pagamento}
                      </td>
                      <td className={`px-4 py-3 text-sm max-w-[140px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {p.fornecedor_nome ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isLight ? st.light : st.dark}`}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
