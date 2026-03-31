export type CotacoesRegras = {
  ate_500: number
  '501_a_2k': number
  acima_2k: number
}

function toSafeMin(value: unknown, fallback: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  const rounded = Math.trunc(n)
  return rounded >= 1 ? rounded : fallback
}

export function minCotacoesPorValor(
  valor: number,
  regras?: Partial<CotacoesRegras> | null,
): number {
  const base = Number.isFinite(valor) ? valor : 0

  if (!regras) {
    if (base <= 500) return 1
    if (base <= 2000) return 2
    return 3
  }

  const ate500 = toSafeMin(regras.ate_500, 1)
  const de501A2k = toSafeMin(regras['501_a_2k'], ate500)
  const acima2k = toSafeMin(regras.acima_2k, de501A2k)

  if (base <= 500) return ate500
  if (base <= 2000) return de501A2k
  return acima2k
}

