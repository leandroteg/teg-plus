import { useState, useMemo } from 'react'
import { AlertTriangle, Filter, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAlertasDesvio } from '../../hooks/useControladoria'
import { useLookupObras } from '../../hooks/useLookups'
import type { SeveridadeAlerta } from '../../types/controladoria'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtData = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const fmtPct = (v: number) =>
  v.toFixed(1) + '%'

const SEVERIDADE_BADGE: Record<SeveridadeAlerta, { label: string; light: string; dark: string; pulse?: boolean }> = {
  amarelo: { label: 'Amarelo', light: 'bg-amber-100 text-amber-700',   dark: 'bg-amber-500/15 text-amber-400' },
  vermelho: { label: 'Vermelho', light: 'bg-red-100 text-red-700',      dark: 'bg-red-500/15 text-red-400' },
  critico:  { label: 'Critico',  light: 'bg-red-100 text-red-700',      dark: 'bg-red-500/15 text-red-400', pulse: true },
}

const SEVERIDADE_OPTIONS = [
  { value: '', label: 'Todas as severidades' },
  { value: 'amarelo', label: 'Amarelo' },
  { value: 'vermelho', label: 'Vermelho' },
  { value: 'critico', label: 'Critico' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function AlertasDesvio() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [filterObra, setFilterObra] = useState('')
  const [filterSeveridade, setFilterSeveridade] = useState('')
  const [showResolvidos, setShowResolvidos] = useState(false)

  const { data: alertas = [], isLoading } = useAlertasDesvio({
    obra_id: filterObra || undefined,
    severidade: filterSeveridade || undefined,
    resolvido: showResolvidos ? undefined : false,
  })

  const filtered = alertas

  // Summary
  const totalAlertas = filtered.length
  const criticos = filtered.filter(a => a.severidade === 'critico').length
  const naoResolvidos = filtered.filter(a => !a.resolvido).length

  const summaryCards = [
    { label: 'Total Alertas', value: String(totalAlertas), icon: AlertTriangle, color: 'text-violet-500' },
    { label: 'Criticos', value: String(criticos), icon: ShieldAlert, color: 'text-red-500' },
    { label: 'Nao Resolvidos', value: String(naoResolvidos), icon: XCircle, color: 'text-amber-500' },
  ]

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
          <AlertTriangle size={20} className="text-violet-500" />
          Alertas de Desvio
        </h1>
        <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Monitoramento de desvios orcamentarios por obra
        </p>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {summaryCards.map(card => (
          <div key={card.label} className={`rounded-2xl border p-5 shadow-sm ${
            isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={16} className={card.color} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}>{card.label}</span>
            </div>
            <p className={`text-lg font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />

        <select
          value={filterObra}
          onChange={e => setFilterObra(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-slate-800 border-slate-600 text-white'
          }`}
        >
          <option value="">Todas as Obras</option>
          {obras.map(o => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>

        <select
          value={filterSeveridade}
          onChange={e => setFilterSeveridade(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-slate-800 border-slate-600 text-white'
          }`}
        >
          {SEVERIDADE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <label className={`flex items-center gap-2 text-xs cursor-pointer ${
          isLight ? 'text-slate-600' : 'text-slate-300'
        }`}>
          <input
            type="checkbox"
            checked={showResolvidos}
            onChange={e => setShowResolvidos(e.target.checked)}
            className="rounded border-slate-300"
          />
          Mostrar resolvidos
        </label>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-2xl border p-12 text-center ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <CheckCircle2 size={40} className={`mx-auto mb-3 ${isLight ? 'text-emerald-300' : 'text-emerald-600'}`} />
          <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Nenhum alerta de desvio encontrado
          </p>
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`text-[10px] font-semibold uppercase tracking-wider ${
                  isLight ? 'text-slate-400 bg-slate-50/80' : 'text-slate-500 bg-white/[0.02]'
                }`}>
                  <th className="px-4 py-3">Obra</th>
                  <th className="px-4 py-3">Mensagem</th>
                  <th className="px-4 py-3">Severidade</th>
                  <th className="px-4 py-3 text-right">Desvio %</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-center">Resolvido</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/[0.04]'}`}>
                {filtered.map(a => {
                  const badge = SEVERIDADE_BADGE[a.severidade] ?? SEVERIDADE_BADGE.amarelo
                  const obraName = a.obra?.nome ?? obras.find(o => o.id === a.obra_id)?.nome ?? '-'
                  return (
                    <tr key={a.id} className={`transition-colors ${
                      isLight ? 'hover:bg-slate-50/50' : 'hover:bg-white/[0.02]'
                    }`}>
                      <td className={`px-4 py-3 text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                        {obraName}
                      </td>
                      <td className={`px-4 py-3 text-xs max-w-[280px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {a.mensagem}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2.5 py-1 ${
                          isLight ? badge.light : badge.dark
                        } ${badge.pulse ? 'animate-pulse' : ''}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs font-semibold text-right ${
                        a.desvio_pct > 20 ? 'text-red-500' : a.desvio_pct > 10 ? 'text-amber-500' : (isLight ? 'text-slate-700' : 'text-slate-300')
                      }`}>
                        {fmtPct(a.desvio_pct)}
                      </td>
                      <td className={`px-4 py-3 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {fmtData(a.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.resolvido ? (
                          <CheckCircle2 size={16} className="mx-auto text-emerald-500" />
                        ) : (
                          <XCircle size={16} className={`mx-auto ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
                        )}
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
