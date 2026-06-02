// =============================================================================
// Unidades de Estoque — fonte única da verdade
// =============================================================================
// Espelha o enum `est_unidade` no Postgres (Supabase migration que adicionou
// FARDO, GALAO, PC, BARRA). Mantém-se em MAIÚSCULAS para combinar com o enum.
//
// Importe daqui em qualquer dropdown/normalização. NÃO duplique a lista.
// =============================================================================

export const UNIDADES_ESTOQUE = [
  'UN',
  'M',
  'M2',
  'M3',
  'KG',
  'TON',
  'L',
  'CX',
  'PCT',
  'RL',
  'PR',
  'JG',
  'FARDO',
  'GALAO',
  'PC',
  'BARRA',
] as const

export type UnidadeEstoque = typeof UNIDADES_ESTOQUE[number]

/**
 * Normaliza um valor cru (texto livre, possivelmente minúsculo) para o enum
 * `est_unidade`. Retorna `'UN'` como fallback seguro quando o valor não bate
 * com nenhuma opção válida.
 *
 * Importante: o cliente nunca deve mandar `unidade` minúscula para o banco —
 * o enum rejeita. Use este helper sempre antes de salvar.
 */
export function normalizeUnidade(raw: unknown): UnidadeEstoque {
  if (typeof raw !== 'string') return 'UN'
  const upper = raw.trim().toUpperCase()
  return (UNIDADES_ESTOQUE as readonly string[]).includes(upper)
    ? (upper as UnidadeEstoque)
    : 'UN'
}
