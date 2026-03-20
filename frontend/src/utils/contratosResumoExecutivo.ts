import { sanitizeAiText } from './sanitizeAiText'
import type { MinutaAiAnalise } from '../types/contratos'
import type { ResumoAiGerado } from '../hooks/useSolicitacoes'

type ResumoRisco = { nivel: string; descricao: string; mitigacao?: string }
type ResumoOportunidade = { descricao: string; impacto?: string }

export interface ResumoExecutivoPayloadDraft {
  solicitacao_id: string
  titulo: string
  partes_envolvidas: string
  objeto_resumo: string
  valor_total?: number
  vigencia?: string
  riscos: ResumoRisco[]
  oportunidades: ResumoOportunidade[]
  recomendacao?: string
  status: 'rascunho' | 'enviado'
}

function asSentence(text?: string | null) {
  const value = sanitizeAiText(text ?? '').trim()
  if (!value) return ''
  return /[.!?]$/.test(value) ? value : `${value}.`
}

export function formatResumoPartesEnvolvidas(
  partes: ResumoAiGerado['partes_envolvidas'] | string | undefined
) {
  if (!partes) return ''
  if (typeof partes === 'string') return sanitizeAiText(partes).trim()

  return partes
    .map((parte) => {
      const papel = sanitizeAiText(parte.papel)
      const nome = sanitizeAiText(parte.nome)
      const cnpj = parte.cnpj ? ` (${sanitizeAiText(parte.cnpj)})` : ''
      return `${papel}: ${nome}${cnpj}`
    })
    .join('; ')
}

export function buildResumoNarrativo(input: {
  partesEnvolvidas?: string
  objetoResumo?: string
  valorTotal?: number
  vigencia?: string
  riscos?: ResumoRisco[]
  oportunidades?: ResumoOportunidade[]
  recomendacao?: string
  parecerJuridico?: string
}) {
  const segmentos = [
    input.objetoResumo ? `Contratação de ${sanitizeAiText(input.objetoResumo).trim()}` : '',
    input.partesEnvolvidas ? `envolvendo ${sanitizeAiText(input.partesEnvolvidas).trim()}` : '',
  ].filter(Boolean)

  const abertura = segmentos.length > 0 ? asSentence(segmentos.join(', ')) : ''
  const valor = typeof input.valorTotal === 'number'
    ? `Valor: R$ ${input.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
    : ''
  const vigencia = input.vigencia ? asSentence(`Prazo: ${sanitizeAiText(input.vigencia).trim()}`) : ''

  const pontosAtencao = input.riscos && input.riscos.length > 0
    ? asSentence(`Pontos de atenção: ${input.riscos.slice(0, 3).map((risco) => sanitizeAiText(risco.descricao)).join('; ')}`)
    : ''
  const oportunidades = input.oportunidades && input.oportunidades.length > 0
    ? asSentence(`Oportunidades: ${input.oportunidades.slice(0, 2).map((op) => sanitizeAiText(op.descricao)).join('; ')}`)
    : ''
  const fechamento = asSentence(input.recomendacao || input.parecerJuridico)

  return [abertura, valor, vigencia, pontosAtencao, oportunidades, fechamento]
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function mapResumoAiToPayload(input: {
  solicitacaoId: string
  tituloPadrao: string
  resumo: ResumoAiGerado
  status: 'rascunho' | 'enviado'
}) : ResumoExecutivoPayloadDraft {
  const partes = formatResumoPartesEnvolvidas(input.resumo.partes_envolvidas)
  const riscos = (input.resumo.riscos ?? []).map((risco) => ({
    nivel: sanitizeAiText(risco.nivel ?? risco.impacto ?? 'medio').toLowerCase(),
    descricao: sanitizeAiText(risco.descricao),
    mitigacao: risco.mitigacao ? sanitizeAiText(risco.mitigacao) : undefined,
  })).filter((risco) => risco.descricao)

  const oportunidades = (input.resumo.oportunidades ?? []).map((oportunidade) => ({
    descricao: sanitizeAiText(oportunidade.descricao),
    impacto: oportunidade.impacto
      ? sanitizeAiText(oportunidade.impacto)
      : oportunidade.beneficio
        ? sanitizeAiText(oportunidade.beneficio)
        : undefined,
  })).filter((oportunidade) => oportunidade.descricao)

  return {
    solicitacao_id: input.solicitacaoId,
    titulo: sanitizeAiText(input.resumo.titulo || input.tituloPadrao),
    partes_envolvidas: partes,
    objeto_resumo: sanitizeAiText(input.resumo.objeto_resumo),
    valor_total: input.resumo.valor_total,
    vigencia: input.resumo.prazo_meses ? `${input.resumo.prazo_meses} meses` : undefined,
    riscos,
    oportunidades,
    recomendacao: buildResumoNarrativo({
      partesEnvolvidas: partes,
      objetoResumo: input.resumo.objeto_resumo,
      valorTotal: input.resumo.valor_total,
      vigencia: input.resumo.prazo_meses ? `${input.resumo.prazo_meses} meses` : undefined,
      riscos,
      oportunidades,
      recomendacao: input.resumo.recomendacao,
      parecerJuridico: input.resumo.parecer_juridico,
    }),
    status: input.status,
  }
}

export function buildResumoPayloadFromAnalise(input: {
  solicitacaoId: string
  titulo: string
  partesEnvolvidas: string
  objetoResumo: string
  valorTotal?: number
  vigencia?: string
  analise?: MinutaAiAnalise
  status: 'rascunho' | 'enviado'
}) : ResumoExecutivoPayloadDraft {
  const riscos = (input.analise?.riscos ?? []).slice(0, 3).map((risco) => ({
    nivel: risco.severidade === 'critico' ? 'alto' : risco.severidade,
    descricao: sanitizeAiText(risco.descricao),
    mitigacao: risco.sugestao_mitigacao ? sanitizeAiText(risco.sugestao_mitigacao) : undefined,
  }))

  const oportunidades = (input.analise?.oportunidades ?? []).slice(0, 2).map((oportunidade) => ({
    descricao: sanitizeAiText(oportunidade.descricao),
    impacto: oportunidade.impacto ? sanitizeAiText(oportunidade.impacto) : undefined,
  }))

  return {
    solicitacao_id: input.solicitacaoId,
    titulo: sanitizeAiText(input.titulo),
    partes_envolvidas: sanitizeAiText(input.partesEnvolvidas),
    objeto_resumo: sanitizeAiText(input.objetoResumo),
    valor_total: input.valorTotal,
    vigencia: input.vigencia,
    riscos,
    oportunidades,
    recomendacao: buildResumoNarrativo({
      partesEnvolvidas: input.partesEnvolvidas,
      objetoResumo: input.objetoResumo,
      valorTotal: input.valorTotal,
      vigencia: input.vigencia,
      riscos,
      oportunidades,
      recomendacao: input.analise?.resumo,
    }),
    status: input.status,
  }
}
