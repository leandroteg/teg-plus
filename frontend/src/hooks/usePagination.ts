import { useState, useCallback, useMemo } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  totalCount: number
}

export interface PaginationControls extends PaginationState {
  totalPages: number
  offset: number
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setTotalCount: (count: number) => void
  setPageSize: (size: number) => void
  range: [number, number] // [from, to] for Supabase .range()
  hasNext: boolean
  hasPrev: boolean
}

/**
 * Generic pagination hook for use with Supabase queries.
 *
 * Usage:
 *   const pagination = usePagination({ pageSize: 50 })
 *
 *   // In your query:
 *   supabase.from('table')
 *     .select('*', { count: 'exact' })
 *     .range(...pagination.range)
 *     .then(({ data, count }) => {
 *       pagination.setTotalCount(count ?? 0)
 *     })
 */
export function usePagination(options?: { pageSize?: number }): PaginationControls {
  const [page, setPageState]       = useState(1)
  const [pageSize, setPageSizeState] = useState(options?.pageSize ?? 50)
  const [totalCount, setTotalCount]  = useState(0)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  )

  const offset = (page - 1) * pageSize

  const range: [number, number] = useMemo(
    () => [offset, offset + pageSize - 1],
    [offset, pageSize]
  )

  const setPage = useCallback((p: number) => {
    setPageState(Math.max(1, Math.min(p, totalPages)))
  }, [totalPages])

  const nextPage = useCallback(() => {
    setPageState(p => Math.min(p + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setPageState(p => Math.max(p - 1, 1))
  }, [])

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setPageState(1) // reset to first page on size change
  }, [])

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    offset,
    setPage,
    nextPage,
    prevPage,
    setTotalCount,
    setPageSize,
    range,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}
