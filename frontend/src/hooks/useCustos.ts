// Custos do EGP: orçamento (Base) por natureza = 80% do valor contratual (20% de lucro),
// Realizado = custo real do financeiro (fin_legado_custos, grupo_dre→natureza), por obra e por frente.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

// 7 naturezas com o % de custo (do print do usuário). Soma = 100%.
export const NATUREZAS = [
  { key: 'mo', label: 'Mão de Obra', pct: 0.378, cor: '#2563eb' },
  { key: 'aloj', label: 'Alojamento + Alimentação', pct: 0.165, cor: '#0891b2' },
  { key: 'mat', label: 'Materiais', pct: 0.095, cor: '#16a34a' },
  { key: 'serv', label: 'Serviços e Locações', pct: 0.092, cor: '#7c3aed' },
  { key: 'equip', label: 'Equipamentos + EPI', pct: 0.041, cor: '#db2777' },
  { key: 'frota', label: 'Frota', pct: 0.148, cor: '#f59e0b' },
  { key: 'adm', label: 'Administrativo', pct: 0.081, cor: '#64748b' },
] as const
export type NatKey = typeof NATUREZAS[number]['key']
export const MARGEM_LUCRO = 0.20 // custo orçado = (1 - margem) × valor contratual

// grupo_dre (financeiro) → natureza de custo
const GRUPO_NAT: Record<string, NatKey> = {
  'Mao de Obra Direta': 'mo',
  'Alojamentos e Alimentacao': 'aloj',
  'Materiais': 'mat',
  'Servicos Terc. + Outros C. Diretos': 'serv',
  'Equipamentos e EPIs': 'equip',
  'Frotas': 'frota',
  'Administrativo': 'adm',
  'Sistemas/TI': 'adm',
  'Despesas Financeiras': 'adm',
  'Capital/Investimentos': 'adm',
}
const natDe = (g?: string | null): NatKey => GRUPO_NAT[(g || '').trim()] ?? 'adm'
const zeroNat = () => Object.fromEntries(NATUREZAS.map(n => [n.key, 0])) as Record<NatKey, number>

export interface CustoReal {
  porFrente: Record<string, Record<NatKey, number>> // frente label → natureza → realizado
  porObra: Record<string, Record<NatKey, number>>   // obra_nome → natureza → realizado
  total: Record<NatKey, number>
}

export function useCustosReal(portfolioId?: string) {
  return useQuery<CustoReal>({
    queryKey: ['custos-real', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data: projs } = await supabase.from('pmo_projetos').select('id, nome').eq('portfolio_id', portfolioId!)
      const idToFrente = new Map((projs ?? []).map((p: any) => [p.id as string, p.nome as string]))
      const ids = [...idToFrente.keys()]
      const porFrente: Record<string, Record<NatKey, number>> = {}
      const porObra: Record<string, Record<NatKey, number>> = {}
      const total = zeroNat()
      if (ids.length) {
        let from = 0
        for (;;) {
          const { data, error } = await supabase.from('fin_legado_custos')
            .select('pmo_projeto_id, obra_nome, grupo_dre, natureza_dre, valor')
            .in('pmo_projeto_id', ids).range(from, from + 999)
          if (error) throw error
          for (const r of (data ?? []) as any[]) {
            if (r.natureza_dre === 'receita') continue
            const v = Number(r.valor || 0); if (!v) continue
            const nat = natDe(r.grupo_dre)
            const fr = idToFrente.get(r.pmo_projeto_id)
            if (fr) { (porFrente[fr] ??= zeroNat())[nat] += v }
            const ob = (r.obra_nome || '').trim()
            if (ob) { (porObra[ob] ??= zeroNat())[nat] += v }
            total[nat] += v
          }
          if (!data || data.length < 1000) break
          from += 1000
        }
      }
      return { porFrente, porObra, total }
    },
  })
}
