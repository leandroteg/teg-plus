import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { PaginationControls } from '../hooks/usePagination'

interface Props {
  pagination: PaginationControls
  /** Show total count label. Defaults to true */
  showTotal?: boolean
}

/**
 * Reusable pagination UI component.
 *
 * Usage:
 *   <Pagination pagination={pagination} />
 */
export default function Pagination({ pagination, showTotal = true }: Props) {
  const { page, totalPages, totalCount, hasPrev, hasNext, setPage, prevPage, nextPage } = pagination

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      {showTotal && (
        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {totalCount.toLocaleString('pt-BR')} registro{totalCount !== 1 ? 's' : ''}
        </p>
      )}

      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          onClick={() => setPage(1)}
          disabled={!hasPrev}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Primeira página"
        >
          <ChevronsLeft size={14} />
        </button>

        {/* Previous */}
        <button
          onClick={prevPage}
          disabled={!hasPrev}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Anterior"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Page indicator */}
        <span className="px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums">
          {page} / {totalPages}
        </span>

        {/* Next */}
        <button
          onClick={nextPage}
          disabled={!hasNext}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Próxima"
        >
          <ChevronRight size={14} />
        </button>

        {/* Last page */}
        <button
          onClick={() => setPage(totalPages)}
          disabled={!hasNext}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Última página"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  )
}
