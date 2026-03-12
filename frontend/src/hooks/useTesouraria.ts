import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  ContaBancaria, MovimentacaoTesouraria, TesourariaDashboardData,
  CategoriaMovimentacao
} from '../types/financeiro'

// ── Dashboard RPC ─────────────────────────────────────────
const EMPTY_DASHBOARD: TesourariaDashboardData = {
  saldo_total: 0, entradas_periodo: 0, saidas_periodo: 0,
  contas: [], movimentacoes_recentes: [], fluxo_diario: [],
  previsao_cp: 0, previsao_cr: 0,
  aging_cp: { hoje: 0, d7: 0, d30: 0, d60: 0 },
  aging_cr: { hoje: 0, d7: 0, d30: 0, d60: 0 },
}

export function useTesourariaDashboard(periodo = '30d') {
  return useQuery<TesourariaDashboardData>({
    queryKey: ['tesouraria-dashboard', periodo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tesouraria_dashboard', {
        p_periodo: periodo,
      })
      if (error) return EMPTY_DASHBOARD
      return data as TesourariaDashboardData
    },
    refetchInterval: 30_000,
  })
}

// ── Contas Bancarias ──────────────────────────────────────
export function useContasBancarias() {
  return useQuery<ContaBancaria[]>({
    queryKey: ['contas-bancarias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fin_contas_bancarias')
        .select('*')
        .eq('ativo', true)
        .order('saldo_atual', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCriarContaBancaria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (conta: Omit<ContaBancaria, 'id' | 'saldo_atual' | 'saldo_atualizado_em' | 'ativo'>) => {
      const { data, error } = await supabase
        .from('fin_contas_bancarias')
        .insert(conta)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
    },
  })
}

export function useEditarContaBancaria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContaBancaria> & { id: string }) => {
      const { data, error } = await supabase
        .from('fin_contas_bancarias')
        .update({ ...updates, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
    },
  })
}

// ── Movimentacoes ─────────────────────────────────────────
export function useMovimentacoes(contaId?: string, periodo = '30d') {
  return useQuery<MovimentacaoTesouraria[]>({
    queryKey: ['movimentacoes-tesouraria', contaId, periodo],
    queryFn: async () => {
      const dias = periodo === '7d' ? 7 : periodo === '60d' ? 60 : periodo === '90d' ? 90 : 30
      const dataInicio = new Date()
      dataInicio.setDate(dataInicio.getDate() - dias)

      let q = supabase
        .from('fin_movimentacoes_tesouraria')
        .select('*, conta:fin_contas_bancarias(nome, cor)')
        .gte('data_movimentacao', dataInicio.toISOString().split('T')[0])
        .order('data_movimentacao', { ascending: false })
        .limit(200)

      if (contaId) q = q.eq('conta_id', contaId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((m: any) => ({
        ...m,
        conta_nome: m.conta?.nome,
        conta_cor: m.conta?.cor,
      }))
    },
  })
}

export function useCriarMovimentacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (mov: {
      conta_id: string; tipo: 'entrada' | 'saida' | 'transferencia'
      valor: number; data_movimentacao: string; descricao?: string
      categoria?: CategoriaMovimentacao
    }) => {
      const { data, error } = await supabase
        .from('fin_movimentacoes_tesouraria')
        .insert({ ...mov, origem: 'manual' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimentacoes-tesouraria'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
    },
  })
}

// ── Import OFX/CSV ────────────────────────────────────────
export function useImportExtrato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ contaId, file }: { contaId: string; file: File }) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'ofx'
      const path = `extratos/${contaId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('notas-fiscais')
        .upload(path, file)
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage.from('notas-fiscais').getPublicUrl(path)

      const { data: importRec, error: insErr } = await supabase
        .from('fin_extratos_import')
        .insert({
          conta_id: contaId,
          arquivo_url: urlData.publicUrl,
          nome_arquivo: file.name,
          formato: ext === 'csv' ? 'csv' : 'ofx',
          status: 'processando',
        })
        .select()
        .single()
      if (insErr) throw insErr

      const BASE = import.meta.env.VITE_N8N_WEBHOOK_URL || ''
      try {
        await fetch(`${BASE}/tesouraria/import-extrato`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            import_id: importRec.id,
            conta_id: contaId,
            arquivo_url: urlData.publicUrl,
            formato: ext,
          }),
        })
      } catch { /* n8n may not be configured yet */ }

      return importRec
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movimentacoes-tesouraria'] })
      qc.invalidateQueries({ queryKey: ['tesouraria-dashboard'] })
      qc.invalidateQueries({ queryKey: ['contas-bancarias'] })
    },
  })
}
