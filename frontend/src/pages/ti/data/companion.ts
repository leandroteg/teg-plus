// Ponte para a Edge Function do assistente de IA (ti-assistant-search).
import { supabase } from './supabase'

export interface AssistantResult {
  answer: string
  sources: { url: string; title: string }[]
}

export async function assistantSearch(query: string): Promise<AssistantResult> {
  const { data, error } = await supabase.functions.invoke('ti-assistant-search', { body: { query } })
  if (error) {
    let msg = 'Falha ao consultar o assistente.'
    try {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const body = await (error as any).context?.json?.()
      if (body?.error) msg = body.error
      /* eslint-enable @typescript-eslint/no-explicit-any */
    } catch { /* ignore */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return { answer: data?.answer ?? '', sources: Array.isArray(data?.sources) ? data.sources : [] }
}
