// empresa.ts — Serviço compartilhado para dados da empresa principal (EMP-001)
// Usado em: Pedidos (PDF), Contratos (Minuta), e qualquer módulo que precise dos dados da empresa.

import { supabase } from './supabase'

export interface EmpresaData {
  razao: string; fantasia: string; cnpj: string; logoUrl: string
  endereco?: string; cidade?: string; uf?: string; cep?: string; telefone?: string; email?: string
}

export const EMPRESA_FALLBACK: EmpresaData = {
  razao: 'TEG UNIAO - LOCACAO, SERVICOS & EMPREENDIMENTOS LTDA',
  fantasia: 'Teg Uniao Energia',
  cnpj: '19.887.731/0001-29',
  logoUrl: '/logo-teg-empresa.png',
}

let _empresaCache: EmpresaData | null = null

export async function getEmpresa(): Promise<EmpresaData> {
  if (_empresaCache) return _empresaCache
  try {
    const { data } = await supabase
      .from('sys_empresas')
      .select('razao_social, nome_fantasia, cnpjs, endereco, cidade, uf, cep, telefone, email, logo_url')
      .eq('codigo', 'EMP-001')
      .single()
    if (data) {
      _empresaCache = {
        razao: data.razao_social ?? EMPRESA_FALLBACK.razao,
        fantasia: data.nome_fantasia ?? EMPRESA_FALLBACK.fantasia,
        cnpj: (data.cnpjs as string[])?.[0] ?? EMPRESA_FALLBACK.cnpj,
        logoUrl: data.logo_url ?? EMPRESA_FALLBACK.logoUrl,
        endereco: data.endereco, cidade: data.cidade, uf: data.uf, cep: data.cep,
        telefone: data.telefone, email: data.email,
      }
      return _empresaCache
    }
  } catch { /* fallback */ }
  return EMPRESA_FALLBACK
}

/** Limpa o cache para forçar re-fetch (ex: após editar dados da empresa) */
export function clearEmpresaCache() { _empresaCache = null }
