import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

// =============================================================================
// useLeadTimeCompras — Lead time do pipeline de compras por categoria e por fase
// 5 etapas (em dias), pelos marcos reais:
//   1. Validação Técnica  (created_at → data_aprovacao)
//   2. Cotação            (data_aprovacao → cmp_cotacoes.data_conclusao)
//   3. Aprovação          (data_conclusao → apr_aprovacoes data_decisao [tipo cotacao, aprovada])
//   4. Pedido             (cotação aprovada → cmp_pedidos.created_at)
//   5. Entrega            (pedido → cmp_pedidos.data_entrega_real)
//   Lead total            (criação → entrega)
// Variante "geral": fase concluída mantém duração; a 1ª fase incompleta (gargalo)
// conta a idade até hoje (mostra o que está parado). Só leitura.
// =============================================================================

export interface LeadTimeCategoria {
  categoria: string
  nome: string
  total: number
  comAprovacao: number
  comPedido: number
  comEntrega: number
  validacaoTecnica: number | null
  cotacao: number | null
  aprovacao: number | null
  pedido: number | null
  entrega: number | null
  leadTotal: number | null
  leadGeral: number | null
  // mesmas 5 fases na variante "geral"
  validacaoTecnicaGeral: number | null
  cotacaoGeral: number | null
  aprovacaoGeral: number | null
  pedidoGeral: number | null
  entregaGeral: number | null
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
  const d = Math.round((a - b) / DAY * 10) / 10 // dias com 1 casa (ciclos < 1 dia, ex.: 0,7d)
  return d >= 0 ? d : null
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
interface PedRow { requisicao_id: string | null; created_at: string | null; data_entrega_real: string | null; data_prevista_entrega: string | null }
interface AprRow { entidade_id: string | null; data_decisao: string | null }

export function useLeadTimeCompras(opts?: { de?: string; ate?: string; obraId?: string }) {
  const { de, ate, obraId } = opts ?? {}
  return useQuery<LeadTimeCompras>({
    queryKey: ['lead-time-compras', de, ate, obraId],
    queryFn: async () => {
      const [reqRes, cotRes, pedRes, catRes, aprRes] = await Promise.all([
        supabase.from('cmp_requisicoes').select('id, categoria, status, created_at, data_aprovacao, obra_id'),
        supabase.from('cmp_cotacoes').select('requisicao_id, data_conclusao').not('requisicao_id', 'is', null),
        supabase.from('cmp_pedidos').select('requisicao_id, created_at, data_entrega_real, data_prevista_entrega').not('requisicao_id', 'is', null),
        supabase.from('cmp_categorias').select('codigo, nome'),
        // carimbo da APROVAÇÃO da cotação (só leitura)
        supabase.from('apr_aprovacoes').select('entidade_id, data_decisao').eq('modulo', 'cmp').eq('tipo_aprovacao', 'cotacao').eq('status', 'aprovada').not('data_decisao', 'is', null),
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
      const aprs = (aprRes.data ?? []) as AprRow[]

      const nomeByCod = new Map<string, string>()
      ;(catRes.data ?? []).forEach((c: { codigo: string; nome: string }) => nomeByCod.set(c.codigo, c.nome))

      // Cotação concluída mais antiga por requisição
      const cotByReq = new Map<string, string>()
      for (const c of cots) {
        if (!c.requisicao_id || !c.data_conclusao) continue
        const cur = cotByReq.get(c.requisicao_id)
        if (!cur || c.data_conclusao < cur) cotByReq.set(c.requisicao_id, c.data_conclusao)
      }

      // Cotação APROVADA mais antiga por requisição (apr_aprovacoes)
      const cotAprovByReq = new Map<string, string>()
      for (const a of aprs) {
        if (!a.entidade_id || !a.data_decisao) continue
        const cur = cotAprovByReq.get(a.entidade_id)
        if (!cur || a.data_decisao < cur) cotAprovByReq.set(a.entidade_id, a.data_decisao)
      }

      // Pedido mais antigo por requisição (pela criação real)
      const pedByReq = new Map<string, PedRow>()
      for (const p of peds) {
        if (!p.requisicao_id || !p.created_at) continue
        const cur = pedByReq.get(p.requisicao_id)
        if (!cur || (cur.created_at && p.created_at < cur.created_at)) pedByReq.set(p.requisicao_id, p)
      }

      interface Calc {
        categoria: string
        vtec: number | null; cot: number | null; apr: number | null; ped: number | null; ent: number | null
        leadTotal: number | null; geralLead: number | null
        gVtec: number | null; gCot: number | null; gApr: number | null; gPed: number | null; gEnt: number | null
        temAprov: boolean; temPedido: boolean; temEntrega: boolean
        noPrazo: boolean | null
      }

      const agoraISO = new Date().toISOString()
      const FECHADO = new Set(['rascunho', 'cancelada', 'rejeitada'])

      const calcs: Calc[] = reqs.map(r => {
        const categoria = r.categoria?.trim() || '(sem categoria)'
        const cotConcl = cotByReq.get(r.id) ?? null
        const cotAprov = cotAprovByReq.get(r.id) ?? null
        const ped = pedByReq.get(r.id) ?? null
        const entregaEod = fimDoDia(ped?.data_entrega_real)
        const basePed = cotAprov ?? cotConcl ?? r.data_aprovacao // início do "Pedido"

        const temApr = r.data_aprovacao != null
        const temCot = cotConcl != null
        const temAprovCot = cotAprov != null
        const temPed = ped != null
        const temEnt = ped?.data_entrega_real != null
        const ativo = !FECHADO.has(r.status)

        // durações concluídas
        const vtec = diffDays(r.data_aprovacao, r.created_at)
        const cot = diffDays(cotConcl, r.data_aprovacao)
        const apr = diffDays(cotAprov, cotConcl)
        const pedF = diffDays(ped?.created_at, basePed)
        const ent = diffDays(entregaEod, ped?.created_at)
        const leadTotal = diffDays(entregaEod, r.created_at)

        // "geral": fase concluída mantém duração; a 1ª incompleta (gargalo) conta até hoje
        let gVtec = vtec, gCot = cot, gApr = apr, gPed = pedF, gEnt = ent
        if (ativo && !temEnt) {
          if (!temApr) gVtec = diffDays(agoraISO, r.created_at)
          else if (!temCot) gCot = diffDays(agoraISO, r.data_aprovacao)
          else if (!temAprovCot) gApr = diffDays(agoraISO, cotConcl)
          else if (!temPed) gPed = diffDays(agoraISO, basePed)
          else gEnt = diffDays(agoraISO, ped?.created_at)
        }

        return {
          categoria,
          vtec, cot, apr, ped: pedF, ent,
          leadTotal,
          geralLead: temEnt ? leadTotal : (ativo ? diffDays(agoraISO, r.created_at) : null),
          gVtec, gCot, gApr, gPed, gEnt,
          temAprov: temApr, temPedido: temPed, temEntrega: temEnt,
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
          validacaoTecnica: avg(list.map(c => c.vtec)),
          cotacao: avg(list.map(c => c.cot)),
          aprovacao: avg(list.map(c => c.apr)),
          pedido: avg(list.map(c => c.ped)),
          entrega: avg(list.map(c => c.ent)),
          leadTotal: avg(list.map(c => c.leadTotal)),
          leadGeral: avg(list.map(c => c.geralLead)),
          validacaoTecnicaGeral: avg(list.map(c => c.gVtec)),
          cotacaoGeral: avg(list.map(c => c.gCot)),
          aprovacaoGeral: avg(list.map(c => c.gApr)),
          pedidoGeral: avg(list.map(c => c.gPed)),
          entregaGeral: avg(list.map(c => c.gEnt)),
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
