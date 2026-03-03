import { useState } from 'react'
import {
  Landmark, Search, Calendar, CheckCircle2,
  Clock, ArrowLeftRight, Upload, Download,
  FileSpreadsheet, AlertTriangle, Link2,
} from 'lucide-react'
import { useContasPagar } from '../../hooks/useFinanceiro'

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const fmtData = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

type Tab = 'remessa' | 'retorno' | 'conciliacao'

export default function Conciliacao() {
  const [tab, setTab] = useState<Tab>('remessa')
  const { data: contas = [], isLoading } = useContasPagar()

  const emRemessa = contas.filter(cp => cp.status === 'em_remessa')
  const pagos = contas.filter(cp => cp.status === 'pago')
  const conciliados = contas.filter(cp => cp.status === 'conciliado')

  const tabs: { key: Tab; label: string; icon: typeof Landmark }[] = [
    { key: 'remessa',      label: 'Remessa',      icon: Upload       },
    { key: 'retorno',      label: 'Retorno',       icon: Download     },
    { key: 'conciliacao',  label: 'Conciliação',  icon: Link2        },
  ]

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <Landmark size={20} className="text-emerald-600" />
          Conciliação Bancária
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">Remessa, retorno e conciliação de pagamentos</p>
      </div>

      {/* ── KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Upload size={14} className="text-cyan-500" />
            <p className="text-[10px] text-cyan-500 font-semibold uppercase tracking-widest">Em Remessa</p>
          </div>
          <p className="text-xl font-extrabold text-slate-800">{emRemessa.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {fmt(emRemessa.reduce((s, cp) => s + cp.valor_original, 0))}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Download size={14} className="text-indigo-500" />
            <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-widest">Pagos</p>
          </div>
          <p className="text-xl font-extrabold text-slate-800">{pagos.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {fmt(pagos.reduce((s, cp) => s + cp.valor_pago, 0))}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-widest">Conciliados</p>
          </div>
          <p className="text-xl font-extrabold text-slate-800">{conciliados.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {fmt(conciliados.reduce((s, cp) => s + cp.valor_pago, 0))}
          </p>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-1.5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-semibold transition-all
              ${tab === t.key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200'
              }`}>
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'remessa' ? (
        <div className="space-y-4">
          {/* Upload area */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center
            hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer group">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3
              group-hover:bg-emerald-100 transition-colors">
              <FileSpreadsheet size={24} className="text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-slate-700">Gerar Remessa CNAB</p>
            <p className="text-xs text-slate-400 mt-1">
              Selecione os títulos aprovados para gerar o arquivo de remessa bancária
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[11px] font-semibold">
                CNAB 240
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-semibold">
                CNAB 400
              </span>
            </div>
          </div>

          {/* Títulos aprovados para remessa */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Títulos Aprovados para Remessa ({contas.filter(cp => cp.status === 'aprovado_pgto').length})
            </p>
            {contas.filter(cp => cp.status === 'aprovado_pgto').length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center">
                <p className="text-xs text-slate-400">Nenhum título aprovado pendente de remessa</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contas.filter(cp => cp.status === 'aprovado_pgto').map(cp => (
                  <div key={cp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4
                    flex items-center gap-3 hover:shadow-md transition-all">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-600
                      focus:ring-emerald-500 focus:ring-offset-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{cp.fornecedor_nome}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{cp.numero_documento}</span>
                        <span>Venc. {fmtData(cp.data_vencimento)}</span>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold text-slate-800">{fmt(cp.valor_original)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Em remessa list */}
          {emRemessa.length > 0 && (
            <div>
              <p className="text-xs font-bold text-cyan-500 uppercase tracking-wider mb-2">
                Em Remessa ({emRemessa.length})
              </p>
              <div className="space-y-2">
                {emRemessa.map(cp => (
                  <div key={cp.id} className="bg-cyan-50/50 rounded-2xl border border-cyan-200 p-4
                    flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                      <ArrowLeftRight size={14} className="text-cyan-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{cp.fornecedor_nome}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {cp.numero_documento} · Venc. {fmtData(cp.data_vencimento)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-cyan-600 font-semibold">
                      <Clock size={10} />
                      Processando
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : tab === 'retorno' ? (
        <div className="space-y-4">
          {/* Upload retorno */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center
            hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3
              group-hover:bg-indigo-100 transition-colors">
              <Download size={24} className="text-indigo-500" />
            </div>
            <p className="text-sm font-bold text-slate-700">Importar Arquivo de Retorno</p>
            <p className="text-xs text-slate-400 mt-1">
              Faça upload do arquivo de retorno bancário para dar baixa automática
            </p>
            <p className="text-[10px] text-slate-400 mt-3">
              Formatos: CNAB 240, CNAB 400, OFX
            </p>
          </div>

          {/* Pagos aguardando conciliação */}
          <div>
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
              Pagos — Aguardando Conciliação ({pagos.length})
            </p>
            {pagos.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-6 text-center">
                <p className="text-xs text-slate-400">Nenhum pagamento pendente de conciliação</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pagos.map(cp => (
                  <div key={cp.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4
                    flex items-center gap-3 hover:shadow-md transition-all">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{cp.fornecedor_nome}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {cp.numero_documento} · Pago em {cp.data_pagamento ? fmtData(cp.data_pagamento) : '—'}
                      </p>
                    </div>
                    <p className="text-sm font-extrabold text-indigo-600">{fmt(cp.valor_pago)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Conciliação summary */}
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Link2 size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-800">Status da Conciliação</p>
                <p className="text-xs text-emerald-600">Extrato vs. Contas no Sistema</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-emerald-700">{conciliados.length}</p>
                <p className="text-[10px] text-emerald-500 font-medium">Conciliados</p>
              </div>
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-amber-600">{pagos.length}</p>
                <p className="text-[10px] text-amber-500 font-medium">Pendentes</p>
              </div>
              <div className="bg-white/70 rounded-xl p-3 text-center">
                <p className="text-lg font-extrabold text-slate-700">
                  {conciliados.length + pagos.length > 0
                    ? Math.round((conciliados.length / (conciliados.length + pagos.length)) * 100)
                    : 0}%
                </p>
                <p className="text-[10px] text-slate-500 font-medium">Taxa</p>
              </div>
            </div>
          </div>

          {/* Upload extrato */}
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center
            hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer group">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Upload size={16} className="text-emerald-500" />
              <p className="text-sm font-bold text-slate-700">Importar Extrato Bancário</p>
            </div>
            <p className="text-xs text-slate-400">OFX, CSV ou Open Banking</p>
          </div>

          {/* Conciliados list */}
          {conciliados.length > 0 && (
            <div>
              <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">
                Conciliados ({conciliados.length})
              </p>
              <div className="space-y-2">
                {conciliados.map(cp => (
                  <div key={cp.id} className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4
                    flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{cp.fornecedor_nome}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{cp.numero_documento}</p>
                    </div>
                    <p className="text-sm font-extrabold text-emerald-600">{fmt(cp.valor_pago)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
