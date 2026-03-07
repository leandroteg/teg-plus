import { useState, useMemo, useCallback } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  from: number
  to: number
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  nextPage: () => void
  prevPage: () => void
  totalPages: number
  setTotalCount: (n: number) => void
  totalCount: number
  hasNext: boolean
  hasPrev: boolean
}

export function usePagination(initialPageSize = 50): PaginationState {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [totalCount, setTotalCount] = useState(0)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize],
  )

  const hasNext = page < totalPages
  const hasPrev = page > 1

  const nextPage = useCallback(() => {
    setPage(p => Math.min(p + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setPage(p => Math.max(p - 1, 1))
  }, [])

  const setPageSize = useCallback((s: number) => {
    setPageSizeState(s)
    setPage(1)
  }, [])

  return {
    page, pageSize, from, to,
    setPage, setPageSize, nextPage, prevPage,
    totalPages, totalCount, setTotalCount,
    hasNext, hasPrev,
  }
}
