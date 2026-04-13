// ---------------------------------------------------------------------------
// hooks/useFrotasChecklistSync.ts -- Sync engine for frotas checklist offline
// Detects online status, syncs local data with Supabase.
// Retry with exponential backoff. Upload base64 photos to storage.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useOnlineStatus } from './useOnlineStatus'
import { dataUrlToBlob } from './useVistoriaOffline'
import {
  listPendingChecklists,
  type ChecklistOfflineData,
  type SyncStatus,
} from './useFrotasChecklistOffline'

// -- Types -------------------------------------------------------------------

interface SyncResult {
  veiculoId: string
  tipo: string
  success: boolean
  error?: string
}

// -- Constants ---------------------------------------------------------------

const MAX_RETRIES = 3
const BACKOFF_BASE = 1000 // 1s, 3s, 9s
const STORAGE_PREFIX = 'fro_checklist_offline_'

// -- Sync Logic (pure functions) ---------------------------------------------

async function syncSingleChecklist(data: ChecklistOfflineData): Promise<SyncResult> {
  const { veiculoId, tipo } = data
  try {
    let execucaoId = data.execucaoId

    // 1. Create execution if not yet created
    if (!execucaoId) {
      if (!data.templateId) {
        return { veiculoId, tipo, success: false, error: 'Template ID ausente' }
      }

      const { data: execucao, error: eErr } = await supabase
        .from('fro_checklist_execucoes')
        .insert({
          template_id: data.templateId,
          veiculo_id: veiculoId,
          status: 'em_andamento',
          observacoes_gerais: data.obsGerais || undefined,
          nivel_combustivel: data.nivelCombustivel || undefined,
          hodometro_registro: data.hodometroRegistro || undefined,
        })
        .select()
        .single()
      if (eErr || !execucao) {
        return { veiculoId, tipo, success: false, error: `Erro ao criar execucao: ${eErr?.message}` }
      }
      execucaoId = execucao.id
    }

    // 2. Save checklist items
    if (data.itens.length > 0) {
      // Delete existing items and re-insert
      await supabase.from('fro_checklist_execucao_itens').delete().eq('execucao_id', execucaoId)

      const rows = data.itens.map(it => ({
        execucao_id: execucaoId,
        template_item_id: it.templateItemId,
        conforme: it.conforme ?? undefined,
        estado: it.estado || undefined,
        observacao: it.observacao || undefined,
      }))
      const { error: iErr } = await supabase.from('fro_checklist_execucao_itens').insert(rows)
      if (iErr) {
        return { veiculoId, tipo, success: false, error: `Erro ao salvar itens: ${iErr.message}` }
      }
    }

    // 3. Upload offline photos
    for (const foto of data.fotos) {
      try {
        const blob = dataUrlToBlob(foto.dataUrl)
        const ext = foto.dataUrl.includes('image/png') ? 'png' : 'jpg'
        const path = `${execucaoId}/${foto.templateItemId}/${foto.timestamp}.${ext}`

        await supabase.storage
          .from('fro-checklist-fotos')
          .upload(path, blob, { upsert: true, contentType: blob.type })

        const { data: { publicUrl } } = supabase.storage
          .from('fro-checklist-fotos')
          .getPublicUrl(path)

        await supabase.from('fro_checklist_fotos').insert({
          execucao_id: execucaoId,
          url: publicUrl,
          descricao: foto.descricao || `${foto.templateItemId}`,
        })
      } catch {
        // Non-fatal: continue with other photos
        console.warn(`[FrotasChecklistSync] Failed to upload photo ${foto.id}`)
      }
    }

    // 4. Update execution status
    const temPendencias = data.itens.some(it => it.estado === 'ruim')
    const execStatus = data.status === 'concluida' ? 'concluido' : 'em_andamento'

    await supabase.from('fro_checklist_execucoes').update({
      status: execStatus,
      observacoes_gerais: data.obsGerais || undefined,
      tem_pendencias: temPendencias,
      nivel_combustivel: data.nivelCombustivel || undefined,
      hodometro_registro: data.hodometroRegistro || undefined,
      ...(data.status === 'concluida' ? { concluido_at: new Date().toISOString() } : {}),
    }).eq('id', execucaoId)

    // 5. Optionally update vehicle hodometro if concluded
    if (data.status === 'concluida' && data.hodometroRegistro) {
      await supabase.from('fro_veiculos').update({
        hodometro_atual: data.hodometroRegistro,
      }).eq('id', veiculoId)
    }

    // 6. Mark as synced in localStorage
    const key = `${STORAGE_PREFIX}${veiculoId}_${tipo}`
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      parsed.syncStatus = 'synced'
      parsed.execucaoId = execucaoId
      localStorage.setItem(key, JSON.stringify(parsed))
    }

    return { veiculoId, tipo, success: true }
  } catch (e) {
    return { veiculoId, tipo, success: false, error: (e as Error).message }
  }
}

async function syncWithRetry(data: ChecklistOfflineData): Promise<SyncResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const result = await syncSingleChecklist(data)
    if (result.success) return result

    // Wait with exponential backoff before retry
    if (attempt < MAX_RETRIES - 1) {
      const delay = BACKOFF_BASE * Math.pow(3, attempt)
      await new Promise(r => setTimeout(r, delay))
    } else {
      // Mark as error after final attempt
      const key = `${STORAGE_PREFIX}${data.veiculoId}_${data.tipo}`
      const stored = localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        parsed.syncStatus = 'error'
        localStorage.setItem(key, JSON.stringify(parsed))
      }
      return result
    }
  }
  return { veiculoId: data.veiculoId, tipo: data.tipo, success: false, error: 'Max retries exceeded' }
}

// -- Hook --------------------------------------------------------------------

export function useFrotasChecklistSync() {
  const isOnline = useOnlineStatus()
  const qc = useQueryClient()
  const syncingRef = useRef(false)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => listPendingChecklists().length)
  const [lastResults, setLastResults] = useState<SyncResult[]>([])

  const refreshPendingCount = useCallback(() => {
    setPendingCount(listPendingChecklists().length)
  }, [])

  const syncAll = useCallback(async () => {
    if (syncingRef.current) return []
    const pending = listPendingChecklists()
    if (pending.length === 0) return []

    syncingRef.current = true
    setSyncing(true)

    const results: SyncResult[] = []
    for (const data of pending) {
      // Update sync status to 'syncing'
      const key = `${STORAGE_PREFIX}${data.veiculoId}_${data.tipo}`
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
    qc.invalidateQueries({ queryKey: ['fro_checklist_execucoes'] })
    qc.invalidateQueries({ queryKey: ['fro_veiculos'] })

    setLastResults(results)
    refreshPendingCount()
    syncingRef.current = false
    setSyncing(false)

    return results
  }, [qc, refreshPendingCount])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && !syncingRef.current) {
      const pending = listPendingChecklists()
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
