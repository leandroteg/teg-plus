import type { NovaRequisicaoPayload } from '../types'

const BASE = import.meta.env.VITE_N8N_WEBHOOK_URL

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`Erro ${res.status}: ${res.statusText}`)
  return res.json()
}

export const api = {
  criarRequisicao: (data: NovaRequisicaoPayload) =>
    request('/compras/requisicao', { method: 'POST', body: JSON.stringify(data) }),

  processarAprovacao: (token: string, decisao: 'aprovada' | 'rejeitada', observacao?: string) =>
    request('/compras/aprovacao', {
      method: 'POST',
      body: JSON.stringify({ token, decisao, observacao }),
    }),

  getDashboard: (params?: { periodo?: string; obra_id?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request(`/painel/compras${qs ? `?${qs}` : ''}`)
  },
}
