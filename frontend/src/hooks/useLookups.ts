import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'

export interface Lookups {
  obras: Array<{ id: string; nome: string; codigo: string; status: string }>
  centros_custo: Array<{ id: string; codigo: string; descricao: string }>
  classes_financeiras: Array<{ id: string; codigo: string; descricao: string; tipo: string }>
  categorias: Array<{ id: string; nome: string }>
  empresas: Array<{ id: string; razao_social: string; nome_fantasia: string; cnpjs: string[] }>
}

const EMPTY: Lookups = {
  obras: [], centros_custo: [], classes_financeiras: [],
  categorias: [], empresas: [],
}

export function useLookups() {
  return useQuery<Lookups>({
    queryKey: ['lookups'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_lookups')
      if (error) return EMPTY
      return (data ?? EMPTY) as Lookups
    },
    staleTime: 10 * 60 * 1000,
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
