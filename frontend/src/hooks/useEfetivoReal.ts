// Efetivo real por frente: pessoas (RH, rh_colaboradores) + máquinas (frota, fro_veiculos).
// RH não tem obra_id preenchido → liga por base_id (est_bases), e a base casa com a frente
// (pmo_projetos.nome) por palavra-chave (Canteiro Três Marias → F2 - Tres Marias).
// Grupos de mão de obra: Fundação (cargoParaSetor='fundacao') e Montagem e Lançamento ('montagem').
// Máquinas: Fundação ← categoria 'maquinas'; Montagem e Lançamento ← categoria 'guindauto'.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { cargoParaSetor } from '../lib/headcountAnalytics'

export interface EfetivoFrente { fundacao: number; montlanc: number; maqFund: number; maqML: number }
export interface EfetivoReal {
  porFrente: Record<string, EfetivoFrente>
  total: EfetivoFrente
  semFrente: { bases: string[]; fundacao: number; montlanc: number } // efetivo em bases que não casaram (ex.: Escritório Central)
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['canteiro', 'cd', 'escritorio', 'central', 'ferragens', 'barracao', 'deposito', 'sede', 'base'])
// casa o nome da base com o label da frente por token (cidade)
function matchFrente(baseNome: string, frenteLabels: string[]): string | null {
  const tokens = norm(baseNome).split(' ').filter(t => t.length > 3 && !STOP.has(t))
  if (!tokens.length) return null
  for (const f of frenteLabels) { const nf = norm(f); if (tokens.some(t => nf.includes(t))) return f }
  return null
}

const emptyF = (): EfetivoFrente => ({ fundacao: 0, montlanc: 0, maqFund: 0, maqML: 0 })

export function useEfetivoReal(portfolioId?: string) {
  return useQuery<EfetivoReal>({
    queryKey: ['efetivo-real', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const [{ data: projs }, { data: bases }, { data: colabs }, { data: veics }] = await Promise.all([
        supabase.from('pmo_projetos').select('nome').eq('portfolio_id', portfolioId!),
        supabase.from('est_bases').select('id, nome'),
        supabase.from('rh_colaboradores').select('cargo, base_id').eq('ativo', true),
        supabase.from('fro_veiculos').select('categoria, base_id, status'),
      ])
      const frentes = [...new Set((projs ?? []).map((p: any) => p.nome as string))]
      const baseNome = new Map((bases ?? []).map((b: any) => [b.id as string, b.nome as string]))
      // base_id → frente (via match) | null
      const baseFrente = new Map<string, string | null>()
      for (const [id, nome] of baseNome) baseFrente.set(id, matchFrente(nome, frentes))

      const porFrente: Record<string, EfetivoFrente> = {}
      frentes.forEach(f => porFrente[f] = emptyF())
      const semBases = new Set<string>(); let semFund = 0, semML = 0

      for (const c of (colabs ?? []) as any[]) {
        const setor = cargoParaSetor(c.cargo)
        if (setor !== 'fundacao' && setor !== 'montagem') continue // só mão de obra de produção
        const fr = c.base_id ? baseFrente.get(c.base_id) : null
        if (!fr) { if (c.base_id && baseNome.has(c.base_id)) semBases.add(baseNome.get(c.base_id)!); setor === 'fundacao' ? semFund++ : semML++; continue }
        if (setor === 'fundacao') porFrente[fr].fundacao++; else porFrente[fr].montlanc++
      }
      for (const v of (veics ?? []) as any[]) {
        if (v.status === 'baixado') continue
        const cat = v.categoria as string
        if (cat !== 'maquinas' && cat !== 'guindauto') continue // máquinas de produção
        const fr = v.base_id ? baseFrente.get(v.base_id) : null
        if (!fr) continue
        if (cat === 'maquinas') porFrente[fr].maqFund++; else porFrente[fr].maqML++
      }

      const total = emptyF()
      for (const f of frentes) { const x = porFrente[f]; total.fundacao += x.fundacao; total.montlanc += x.montlanc; total.maqFund += x.maqFund; total.maqML += x.maqML }
      return { porFrente, total, semFrente: { bases: [...semBases], fundacao: semFund, montlanc: semML } }
    },
  })
}
