import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { usePortfolios, usePortfolio } from '../hooks/usePMO'
import type { PMOPortfolio } from '../types/pmo'

const STORAGE_KEY = 'egp_selected_portfolio'

interface EGPContractCtx {
  portfolioId: string | undefined
  portfolio: PMOPortfolio | null | undefined
  portfolios: PMOPortfolio[]
  setPortfolioId: (id: string) => void
  isLoading: boolean
}

const Ctx = createContext<EGPContractCtx>({
  portfolioId: undefined,
  portfolio: undefined,
  portfolios: [],
  setPortfolioId: () => {},
  isLoading: false,
})

export function EGPContractProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || undefined } catch { return undefined }
  })

  const { data: portfolios = [], isLoading: loadingList } = usePortfolios()
  const { data: portfolio, isLoading: loadingOne } = usePortfolio(selectedId)

  // Auto-select first portfolio if none saved
  useEffect(() => {
    if (!selectedId && portfolios.length > 0) {
      const active = portfolios.find(p => !['cancelada', 'obra_concluida'].includes(p.status))
      if (active) {
        setSelectedId(active.id)
        try { localStorage.setItem(STORAGE_KEY, active.id) } catch {}
      }
    }
  }, [selectedId, portfolios])

  const setPortfolioId = useCallback((id: string) => {
    setSelectedId(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }, [])

  return (
    <Ctx.Provider value={{
      portfolioId: selectedId,
      portfolio: portfolio ?? null,
      portfolios,
      setPortfolioId,
      isLoading: loadingList || loadingOne,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useEGPContract() {
  return useContext(Ctx)
}

/**
 * Hook que retorna o portfolioId ativo.
 * Prioridade: URL params > context (seletor persistente).
 * Se vier da URL, sincroniza com o context.
 */
export function useEGPPortfolioId(): string | undefined {
  const params = useParams<{ portfolioId?: string }>()
  const { portfolioId: ctxId, setPortfolioId } = useEGPContract()

  // Se URL tem portfolioId, sincroniza com context
  useEffect(() => {
    if (params.portfolioId && params.portfolioId !== ctxId) {
      setPortfolioId(params.portfolioId)
    }
  }, [params.portfolioId, ctxId, setPortfolioId])

  return params.portfolioId || ctxId
}
