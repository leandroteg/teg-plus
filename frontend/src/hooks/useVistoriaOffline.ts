// ─────────────────────────────────────────────────────────────────────────────
// hooks/useVistoriaOffline.ts — Persistência offline para vistorias de imóveis
// Salva estado completo no localStorage (itens, fotos dataURL, observações).
// Auto-save com debounce. Restaura ao reabrir.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ChecklistItem } from '../components/locacao/VistoriaChecklist'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OfflineFoto {
  id: string
  ambiente: string
  item: string
  dataUrl: string
  timestamp: number
}

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'synced' | 'error'

export interface VistoriaOfflineData {
  entradaId: string
  vistoriaId: string | null
  itens: ChecklistItem[]
  obsGerais: string
  fotos: OfflineFoto[]
  updatedAt: number
  status: 'rascunho' | 'concluida'
  syncStatus: SyncStatus
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'vistoria_offline_'

function storageKey(entradaId: string) {
  return `${STORAGE_PREFIX}${entradaId}`
}

function loadFromStorage(entradaId: string): VistoriaOfflineData | null {
  try {
    const raw = localStorage.getItem(storageKey(entradaId))
    if (!raw) return null
    return JSON.parse(raw) as VistoriaOfflineData
  } catch {
    return null
  }
}

function saveToStorage(entradaId: string, data: VistoriaOfflineData) {
  try {
    localStorage.setItem(storageKey(entradaId), JSON.stringify(data))
  } catch (e) {
    // Storage full — try clearing old synced vistorias
    clearSyncedVistorias()
    try {
      localStorage.setItem(storageKey(entradaId), JSON.stringify(data))
    } catch {
      console.error('[VistoriaOffline] localStorage full, cannot save', e)
    }
  }
}

function clearFromStorage(entradaId: string) {
  localStorage.removeItem(storageKey(entradaId))
}

function clearSyncedVistorias() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
  for (const key of keys) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}') as Partial<VistoriaOfflineData>
      if (data.syncStatus === 'synced') localStorage.removeItem(key)
    } catch { /* ignore */ }
  }
}

/** List all pending (unsynced) vistorias */
export function listPendingVistorias(): VistoriaOfflineData[] {
  const result: VistoriaOfflineData[] = []
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
  for (const key of keys) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '{}') as VistoriaOfflineData
      if (data.syncStatus === 'pending' || data.syncStatus === 'error') {
        result.push(data)
      }
    } catch { /* ignore */ }
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** Convert a File to base64 dataURL */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Convert a base64 dataURL back to a Blob for upload */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVistoriaOffline(entradaId: string) {
  const [data, setData] = useState<VistoriaOfflineData>(() => {
    const saved = loadFromStorage(entradaId)
    return saved ?? {
      entradaId,
      vistoriaId: null,
      itens: [],
      obsGerais: '',
      fotos: [],
      updatedAt: Date.now(),
      status: 'rascunho',
      syncStatus: 'idle',
    }
  })

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const hasSavedData = loadFromStorage(entradaId) !== null

  // Auto-save debounced (500ms)
  useEffect(() => {
    if (data.syncStatus === 'idle' && data.itens.length === 0) return // nothing to save
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const toSave: VistoriaOfflineData = {
        ...data,
        updatedAt: Date.now(),
        syncStatus: data.syncStatus === 'synced' ? 'synced' : 'pending',
      }
      saveToStorage(entradaId, toSave)
    }, 500)
    return () => clearTimeout(debounceRef.current)
  }, [data, entradaId])

  // ── Setters ────────────────────────────────────────────────────────────────

  const setVistoriaId = useCallback((id: string) => {
    setData(prev => ({ ...prev, vistoriaId: id }))
  }, [])

  const setItens = useCallback((itens: ChecklistItem[]) => {
    setData(prev => ({ ...prev, itens, syncStatus: 'pending' }))
  }, [])

  const setObsGerais = useCallback((obsGerais: string) => {
    setData(prev => ({ ...prev, obsGerais, syncStatus: 'pending' }))
  }, [])

  const setStatus = useCallback((status: 'rascunho' | 'concluida') => {
    setData(prev => ({ ...prev, status, syncStatus: 'pending' }))
  }, [])

  const setSyncStatus = useCallback((syncStatus: SyncStatus) => {
    setData(prev => {
      const next = { ...prev, syncStatus }
      saveToStorage(entradaId, next) // immediate save for sync status
      return next
    })
  }, [entradaId])

  // ── Fotos ──────────────────────────────────────────────────────────────────

  const addFoto = useCallback(async (ambiente: string, item: string, file: File) => {
    const dataUrl = await fileToDataUrl(file)
    const foto: OfflineFoto = {
      id: `foto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ambiente,
      item,
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

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  const clear = useCallback(() => {
    clearFromStorage(entradaId)
    setData({
      entradaId,
      vistoriaId: null,
      itens: [],
      obsGerais: '',
      fotos: [],
      updatedAt: Date.now(),
      status: 'rascunho',
      syncStatus: 'idle',
    })
  }, [entradaId])

  const markSynced = useCallback(() => {
    setData(prev => {
      const next = { ...prev, syncStatus: 'synced' as SyncStatus }
      saveToStorage(entradaId, next)
      return next
    })
  }, [entradaId])

  return {
    data,
    hasSavedData,
    setVistoriaId,
    setItens,
    setObsGerais,
    setStatus,
    setSyncStatus,
    addFoto,
    removeFoto,
    clear,
    markSynced,
  }
}
