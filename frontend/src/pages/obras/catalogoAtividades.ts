// ─────────────────────────────────────────────────────────────────────────────
// pages/obras/catalogoAtividades.ts — frentes (seções) × atividades usadas pelo
// Plan. Técnico e pelo RDO. Vem do banco (obr_atividades_catalogo), NÃO é fixo
// no código: linhas com obra_id sobrescrevem o padrão (obra_id null) naquela
// obra, então uma obra pode ter frentes diferentes das outras.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'

export interface GrupoAtividades { secao: string; cor: string | null; atividades: string[] }

interface LinhaCatalogo {
  obra_id: string | null
  secao: string
  atividade: string
  cor: string | null
  ordem_secao: number
  ordem: number
}

const CINZA = '#94a3b8'

function agrupar(linhas: LinhaCatalogo[]): GrupoAtividades[] {
  const m = new Map<string, { cor: string | null; ordem_secao: number; itens: LinhaCatalogo[] }>()
  for (const l of linhas) {
    const g = m.get(l.secao) ?? { cor: l.cor, ordem_secao: l.ordem_secao, itens: [] }
    g.itens.push(l); m.set(l.secao, g)
  }
  return [...m.entries()]
    .sort((a, b) => a[1].ordem_secao - b[1].ordem_secao || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([secao, g]) => ({
      secao,
      cor: g.cor ?? CINZA,
      atividades: g.itens.sort((a, b) => a.ordem - b.ordem).map(i => i.atividade),
    }))
}

/**
 * Catálogo da obra. Se a obra tiver linhas próprias, elas substituem o padrão
 * por completo; senão usa o padrão (obra_id null).
 */
export function useCatalogoAtividades(obraId?: string) {
  return useQuery<GrupoAtividades[]>({
    queryKey: ['obr-atividades-catalogo', obraId ?? 'padrao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obr_atividades_catalogo')
        .select('obra_id, secao, atividade, cor, ordem_secao, ordem')
        .eq('ativo', true)
        .or(obraId ? `obra_id.is.null,obra_id.eq.${obraId}` : 'obra_id.is.null')
      if (error) return []
      const linhas = (data ?? []) as LinhaCatalogo[]
      const daObra = linhas.filter(l => l.obra_id)
      return agrupar(daObra.length ? daObra : linhas.filter(l => !l.obra_id))
    },
    staleTime: 10 * 60_000,
  })
}

/** mapa seção → cor, para colorir a coluna/cabeçalho */
export function coresDoCatalogo(cat: GrupoAtividades[]): Record<string, string> {
  return Object.fromEntries(cat.map(g => [g.secao, g.cor ?? CINZA]))
}
