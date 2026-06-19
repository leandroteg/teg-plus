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
  leadGeral: number | null  // inclui RCs em aberto (hoje − criação)
}

export interface LeadTimeCompras {
  categorias: LeadTimeCategoria[]
  geral: {
    totalReq: number
    concluidas: number
    leadMedio: number | null       // entregues: entrega − criação
    leadMedioGeral: number | null  // inclui RCs em aberto: hoje − criação
    noPrazoPct: number | null
  }
}

const DAY = 86_400_000

function diffDays(later?: string | null, earlier?: string | null): number | null {
  if (!later || !earlier) return null
  const a = new Date(later).getTime()
  const b = new Date(earlier).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  const d = Math.round((a - b) / DAY * 10) / 10 // dias com 1 casa (mostra ciclos < 1 dia, ex.: 0,7d)
  return d >= 0 ? d : null // ignora datas inconsistentes (negativas)
}

// Datas "só dia" (entrega) viram fim do dia, p/ ciclos no mesmo dia não zerarem.
function fimDoDia(d?: string | null): string | null {
  if (!d) return null
  const s = String(d)
  return s.length === 10 ? `${s}T23:59:59` : s
}

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  if (!nums.length) return null
  return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10
}

interface ReqRow { id: string; categoria: string | null; status: string; created_at: string; data_aprovacao: string | null; obra_id: string | null }
interface CotRow { requisicao_id: string | null; data_conclusao: string | null }
interface PedRow { requisicao_id: string | null; data_pedido: string | null; data_prevista_entrega: string | null; data_entrega_real: string | null }

export function useLeadTimeCompras(opts?: { de?: string; ate?: string; obraId?: string }) {
  const { de, ate, obraId } = opts ?? {}
  return useQuery<LeadTimeCompras>({
    queryKey: ['lead-time-compras', de, ate, obraId],
    queryFn: async () => {
      const [reqRes, cotRes, pedRes, catRes] = await Promise.all([
        supabase.from('cmp_requisicoes').select('id, categoria, status, created_at, data_aprovacao, obra_id'),
        supabase.from('cmp_cotacoes').select('requisicao_id, data_conclusao').not('requisicao_id', 'is', null),
        supabase.from('cmp_pedidos').select('requisicao_id, data_pedido, data_prevista_entrega, data_entrega_real').not('requisicao_id', 'is', null),
        supabase.from('cmp_categorias').select('codigo, nome'),
      ])
      if (reqRes.error) throw reqRes.error

      const ini = de ? new Date(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, 1).getTime() : -Infinity
      const fim = ate ? new Date(Number(ate.slice(0, 4)), Number(ate.slice(5, 7)), 0, 23, 59, 59).getTime() : Infinity
      const reqs = ((reqRes.data ?? []) as ReqRow[]).filter(r => {
        if (obraId && r.obra_id !== obraId) return false
        if (!r.created_at) return false
        const t = new Date(r.created_at).getTime()
        return t >= ini && t <= fim
      })
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
        geralLead: number | null
        temAprov: boolean
        temPedido: boolean
        temEntrega: boolean
        noPrazo: boolean | null
      }

      const agoraISO = new Date().toISOString()
      const FECHADO = new Set(['rascunho', 'cancelada', 'rejeitada'])

      const calcs: Calc[] = reqs.map(r => {
        const categoria = r.categoria?.trim() || '(sem categoria)'
        const cotConcl = cotByReq.get(r.id) ?? null
        const ped = pedByReq.get(r.id) ?? null
        const temEnt = ped?.data_entrega_real != null
        const leadTotal = diffDays(fimDoDia(ped?.data_entrega_real), r.created_at)

        return {
          categoria,
          reqAprov: diffDays(r.data_aprovacao, r.created_at),
          aprovCotacao: diffDays(cotConcl, r.data_aprovacao),
          cotacaoPedido: diffDays(ped?.data_pedido, cotConcl ?? r.data_aprovacao),
          pedidoEntrega: diffDays(fimDoDia(ped?.data_entrega_real), ped?.data_pedido),
          leadTotal,
          // geral: entregue → lead real; em aberto (status ativo, sem entrega) → idade até hoje
          geralLead: temEnt ? leadTotal : (FECHADO.has(r.status) ? null : diffDays(agoraISO, r.created_at)),
          temAprov: r.data_aprovacao != null,
          temPedido: ped != null,
          temEntrega: temEnt,
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
          leadGeral: avg(list.map(c => c.geralLead)),
        }))
        .sort((a, b) => b.total - a.total)

      const noPrazoVals = calcs.map(c => c.noPrazo).filter((v): v is boolean => v != null)

      return {
        categorias,
        geral: {
          totalReq: calcs.length,
          concluidas: calcs.filter(c => c.temEntrega).length,
          leadMedio: avg(calcs.map(c => c.leadTotal)),
          leadMedioGeral: avg(calcs.map(c => c.geralLead)),
          noPrazoPct: noPrazoVals.length
            ? Math.round((noPrazoVals.filter(Boolean).length / noPrazoVals.length) * 100)
            : null,
        },
      }
    },
    staleTime: 60_000,
  })
}
