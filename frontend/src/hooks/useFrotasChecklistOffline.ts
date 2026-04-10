// ---------------------------------------------------------------------------
// hooks/useFrotasChecklistOffline.ts -- Offline persistence for frotas checklist
// Saves complete state to localStorage (items, photos dataURL, observations).
// Auto-save with debounce. Restores on reopen.
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect, useRef } from 'react'
import { fileToDataUrl, dataUrlToBlob } from './useVistoriaOffline'
import type { EstadoItemVeiculo, NivelCombustivel } from '../types/frotas'

// Re-export shared utilities so consumers can import from one place
export { fileToDataUrl, dataUrlToBlob }

// -- Types -------------------------------------------------------------------

export interface OfflineChecklistFoto {
  id: string
  templateItemId: string
  descricao: string
  dataUrl: string
  timestamp: number
}

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error'

export interface ChecklistItemOffline {
  templateItemId: string
  descricao: string
  conforme?: boolean
  estado?: EstadoItemVeiculo
  observacao?: string
}

export interface ChecklistOfflineData {
  veiculoId: string
  tipo: string
  execucaoId: string | null
  templateId: string | null
  itens: ChecklistItemOffline[]
  obsGerais: string
  fotos: OfflineChecklistFoto[]
  nivelCombustivel?: NivelCombustivel
  hodometroRegistro?: number
  updatedAt: number
  status: 'rascunho' | 'concluida'
  syncStatus: SyncStatus
}

// -- Helpers -----------------------------------------------------------------

const STORAGE_PREFIX = 'fro_checklist_offline_'

function storageKey(veiculoId: string, tipo: string) {
  return `${STORAGE_PREFIX}${veiculoId}_${tipo}`
}

function loadFromStorage(veiculoId: string, tipo: string): ChecklistOfflineData | null {
  try {
    const raw = localStorage.getItem(storageKey(veiculoId, tipo))
    if (!raw) return null
    return JSON.parse(raw) as ChecklistOfflineData
  } catch {
    return null
  }
}

function saveToStorage(veiculoId: string, tipo: string, data: ChecklistOfflineData) {
  try {
    localStorage.setItem(storageKey(veiculoId, tipo), JSON.stringify(data))
  } catch (e) {
    // Storage full -- try clearing old synced checklists
    clearSyncedChecklists()
    try {
      localStorage.setItem(storageKey(veiculoId, tipo), JSON.stringify(data))
    } catch {
      console.error('[FrotasChecklistOffline] localStorage full, cannot save', e)
    }
  }
}

function clearFromStorage(veiculoId: string, tipo: string) {
  localStorage.removeItem(storageKey(veiculoId, tipo))
}

function clearSyncedChecklists() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
  for (const key of keys) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}') as Partial<ChecklistOfflineData>
      if (data.syncStatus === 'synced') localStorage.removeItem(key)
    } catch { /* ignore */ }
  }
}

/** List all pending (unsynced) checklists */
export function listPendingChecklists(): ChecklistOfflineData[] {
  const result: ChecklistOfflineData[] = []
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
  for (const key of keys) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}') as ChecklistOfflineData
      if (data.syncStatus === 'pending' || data.syncStatus === 'error') {
        result.push(data)
      }
    } catch { /* ignore */ }
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt)
}

// -- Hook --------------------------------------------------------------------

export function useFrotasChecklistOffline(veiculoId: string, tipo: string) {
  const [data, setData] = useState<ChecklistOfflineData>(() => {
    const saved = loadFromStorage(veiculoId, tipo)
    return saved ?? {
      veiculoId,
      tipo,
      execucaoId: null,
      templateId: null,
      itens: [],
      obsGerais: '',
      fotos: [],
      nivelCombustivel: undefined,
      hodometroRegistro: undefined,
      updatedAt: Date.now(),
      status: 'rascunho',
      syncStatus: 'idle',
    }
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const hasSavedData = loadFromStorage(veiculoId, tipo) !== null

  // Auto-save debounced (500ms)
  useEffect(() => {
    if (data.syncStatus === 'idle' && data.itens.length === 0) return // nothing to save
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const toSave: ChecklistOfflineData = {
        ...data,
        updatedAt: Date.now(),
        syncStatus: data.syncStatus === 'synced' ? 'synced' : 'pending',
      }
      saveToStorage(veiculoId, tipo, toSave)
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [data, veiculoId, tipo])

  // -- Setters ---------------------------------------------------------------

  const setExecucaoId = useCallback((id: string) => {
    setData(prev => ({ ...prev, execucaoId: id }))
  }, [])

  const setTemplateId = useCallback((id: string) => {
    setData(prev => ({ ...prev, templateId: id }))
  }, [])

  const setItens = useCallback((itens: ChecklistItemOffline[]) => {
    setData(prev => ({ ...prev, itens, syncStatus: 'pending' }))
  }, [])

  const setObsGerais = useCallback((obsGerais: string) => {
    setData(prev => ({ ...prev, obsGerais, syncStatus: 'pending' }))
  }, [])

  const setNivelCombustivel = useCallback((nivelCombustivel: NivelCombustivel) => {
    setData(prev => ({ ...prev, nivelCombustivel, syncStatus: 'pending' }))
  }, [])

  const setHodometroRegistro = useCallback((hodometroRegistro: number) => {
    setData(prev => ({ ...prev, hodometroRegistro, syncStatus: 'pending' }))
  }, [])

  const setStatus = useCallback((status: 'rascunho' | 'concluida') => {
    setData(prev => ({ ...prev, status, syncStatus: 'pending' }))
  }, [])

  const setSyncStatus = useCallback((syncStatus: SyncStatus) => {
    setData(prev => {
      const next = { ...prev, syncStatus }
      saveToStorage(veiculoId, tipo, next) // immediate save for sync status
      return next
    })
  }, [veiculoId, tipo])

  // -- Fotos -----------------------------------------------------------------

  const addFoto = useCallback(async (templateItemId: string, descricao: string, file: File) => {
    const dataUrl = await fileToDataUrl(file)
    const foto: OfflineChecklistFoto = {
      id: `foto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      templateItemId,
      descricao,
      dataUrl,
      timestamp: Date.now(),
    }
    setData(prev => ({
      ...prev,
      fotos: [...prev.fotos, foto],
      syncStatus: 'pending',
    }))
    return foto
  }, [])

  const removeFoto = useCallback((fotoId: string) => {
    setData(prev => ({
      ...prev,
      fotos: prev.fotos.filter(f => f.id !== fotoId),
      syncStatus: 'pending',
    }))
  }, [])

  // -- Lifecycle -------------------------------------------------------------

  const clear = useCallback(() => {
    clearFromStorage(veiculoId, tipo)
    setData({
      veiculoId,
      tipo,
      execucaoId: null,
      templateId: null,
      itens: [],
      obsGerais: '',
      fotos: [],
      nivelCombustivel: undefined,
      hodometroRegistro: undefined,
      updatedAt: Date.now(),
      status: 'rascunho',
      syncStatus: 'idle',
    })
  }, [veiculoId, tipo])

  const markSynced = useCallback(() => {
    setData(prev => {
      const next = { ...prev, syncStatus: 'synced' as SyncStatus }
      saveToStorage(veiculoId, tipo, next)
      return next
    })
  }, [veiculoId, tipo])

  return {
    data,
    hasSavedData,
    setExecucaoId,
    setTemplateId,
    setItens,
    setObsGerais,
    setNivelCombustivel,
    setHodometroRegistro,
    setStatus,
    setSyncStatus,
    addFoto,
    removeFoto,
    clear,
    markSynced,
  }
}
