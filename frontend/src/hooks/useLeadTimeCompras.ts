import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

// =============================================================================
// useLeadTimeCompras — Lead time do pipeline de compras por categoria e por fase
// Fases medidas (em dias):
//   1. Requisição → Aprovação   (cmp_requisicoes.created_at → data_aprovacao)
//   2. Aprovação → Cotação      (data_aprovacao → cmp_cotacoes.data_conclusao)
//   3. Cotação → Pedido         (data_conclusao → cmp_pedidos.data_pedido)
//   4. Pedido → Entrega         (data_pedido → cmp_pedidos.data_entrega_real)
//   Lead total                  (requisição → entrega)
// Agrupado por cmp_requisicoes.categoria (nome via cmp_categorias).
// Join feito no cliente (volume baixo) para evitar ambiguidade de embedding.
// =============================================================================

export interface LeadTimeCategoria {
  categoria: string
  nome: string
  total: number
  comAprovacao: number
  comPedido: number
  comEntrega: number
  reqAprov: number | null
  aprovCotacao: number | null
  cotacaoPedido: number | null
  pedidoEntrega: number | null
  leadTotal: number | null
}

export interface LeadTimeCompras {
  categorias: LeadTimeCategoria[]
  geral: {
    totalReq: number
    concluidas: number
    leadMedio: number | null
    noPrazoPct: number | null
  }
}

const DAY = 86_400_000

function diffDays(later?: string | null, earlier?: string | null): number | null {
  if (!later || !earlier) return null
  const a = new Date(later).getTime()
  const b = new Date(earlier).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  const d = Math.round((a - b) / DAY)
  return d >= 0 ? d : null // ignora datas inconsistentes (negativas)
}

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  if (!nums.length) return null
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10
}

interface ReqRow { id: string; categoria: string | null; status: string; created_at: string; data_aprovacao: string | null }
interface CotRow { requisicao_id: string | null; data_conclusao: string | null }
interface PedRow { requisicao_id: string | null; data_pedido: string | null; data_prevista_entrega: string | null; data_entrega_real: string | null }

export function useLeadTimeCompras() {
  return useQuery<LeadTimeCompras>({
    queryKey: ['lead-time-compras'],
    queryFn: async () => {
      const [reqRes, cotRes, pedRes, catRes] = await Promise.all([
        supabase.from('cmp_requisicoes').select('id, categoria, status, created_at, data_aprovacao'),
        supabase.from('cmp_cotacoes').select('requisicao_id, data_conclusao').not('requisicao_id', 'is', null),
        supabase.from('cmp_pedidos').select('requisicao_id, data_pedido, data_prevista_entrega, data_entrega_real').not('requisicao_id', 'is', null),
        supabase.from('cmp_categorias').select('codigo, nome'),
      ])
      if (reqRes.error) throw reqRes.error

      const reqs = (reqRes.data ?? []) as ReqRow[]
      const cots = (cotRes.data ?? []) as CotRow[]
      const peds = (pedRes.data ?? []) as PedRow[]

      const nomeByCod = new Map<string, string>()
      ;(catRes.data ?? []).forEach((c: { codigo: string; nome: string }) => nomeByCod.set(c.codigo, c.nome))

      // Cotação concluída mais antiga por requisição
      const cotByReq = new Map<string, string>() // requisicao_id → menor data_conclusao
      for (const c of cots) {
        if (!c.requisicao_id || !c.data_conclusao) continue
        const cur = cotByReq.get(c.requisicao_id)
        if (!cur || c.data_conclusao < cur) cotByReq.set(c.requisicao_id, c.data_conclusao)
      }

      // Pedido mais antigo por requisição (com sua entrega/prazo)
      const pedByReq = new Map<string, PedRow>()
      for (const p of peds) {
        if (!p.requisicao_id || !p.data_pedido) continue
        const cur = pedByReq.get(p.requisicao_id)
        if (!cur || (cur.data_pedido && p.data_pedido < cur.data_pedido)) pedByReq.set(p.requisicao_id, p)
      }

      interface Calc {
        categoria: string
        reqAprov: number | null
        aprovCotacao: number | null
        cotacaoPedido: number | null
        pedidoEntrega: number | null
        leadTotal: number | null
        temAprov: boolean
        temPedido: boolean
        temEntrega: boolean
        noPrazo: boolean | null
      }

      const calcs: Calc[] = reqs.map(r => {
        const categoria = r.categoria?.trim() || '(sem categoria)'
        const cotConcl = cotByReq.get(r.id) ?? null
        const ped = pedByReq.get(r.id) ?? null

        return {
          categoria,
          reqAprov: diffDays(r.data_aprovacao, r.created_at),
          aprovCotacao: diffDays(cotConcl, r.data_aprovacao),
          cotacaoPedido: diffDays(ped?.data_pedido, cotConcl ?? r.data_aprovacao),
          pedidoEntrega: diffDays(ped?.data_entrega_real, ped?.data_pedido),
          leadTotal: diffDays(ped?.data_entrega_real, r.created_at),
          temAprov: r.data_aprovacao != null,
          temPedido: ped != null,
          temEntrega: ped?.data_entrega_real != null,
          noPrazo: ped?.data_entrega_real && ped?.data_prevista_entrega
            ? new Date(ped.data_entrega_real).getTime() <= new Date(ped.data_prevista_entrega).getTime()
            : null,
        }
      })

      const byCat = new Map<string, Calc[]>()
      for (const c of calcs) {
        if (!byCat.has(c.categoria)) byCat.set(c.categoria, [])
        byCat.get(c.categoria)!.push(c)
      }

      const categorias: LeadTimeCategoria[] = [...byCat.entries()]
        .map(([categoria, list]) => ({
          categoria,
          nome: nomeByCod.get(categoria) || categoria,
          total: list.length,
          comAprovacao: list.filter(c => c.temAprov).length,
          comPedido: list.filter(c => c.temPedido).length,
          comEntrega: list.filter(c => c.temEntrega).length,
          reqAprov: avg(list.map(c => c.reqAprov)),
          aprovCotacao: avg(list.map(c => c.aprovCotacao)),
          cotacaoPedido: avg(list.map(c => c.cotacaoPedido)),
          pedidoEntrega: avg(list.map(c => c.pedidoEntrega)),
          leadTotal: avg(list.map(c => c.leadTotal)),
        }))
        .sort((a, b) => b.total - a.total)

      const noPrazoVals = calcs.map(c => c.noPrazo).filter((v): v is boolean => v != null)

      return {
        categorias,
        geral: {
          totalReq: calcs.length,
          concluidas: calcs.filter(c => c.temEntrega).length,
          leadMedio: avg(calcs.map(c => c.leadTotal)),
          noPrazoPct: noPrazoVals.length
            ? Math.round((noPrazoVals.filter(Boolean).length / noPrazoVals.length) * 100)
            : null,
        },
      }
    },
    staleTime: 60_000,
  })
}
