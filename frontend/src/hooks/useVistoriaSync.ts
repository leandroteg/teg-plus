// ─────────────────────────────────────────────────────────────────────────────
// hooks/useVistoriaSync.ts — Sync engine para vistorias offline
// Detecta volta online, sincroniza dados locais com Supabase.
// Retry com backoff exponencial. Upload de fotos base64 → storage.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useOnlineStatus } from './useOnlineStatus'
import {
  listPendingVistorias,
  dataUrlToBlob,
  type VistoriaOfflineData,
  type SyncStatus,
} from './useVistoriaOffline'
import type { StatusEntrada } from '../types/locacao'

// ── Types ────────────────────────────────────────────────────────────────────

interface SyncResult {
  entradaId: string
  success: boolean
  error?: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3
const BACKOFF_BASE = 1000 // 1s, 3s, 9s
const STORAGE_PREFIX = 'vistoria_offline_'

// ── Sync Logic (pure functions) ──────────────────────────────────────────────

async function syncSingleVistoria(data: VistoriaOfflineData): Promise<SyncResult> {
  const { entradaId } = data
  try {
    let vistoriaId = data.vistoriaId

    // 1. Create vistoria if not yet created
    if (!vistoriaId) {
      // Need imovel_id from entrada
      const { data: entrada, error: entradaErr } = await supabase
        .from('loc_entradas')
        .select('imovel_id')
        .eq('id', entradaId)
        .single()
      if (entradaErr || !entrada?.imovel_id) {
        return { entradaId, success: false, error: 'Entrada não encontrada ou sem imóvel vinculado' }
      }

      const { data: vistoria, error: vErr } = await supabase
        .from('loc_vistorias')
        .insert({
          imovel_id: entrada.imovel_id,
          tipo: 'entrada',
          entrada_id: entradaId,
          status: 'pendente',
        })
        .select()
        .single()
      if (vErr || !vistoria) {
        return { entradaId, success: false, error: `Erro ao criar vistoria: ${vErr?.message}` }
      }
      vistoriaId = vistoria.id
    }

    // 2. Save checklist items
    if (data.itens.length > 0) {
      // Delete existing items and re-insert
      await supabase.from('loc_vistoria_itens').delete().eq('vistoria_id', vistoriaId)

      const rows = data.itens.map((it, i) => ({
        vistoria_id: vistoriaId,
        ambiente: it.ambiente,
        item: it.item,
        estado_entrada: it.estado || undefined,
        observacao: it.observacao || undefined,
        ordem: i,
      }))
      const { error: iErr } = await supabase.from('loc_vistoria_itens').insert(rows)
      if (iErr) {
        return { entradaId, success: false, error: `Erro ao salvar itens: ${iErr.message}` }
      }
    }

    // 3. Upload offline photos
    for (const foto of data.fotos) {
      try {
        const blob = dataUrlToBlob(foto.dataUrl)
        const ext = foto.dataUrl.includes('image/png') ? 'png' : 'jpg'
        const path = `${vistoriaId}/${foto.ambiente}/${foto.timestamp}.${ext}`

        await supabase.storage
          .from('vistoria-fotos')
          .upload(path, blob, { upsert: true, contentType: blob.type })

        const { data: { publicUrl } } = supabase.storage
          .from('vistoria-fotos')
          .getPublicUrl(path)

        await supabase.from('loc_vistoria_fotos').insert({
          vistoria_id: vistoriaId,
          url: publicUrl,
          descricao: `${foto.ambiente}|${foto.item}`,
          tipo: 'entrada',
        })
      } catch {
        // Non-fatal: continue with other photos
        console.warn(`[VistoriaSync] Failed to upload photo ${foto.id}`)
      }
    }

    // 4. Update vistoria status
    const temPendencias = data.itens.some(it => it.estado === 'ruim')
    const vistoriaStatus = data.status === 'concluida' ? 'concluida' : 'em_andamento'

    await supabase.from('loc_vistorias').update({
      status: vistoriaStatus,
      observacoes_gerais: data.obsGerais || undefined,
      tem_pendencias: temPendencias,
      data_vistoria: new Date().toISOString().split('T')[0],
    }).eq('id', vistoriaId)

    // 5. Advance entrada status if vistoria is concluded
    if (data.status === 'concluida') {
      await supabase.from('loc_entradas').update({
        status: 'aguardando_assinatura' as StatusEntrada,
        updated_at: new Date().toISOString(),
      }).eq('id', entradaId)
    }

    // 6. Mark as synced in localStorage
    const key = `${STORAGE_PREFIX}${entradaId}`
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      parsed.syncStatus = 'synced'
      parsed.vistoriaId = vistoriaId
      localStorage.setItem(key, JSON.stringify(parsed))
    }

    return { entradaId, success: true }
  } catch (e) {
    return { entradaId, success: false, error: (e as Error).message }
  }
}

async function syncWithRetry(data: VistoriaOfflineData): Promise<SyncResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await syncSingleVistoria(data)
    if (result.success) return result

    // Wait with exponential backoff before retry
    if (attempt < MAX_RETRIES - 1) {
      const delay = BACKOFF_BASE * Math.pow(3, attempt)
      await new Promise(r => setTimeout(r, delay))
    } else {
      // Mark as error after final attempt
      const key = `${STORAGE_PREFIX}${data.entradaId}`
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.syncStatus = 'error'
        localStorage.setItem(key, JSON.stringify(parsed))
      }
      return result
    }
  }
  return { entradaId: data.entradaId, success: false, error: 'Max retries exceeded' }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVistoriaSync() {
  const isOnline = useOnlineStatus()
  const qc = useQueryClient()
  const syncingRef = useRef(false)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => listPendingVistorias().length)
  const [lastResults, setLastResults] = useState<SyncResult[]>([])

  const refreshPendingCount = useCallback(() => {
    setPendingCount(listPendingVistorias().length)
  }, [])

  const syncAll = useCallback(async () => {
    if (syncingRef.current) return []
    const pending = listPendingVistorias()
    if (pending.length === 0) return []

    syncingRef.current = true
    setSyncing(true)

    const results: SyncResult[] = []
    for (const data of pending) {
      // Update sync status to 'syncing'
      const key = `${STORAGE_PREFIX}${data.entradaId}`
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.syncStatus = 'syncing'
        localStorage.setItem(key, JSON.stringify(parsed))
      }

      const result = await syncWithRetry(data)
      results.push(result)
    }

    // Invalidate queries to refresh data
    qc.invalidateQueries({ queryKey: ['loc_entradas'] })
    qc.invalidateQueries({ queryKey: ['loc_vistorias'] })
    qc.invalidateQueries({ queryKey: ['loc_vistoria_fotos'] })

    setLastResults(results)
    refreshPendingCount()
    syncingRef.current = false
    setSyncing(false)

    return results
  }, [qc, refreshPendingCount])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && !syncingRef.current) {
      const pending = listPendingVistorias()
      if (pending.length > 0) {
        syncAll()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // Refresh count periodically
  useEffect(() => {
    refreshPendingCount()
    const interval = setInterval(refreshPendingCount, 5000)
    return () => clearInterval(interval)
  }, [refreshPendingCount])

  return {
    isOnline,
    syncing,
    pendingCount,
    lastResults,
    syncAll,
    refreshPendingCount,
  }
}
