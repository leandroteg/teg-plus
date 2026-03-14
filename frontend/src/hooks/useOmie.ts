import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyncLog {
  id: string
  dominio: string
  status: 'running' | 'success' | 'error'
  registros: number
  mensagem: string | null
  executado_em: string
  executado_por: string
}

export interface OmieConfig {
  omie_app_key: string
  omie_app_secret: string
  n8n_webhook_url: string
  omie_enabled: string
  cp_remessa_webhook_url: string
  cp_remessa_status_webhook_url: string
}

// ── useLastSync ───────────────────────────────────────────────────────────────
// Retorna o registro mais recente de fin_sync_log para o domínio informado.
// Revalida automaticamente a cada 10 segundos para refletir progresso em tempo real.

export function useLastSync(dominio: string) {
  return useQuery<SyncLog | null>({
    queryKey: ['sync-log', dominio],
    queryFn: async () => {
      const { data } = await supabase
        .from('fin_sync_log')
        .select('*')
        .eq('dominio', dominio)
        .order('executado_em', { ascending: false })
        .limit(1)
        .single()
      return data ?? null
    },
    refetchInterval: 10_000, // faz polling a cada 10s para acompanhar status 'running'
    retry: false,
  })
}

// ── useOmieConfig ─────────────────────────────────────────────────────────────
// Lê todas as linhas de sys_config e as converte em um objeto OmieConfig.
// Requer que o usuário autenticado seja administrador (RLS).

export function useOmieConfig() {
  return useQuery<OmieConfig>({
    queryKey: ['omie-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_config')
        .select('chave, valor')
      if (error) throw error
      const cfg: Record<string, string> = {}
      ;(data ?? []).forEach(row => { cfg[row.chave] = row.valor ?? '' })
      return {
        omie_app_key:    cfg['omie_app_key']    ?? '',
        omie_app_secret: cfg['omie_app_secret'] ?? '',
        n8n_webhook_url: cfg['n8n_webhook_url'] ?? '',
        omie_enabled:    cfg['omie_enabled']    ?? 'false',
        cp_remessa_webhook_url: cfg['cp_remessa_webhook_url'] ?? '',
        cp_remessa_status_webhook_url: cfg['cp_remessa_status_webhook_url'] ?? '',
      }
    },
    staleTime: 60_000, // considera os dados frescos por 1 minuto
    retry: false,
  })
}

// ── useSaveOmieConfig ─────────────────────────────────────────────────────────
// Persiste parcialmente ou totalmente as chaves de OmieConfig em sys_config.
// Usa upsert com onConflict: 'chave' para criar ou sobrescrever cada linha.

export function useSaveOmieConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (config: Partial<OmieConfig>) => {
      const updates = Object.entries(config).map(([chave, valor]) => ({
        chave,
        valor: valor ?? '',
        updated_at: new Date().toISOString(),
      }))
      for (const update of updates) {
        const { error } = await supabase
          .from('sys_config')
          .upsert(update, { onConflict: 'chave' })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['omie-config'] }),
  })
}

// ── useTriggerSync ────────────────────────────────────────────────────────────
// Dispara uma sincronização manual via webhook n8n para o domínio informado.
// dominio é passado no nível do hook; webhookUrl na mutação.

export function useTriggerSync(dominio: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ webhookUrl }: { webhookUrl: string }) => {
      const endpoint = {
        fornecedores:   '/omie/sync/fornecedores',
        contas_pagar:   '/omie/sync/contas-pagar',
        contas_receber: '/omie/sync/contas-receber',
      }[dominio]
      if (!endpoint) throw new Error('Domínio inválido: ' + dominio)

      // Registra status 'running' imediatamente para feedback visual
      await supabase.from('fin_sync_log').insert({
        dominio,
        status: 'running',
        mensagem: 'Sincronização iniciada manualmente',
        executado_por: 'manual',
      })

      const url = webhookUrl.replace(/\/$/, '') + endpoint
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'teg-frontend', dominio }),
      })
      if (!res.ok) throw new Error(`Webhook falhou: ${res.status}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-log', dominio] }),
    onError:   () => qc.invalidateQueries({ queryKey: ['sync-log', dominio] }),
  })
}

// ── useTestOmieConnection ─────────────────────────────────────────────────────

export function useTestOmieConnection() {
  return useMutation({
    mutationFn: async ({ webhookUrl }: { webhookUrl: string }) => {
      const url = webhookUrl.replace(/\/$/, '') + '/omie/test'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json().catch(() => ({ ok: true }))
    },
  })
}
