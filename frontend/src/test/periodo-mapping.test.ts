import { describe, it, expect } from 'vitest'

function periodoToLabel(p: string): string {
  const map: Record<string, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '365d': 'Ano' }
  return map[p] ?? '30 dias'
}

describe('periodo financeiro labels', () => {
  it('mapeia 7d', () => expect(periodoToLabel('7d')).toBe('7 dias'))
  it('mapeia 30d', () => expect(periodoToLabel('30d')).toBe('30 dias'))
  it('usa fallback para periodo invalido', () => expect(periodoToLabel('xyz')).toBe('30 dias'))
})
