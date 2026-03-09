import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users, Filter } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useHistograma, usePortfolio } from '../../hooks/usePMO'
import type { CategoriaHistograma } from '../../types/pmo'

const CAT_MAP: Record<CategoriaHistograma, { label: string; light: string; dark: string }> = {
  mod:        { label: 'MOD',        light: 'bg-blue-100 text-blue-700',      dark: 'bg-blue-500/15 text-blue-400' },
  moi:        { label: 'MOI',        light: 'bg-violet-100 text-violet-700',  dark: 'bg-violet-500/15 text-violet-400' },
  maquinario: { label: 'Maquinario', light: 'bg-amber-100 text-amber-700',    dark: 'bg-amber-500/15 text-amber-400' },
}

const CAT_OPTIONS = [
  { value: '', label: 'Todas categorias' },
  { value: 'mod', label: 'MOD' },
  { value: 'moi', label: 'MOI' },
  { value: 'maquinario', label: 'Maquinario' },
]

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })

export default function Histograma() {
  const { isLightSidebar: isLight } = useTheme()
  const { portfolioId } = useParams<{ portfolioId: string }>()
  const nav = useNavigate()
  const [catFilter, setCatFilter] = useState('')

  const { data: portfolio } = usePortfolio(portfolioId)
  const { data: items, isLoading } = useHistograma(portfolioId)

  const filtered = (items ?? []).filter(
    i => !catFilter || i.categoria === catFilter
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back */}
      <button onClick={() => nav(portfolioId ? `/pmo/portfolio/${portfolioId}` : '/pmo')}
        className={`flex items-center gap-1 text-sm transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
        }`}>
        <ArrowLeft size={14} /> Voltar
      </button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
            <Users size={20} className="text-teal-500" />
            Histograma de Recursos
          </h1>
          {portfolio && (
            <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {portfolio.nome_obra} - {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
          isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/[0.06]'
        }`}>
          <Filter size={14} className={isLight ? 'text-slate-400' : 'text-slate-500'} />
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className={`bg-transparent text-sm outline-none ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
          >
            {CAT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className={`rounded-2xl border overflow-hidden ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/[0.03] border-white/[0.06]'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.02] text-slate-400'}>
                <th className="text-left font-semibold px-4 py-3">Categoria</th>
                <th className="text-left font-semibold px-4 py-3">Funcao</th>
                <th className="text-left font-semibold px-4 py-3">Semana</th>
                <th className="text-right font-semibold px-4 py-3">Planejado</th>
                <th className="text-right font-semibold px-4 py-3">Real</th>
                <th className="text-left font-semibold px-4 py-3 w-28">Variacao</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`text-center py-12 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : (
                filtered.map(h => {
                  const cat = CAT_MAP[h.categoria]
                  const diff = h.quantidade_real - h.quantidade_planejada
                  const over = diff > 0
                  const under = diff < 0
                  return (
                    <tr key={h.id} className={`border-t transition-colors ${
                      isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/[0.04] hover:bg-white/[0.02]'
                    }`}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ${isLight ? cat.light : cat.dark}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {h.funcao}
                      </td>
                      <td className={`px-4 py-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {h.semana ?? h.mes ?? '-'}
                      </td>
                      <td className={`px-4 py-3 text-right ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {fmt(h.quantidade_planejada)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {fmt(h.quantidade_real)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold ${
                          over
                            ? (isLight ? 'text-red-600' : 'text-red-400')
                            : under
                              ? (isLight ? 'text-amber-600' : 'text-amber-400')
                              : (isLight ? 'text-emerald-600' : 'text-emerald-400')
                        }`}>
                          {diff > 0 ? '+' : ''}{fmt(diff)}
                          {over && ' (acima)'}
                          {under && ' (abaixo)'}
                          {!over && !under && ' (ok)'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
