// Canal WhatsApp — controle/status pela tabela singleton ti_whatsapp (id=1).
// O worker on-prem ESCREVE status/qr/numero/heartbeat; o painel admin LÊ e envia
// comandos (connect/disconnect/test) que o worker consome. RLS: select atendente/
// admin, update admin.
import { supabase } from './supabase'

export type WaStatus = 'disconnected' | 'initializing' | 'qr' | 'ready' | 'auth_failure'

export interface WhatsappState {
  status: WaStatus
  qr: string | null
  numero: string | null
  workerVistoEm: string | null
}

export async function getWhatsappState(): Promise<WhatsappState> {
  const { data, error } = await supabase
    .from('ti_whatsapp')
    .select('status, qr, numero, worker_visto_em')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw error
  return {
    status: (data?.status as WaStatus) ?? 'disconnected',
    qr: data?.qr ?? null,
    numero: data?.numero ?? null,
    workerVistoEm: data?.worker_visto_em ?? null,
  }
}

export async function sendWhatsappCommand(
  comando: 'connect' | 'disconnect' | 'test',
  payload?: { to: string; text?: string },
): Promise<void> {
  const { error } = await supabase
    .from('ti_whatsapp')
    .update({ comando, comando_payload: payload ?? null, comando_em: new Date().toISOString() })
    .eq('id', 1)
  if (error) throw error
}
