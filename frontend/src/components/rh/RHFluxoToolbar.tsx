// ─────────────────────────────────────────────────────────────────────────────
// components/rh/RHFluxoToolbar.tsx — Barra de busca/ordenação/visão (padrão Compras)
// Reutilizada nas telas de Admissão e Desligamento.
// ─────────────────────────────────────────────────────────────────────────────
import { Search, X, ArrowUp, ArrowDown, LayoutList, LayoutGrid } from 'lucide-react'

export type ViewMode = 'list' | 'cards'
export interface SortOption { field: string; label: string }

export default function RHFluxoToolbar({
  isDark, busca, setBusca, placeholder = 'Buscar...',
  sortOptions, sortField, setSortField, sortDir, setSortDir,
  viewMode, setViewMode, count, total,
}: {
  isDark: boolean
  busca: string
  setBusca: (v: string) => void
  placeholder?: string
  sortOptions: SortOption[]
  sortField: string
  setSortField: (f: string) => void
  sortDir: 'asc' | 'desc'
  setSortDir: (d: 'asc' | 'desc' | ((p: 'asc' | 'desc') => 'asc' | 'desc')) => void
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  count: number
  total: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        <input
          className={`w-full rounded-lg pl-9 pr-7 py-2 text-xs border transition-all outline-none ${
            isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-teal-500/30'
              : 'bg-white border-slate-200 focus:ring-2 focus:ring-teal-400/30 focus:border-teal-400'
          }`}
          placeholder={placeholder}
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
        {busca && (
          <button onClick={() => setBusca('')} className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100'}`}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Sort */}
      {sortOptions.map(o => (
        <button key={o.field}
          onClick={() => { if (sortField === o.field) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(o.field); setSortDir('desc') } }}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
            sortField === o.field
              ? isDark ? 'bg-white/10 text-white border-white/10' : 'bg-slate-100 text-slate-800 border-slate-200'
              : isDark ? 'bg-transparent text-slate-500 border-white/[0.06] hover:bg-white/5' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
          }`}>
          {o.label}
          {sortField === o.field && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
        </button>
      ))}

      {/* View toggle */}
      <div className={`flex border rounded-lg overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <button onClick={() => setViewMode('list')}
          className={`p-1.5 transition-all ${viewMode === 'list' ? isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50'}`}>
          <LayoutList size={14} />
        </button>
        <button onClick={() => setViewMode('cards')}
          className={`p-1.5 transition-all ${viewMode === 'cards' ? isDark ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-800' : isDark ? 'text-slate-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50'}`}>
          <LayoutGrid size={14} />
        </button>
      </div>

      {/* Count */}
      <div className={`ml-auto text-[11px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {count} de {total}
      </div>
    </div>
  )
}
