// ─────────────────────────────────────────────────────────────────────────────
// types/documentosFin.ts — Tipos de anexo aceitos nos lançamentos que NASCEM no
// Financeiro (Pagamento Extraordinário, Previsão de Pagamento e Lançar NF
// Recebimento). Espelham fin_documentos.tipo, que aceita uma lista maior; aqui
// ficam só os que fazem sentido no momento do lançamento.
// ─────────────────────────────────────────────────────────────────────────────

export type TipoDocFinanceiro = 'nota_fiscal' | 'boleto' | 'recibo' | 'outro'

export const TIPOS_DOC_FINANCEIRO: Array<{ value: TipoDocFinanceiro; label: string; curto: string }> = [
  { value: 'nota_fiscal', label: 'Nota Fiscal', curto: 'NF' },
  { value: 'boleto',      label: 'Boleto',      curto: 'Boleto' },
  { value: 'recibo',      label: 'Recibo',      curto: 'Recibo' },
  { value: 'outro',       label: 'Outro',       curto: 'Outro' },
]

export const rotuloCurtoDocFin = (tipo: string) =>
  TIPOS_DOC_FINANCEIRO.find(t => t.value === tipo)?.curto ?? 'Doc'

export interface ArquivoFinanceiro {
  file: File
  tipo: TipoDocFinanceiro
}
