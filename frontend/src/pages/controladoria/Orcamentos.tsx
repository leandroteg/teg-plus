import { useState, useMemo } from 'react'
import { BarChart3, Filter, Search } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useOrcamentos } from '../../hooks/useControladoria'
import { useLookupObras } from '../../hooks/useLookups'
import type { StatusOrcamento } from '../../types/controladoria'

// ── Helpers ───────────────────────────────────────────────────────────────────
const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const pct = (v: number) => v.toFixed(1) + '%'

const STATUS_CFG: Record<StatusOrcamento, { label: string; bg: string; text: string }> = {
  rascunho: { label: 'Rascunho', bg: 'bg-slate-100', text: 'text-slate-600' },
  aprovado: { label: 'Aprovado', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  revisado: { label: 'Revisado', bg: 'bg-amber-50', text: 'text-amber-700' },
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Orcamentos() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [filterObra, setFilterObra] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const { data: orcamentos = [], isLoading } = useOrcamentos({
    obra_id: filterObra || undefined,
    status: filterStatus || undefined,
  })

  const filtered = useMemo(() => {
    if (!search) return orcamentos
    const term = search.toLowerCase()
    return orcamentos.filter(o =>
      (o.obra?.nome ?? '').toLowerCase().includes(term) ||
      String(o.ano).includes(term)
    )
  }, [orcamentos, search])

  // Totals
  const totals = useMemo(() => ({
    valor_contrato: filtered.reduce((s, o) => s + o.valor_contrato, 0),
    valor_mao_obra: filtered.reduce((s, o) => s + o.valor_mao_obra, 0),
    valor_materiais: filtered.reduce((s, o) => s + o.valor_materiais, 0),
    margem_alvo: filtered.length > 0
      ? filtered.reduce((s, o) => s + o.margem_alvo, 0) / filtered.length
      : 0,
  }), [filtered])

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Orcamentos
          </h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Orcamentos anuais por obra com detalhamento de custos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-slate-400'
          }`}>
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl border ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />

        <div className="relative">
          <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          }`} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`pl-8 pr-3 py-1.5 rounded-lg text-xs border ${
              isLight
                ? 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
                : 'bg-slate-800 border-slate-600 text-white placeholder:text-slate-400'
            }`}
          />
        </div>

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
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className={`px-3 py-1.5 rounded-lg text-xs border ${
            isLight
              ? 'bg-white border-slate-200 text-slate-700'
              : 'bg-slate-800 border-slate-600 text-white'
          }`}
        >
          <option value="">Todos os Status</option>
          <option value="rascunho">Rascunho</option>
          <option value="aprovado">Aprovado</option>
          <option value="revisado">Revisado</option>
        </select>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'} text-xs font-semibold uppercase tracking-wider`}>
                  <th className="px-4 py-3">Obra</th>
                  <th className="px-4 py-3 text-center">Ano</th>
                  <th className="px-4 py-3 text-right">Vl. Contrato</th>
                  <th className="px-4 py-3 text-right">Mao de Obra</th>
                  <th className="px-4 py-3 text-right">Materiais</th>
                  <th className="px-4 py-3 text-right">Margem Alvo</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={`text-center py-12 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
                      Nenhum orcamento encontrado
                    </td>
                  </tr>
                ) : (
                  <>
                    {filtered.map(o => {
                      const cfg = STATUS_CFG[o.status] ?? STATUS_CFG.rascunho
                      return (
                        <tr
                          key={o.id}
                          className={`border-b ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'}`}
                        >
                          <td className={`px-4 py-3 text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>
                            {o.obra?.nome ?? '—'}
                          </td>
                          <td className={`px-4 py-3 text-sm text-center font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {o.ano}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {BRL(o.valor_contrato)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {BRL(o.valor_mao_obra)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {BRL(o.valor_materiais)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-semibold ${
                            o.margem_alvo >= 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            {pct(o.margem_alvo)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}

                    {/* ── Totals row ──────────────────────────────── */}
                    <tr className={`font-bold ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
                      <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-700' : 'text-white'}`}>
                        TOTAL ({filtered.length})
                      </td>
                      <td />
                      <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-700' : 'text-white'}`}>
                        {BRL(totals.valor_contrato)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-700' : 'text-white'}`}>
                        {BRL(totals.valor_mao_obra)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-700' : 'text-white'}`}>
                        {BRL(totals.valor_materiais)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${
                        totals.margem_alvo >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {pct(totals.margem_alvo)}
                      </td>
                      <td />
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
