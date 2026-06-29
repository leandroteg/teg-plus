// LGPD: política de retenção (config em ti_config) + trilha de auditoria
// (ti_auditoria_lgpd). A EXECUÇÃO da retenção (anonimização) é server-only e
// entra na fase de Edge Functions; aqui só config + leitura da auditoria.
import { supabase } from './supabase'

export interface RetentionConfig {
  enabled: boolean
  months: number
  eligibleNow: number
}

export interface AuditLog {
  id: string
  action: string
  actorName: string | null
  targetName: string | null
  detail: string | null
  ip: string | null
  createdAt: string
}

export async function getRetention(): Promise<RetentionConfig> {
  const { data } = await supabase
    .from('ti_config').select('chave, valor')
    .in('chave', ['retentionEnabled', 'retentionMonths'])
  const map = Object.fromEntries((data ?? []).map((r: { chave: string; valor: string }) => [r.chave, r.valor]))
  return {
    enabled: map['retentionEnabled'] === 'true',
    months: Number(map['retentionMonths']) || 24,
    eligibleNow: 0, // cálculo de elegíveis fica na fase de Edge Functions
  }
}

export async function setRetention(input: { enabled?: boolean; months?: number }): Promise<void> {
  const rows: { chave: string; valor: string }[] = []
  if (input.enabled !== undefined) rows.push({ chave: 'retentionEnabled', valor: input.enabled ? 'true' : 'false' })
  if (input.months !== undefined) rows.push({ chave: 'retentionMonths', valor: String(input.months) })
  if (!rows.length) return
  const { error } = await supabase.from('ti_config').upsert(rows, { onConflict: 'chave' })
  if (error) throw error
}

export async function listAudit(limit = 100): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('ti_auditoria_lgpd')
    .select('id, acao, ator_nome, alvo_nome, detalhe, ip, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: { id: string; acao: string; ator_nome: string | null; alvo_nome: string | null; detalhe: string | null; ip: string | null; created_at: string }) => ({
    id: r.id, action: r.acao, actorName: r.ator_nome ?? null, targetName: r.alvo_nome ?? null,
    detail: r.detalhe ?? null, ip: r.ip ?? null, createdAt: r.created_at,
  }))
}
