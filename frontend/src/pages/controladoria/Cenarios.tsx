import { useState, useMemo } from 'react'
import { Layers, Filter, ChevronDown, ChevronRight } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useCenarios } from '../../hooks/useControladoria'
import { useLookupObras } from '../../hooks/useLookups'
import type { TipoCenario } from '../../types/controladoria'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

const TIPO_CFG: Record<TipoCenario, { label: string; bg: string; text: string }> = {
  otimista:      { label: 'Otimista',      bg: 'bg-emerald-50', text: 'text-emerald-700' },
  base:          { label: 'Base',          bg: 'bg-blue-50',    text: 'text-blue-700'    },
  conservador:   { label: 'Conservador',   bg: 'bg-amber-50',   text: 'text-amber-700'   },
  personalizado: { label: 'Personalizado', bg: 'bg-violet-50',  text: 'text-violet-700'  },
}

function summarizeJson(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj)
  if (entries.length === 0) return '(vazio)'
  return entries
    .slice(0, 5)
    .map(([k, v]) => {
      const val = typeof v === 'number'
        ? v.toLocaleString('pt-BR')
        : typeof v === 'string'
          ? v.length > 40 ? v.slice(0, 40) + '...' : v
          : JSON.stringify(v)
      return `${k}: ${val}`
    })
    .join(' | ')
    + (entries.length > 5 ? ` (+${entries.length - 5})` : '')
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Cenarios() {
  const { isLightSidebar: isLight } = useTheme()
  const obras = useLookupObras()

  const [filterObra, setFilterObra] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const { data: cenarios = [], isLoading } = useCenarios(filterObra || undefined)

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-extrabold ${isLight ? 'text-slate-800' : 'text-white'}`}>
            Cenarios
          </h1>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Simulacoes de cenarios orcamentarios por obra
          </p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/[0.06] text-slate-400'
        }`}>
          {cenarios.length} cenario{cenarios.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
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
              : 'bg-white/[0.04] border-white/[0.08] text-white'
          }`}
        >
          <option value="">Todas as Obras</option>
          {obras.map(o => (
            <option key={o.id} value={o.id}>{o.nome}</option>
          ))}
        </select>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'} text-xs font-semibold uppercase tracking-wider`}>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3">Obra</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3 text-center">Tipo</th>
                  <th className="px-4 py-3 text-right">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {cenarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={`text-center py-12 text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Layers size={32} className="mx-auto mb-2 opacity-30" />
                      Nenhum cenario encontrado
                    </td>
                  </tr>
                ) : (
                  cenarios.map(c => {
                    const expanded = expandedIds.has(c.id)
                    const cfg = TIPO_CFG[c.tipo] ?? TIPO_CFG.personalizado
                    return (
                      <>
                        <tr
                          key={c.id}
                          onClick={() => toggle(c.id)}
                          className={`border-b cursor-pointer ${
                            isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="px-4 py-3">
                            {expanded
                              ? <ChevronDown size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                              : <ChevronRight size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
                            }
                          </td>
                          <td className={`px-4 py-3 text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>
                            {c.obra?.nome ?? 'Global'}
                          </td>
                          <td className={`px-4 py-3 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                            {c.nome}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {fmtDate(c.created_at)}
                          </td>
                        </tr>

                        {/* ── Expanded detail ──────────────────── */}
                        {expanded && (
                          <tr key={`${c.id}-detail`} className={`${
                            isLight ? 'bg-slate-50/70' : 'bg-white/[0.01]'
                          }`}>
                            <td />
                            <td colSpan={4} className="px-4 py-4">
                              <div className="space-y-3">
                                <div>
                                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                                    isLight ? 'text-slate-500' : 'text-slate-500'
                                  }`}>
                                    Premissas
                                  </p>
                                  <p className={`text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                                    {summarizeJson(c.premissas)}
                                  </p>
                                </div>
                                <div>
                                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                                    isLight ? 'text-slate-500' : 'text-slate-500'
                                  }`}>
                                    Resultados
                                  </p>
                                  <p className={`text-xs font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                                    {summarizeJson(c.resultados)}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
