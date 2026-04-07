// cotacaoRecomendacao.ts — Score multi-critério para recomendação de fornecedor
import type { CotacaoFornecedor } from '../types'

export interface ScoreFornecedor {
  id: string
  nome: string
  score: number          // 0-100
  scorePreco: number
  scorePrazo: number
  scorePgto: number
  motivos: string[]      // ex: ["Menor preço", "Prazo mais curto"]
}

export interface RecomendacaoResult {
  recomendadoId: string
  scores: ScoreFornecedor[]
  resumo: string         // frase curta para exibir no card/aprovação
}

// ── Pesos ────────────────────────────────────────────────────────────────────
const PESO_PRECO = 0.50
const PESO_PRAZO = 0.30
const PESO_PGTO  = 0.20

// ── Parse heurístico de condição de pagamento ────────────────────────────────
// Quanto maior o prazo de pagamento, melhor para o comprador (mais tempo p/ pagar)
function parsePgtoScore(cond?: string): number {
  if (!cond) return 50 // neutro
  const lower = cond.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Extrair dias numéricos
  const match = lower.match(/(\d+)\s*(?:dias?|dd?)/)
  if (match) {
    const dias = parseInt(match[1], 10)
    if (dias <= 0) return 60   // à vista
    if (dias <= 7) return 65
    if (dias <= 14) return 75
    if (dias <= 21) return 85
    if (dias <= 30) return 100 // sweet spot
    if (dias <= 45) return 95
    if (dias <= 60) return 90
    if (dias <= 90) return 85
    return 80 // >90 dias, risco
  }
  // Patterns textuais
  if (/a\s*vista|avista|antecipado/.test(lower)) return 60
  if (/boleto/.test(lower)) return 85
  if (/cartao|credito/.test(lower)) return 75
  if (/parcelado|parcela/.test(lower)) return 80
  return 50 // desconhecido
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

// ── Cálculo principal ────────────────────────────────────────────────────────
export function calcularRecomendacao(fornecedores: CotacaoFornecedor[]): RecomendacaoResult | null {
  if (fornecedores.length === 0) return null

  // Fornecedor único
  if (fornecedores.length === 1) {
    const f = fornecedores[0]
    return {
      recomendadoId: f.id,
      scores: [{
        id: f.id, nome: f.fornecedor_nome, score: 100,
        scorePreco: 100, scorePrazo: 100, scorePgto: 100,
        motivos: ['Unica proposta recebida'],
      }],
      resumo: `Unica proposta: ${f.fornecedor_nome} (${fmtBRL(f.valor_total)})`,
    }
  }

  // Mins para normalização
  const minPreco = Math.min(...fornecedores.map(f => f.valor_total))
  const prazos = fornecedores.map(f => f.prazo_entrega_dias).filter((d): d is number => d != null && d > 0)
  const minPrazo = prazos.length > 0 ? Math.min(...prazos) : null

  const scores: ScoreFornecedor[] = fornecedores.map(f => {
    // Preço: menor = 100
    const scorePreco = minPreco > 0 ? Math.round((minPreco / f.valor_total) * 100) : 100

    // Prazo: menor = 100, sem prazo = 50
    const scorePrazo = f.prazo_entrega_dias != null && f.prazo_entrega_dias > 0 && minPrazo != null
      ? Math.round((minPrazo / f.prazo_entrega_dias) * 100)
      : 50

    // Pagamento
    const scorePgto = parsePgtoScore(f.condicao_pagamento)

    const score = Math.round(
      scorePreco * PESO_PRECO +
      scorePrazo * PESO_PRAZO +
      scorePgto  * PESO_PGTO
    )

    // Motivos
    const motivos: string[] = []
    if (f.valor_total === minPreco) motivos.push('Menor preco')
    if (f.prazo_entrega_dias != null && minPrazo != null && f.prazo_entrega_dias === minPrazo) motivos.push('Prazo mais curto')
    if (scorePgto >= 90) motivos.push('Boas condicoes de pagamento')

    return { id: f.id, nome: f.fornecedor_nome, score, scorePreco, scorePrazo, scorePgto, motivos }
  })

  // Ordenar por score desc, desempate por menor preço
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const fA = fornecedores.find(f => f.id === a.id)!
    const fB = fornecedores.find(f => f.id === b.id)!
    return fA.valor_total - fB.valor_total
  })

  const best = scores[0]
  const bestForn = fornecedores.find(f => f.id === best.id)!

  // Montar resumo
  const partes: string[] = []
  if (best.motivos.length > 0) {
    partes.push(best.motivos.join(', ').toLowerCase())
  } else {
    partes.push('melhor equilibrio preco/prazo/pagamento')
  }
  if (bestForn.prazo_entrega_dias != null) {
    partes.push(`prazo ${bestForn.prazo_entrega_dias}d`)
  }

  const resumo = `Recomendado: ${best.nome} (${fmtBRL(bestForn.valor_total)}) — ${partes.join(', ')}`

  return { recomendadoId: best.id, scores, resumo }
}
