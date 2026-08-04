import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export interface Lookups {
  obras: Array<{ id: string; nome: string; codigo: string; status: string; centro_custo_id?: string; centro_custo_codigo?: string; centro_custo_descricao?: string }>
  centros_custo: Array<{ id: string; codigo: string; descricao: string }>
  /** codigo_legado = código(s) do plano antigo que esta natureza substituiu (mig 209) */
  classes_financeiras: Array<{ id: string; codigo: string; descricao: string; tipo: string; codigo_legado?: string | null }>
  categorias: Array<{ id: string; nome: string }>
  empresas: Array<{ id: string; codigo: string; razao_social: string; nome_fantasia: string; cnpjs: string[] }>
}

const EMPTY: Lookups = {
  obras: [], centros_custo: [], classes_financeiras: [],
  categorias: [], empresas: [],
}

export function useLookups() {
  return useQuery<Lookups>({
    queryKey: ['lookups'],
    queryFn: async () => {
      const [obrasRes, ccRes, cfRes, catRes, empRes] = await Promise.all([
        supabase.from('sys_obras').select('id, nome, codigo, status, centro_custo_id, centro_custo:sys_centros_custo!centro_custo_id(codigo, descricao)').eq('status', 'ativa').order('nome'),
        supabase.from('sys_centros_custo').select('id, codigo, descricao').eq('ativo', true).order('codigo'),
        // Só as ativas: a mig 200 desativou as 137 classes CLS-* legadas, que
        // continuavam aparecendo nos seletores. Ordem por código = hierarquia RM.
        supabase.from('fin_classes_financeiras').select('id, codigo, descricao, tipo, codigo_legado').eq('ativo', true).order('codigo'),
        supabase.from('cmp_categorias').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('sys_empresas').select('id, codigo, razao_social, nome_fantasia, cnpjs').eq('ativo', true).order('razao_social'),
      ])

      return {
        obras: ((obrasRes.data ?? []) as any[]).map(o => ({
          id: o.id, nome: o.nome, codigo: o.codigo, status: o.status,
          centro_custo_id: o.centro_custo_id ?? undefined,
          centro_custo_codigo: o.centro_custo?.codigo ?? undefined,
          centro_custo_descricao: o.centro_custo?.descricao ?? undefined,
        })),
        centros_custo: (ccRes.data ?? []) as Lookups['centros_custo'],
        classes_financeiras: (cfRes.data ?? []) as Lookups['classes_financeiras'],
        categorias: (catRes.data ?? []) as Lookups['categorias'],
        empresas: ((empRes.data ?? []) as Array<{ id: string; codigo: string; razao_social: string; nome_fantasia: string; cnpjs: string[] }>).map(e => ({
          id: e.id, codigo: e.codigo, razao_social: e.razao_social, nome_fantasia: e.nome_fantasia, cnpjs: e.cnpjs ?? [],
        })),
      }
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
}

export function useLookupObras() {
  const { data } = useLookups()
  return data?.obras ?? []
}

export function useLookupCentrosCusto() {
  const { data } = useLookups()
  return data?.centros_custo ?? []
}

export function useLookupClassesFinanceiras() {
  const { data } = useLookups()
  return data?.classes_financeiras ?? []
}

export function useLookupEmpresas() {
  const { data } = useLookups()
  return data?.empresas ?? []
}
