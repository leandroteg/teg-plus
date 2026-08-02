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
const _empresaByIdCache = new Map<string, EmpresaData>()

const SELECT_COLS = 'razao_social, nome_fantasia, cnpjs, endereco, cidade, uf, cep, telefone, email, logo_url'

function mapEmpresa(data: any): EmpresaData {
  return {
    razao: data.razao_social ?? EMPRESA_FALLBACK.razao,
    fantasia: data.nome_fantasia ?? EMPRESA_FALLBACK.fantasia,
    cnpj: (data.cnpjs as string[])?.[0] ?? EMPRESA_FALLBACK.cnpj,
    logoUrl: data.logo_url ?? EMPRESA_FALLBACK.logoUrl,
    endereco: data.endereco, cidade: data.cidade, uf: data.uf, cep: data.cep,
    telefone: data.telefone, email: data.email,
  }
}

export async function getEmpresa(): Promise<EmpresaData> {
  if (_empresaCache) return _empresaCache
  try {
    const { data } = await supabase
      .from('sys_empresas')
      .select(SELECT_COLS)
      .eq('codigo', 'EMP-001')
      .single()
    if (data) {
      _empresaCache = mapEmpresa(data)
      return _empresaCache
    }
  } catch { /* fallback */ }
  return EMPRESA_FALLBACK
}

/**
 * Resolve os dados de uma empresa específica pelo id (multi-empresa).
 * Usado no PDF do pedido para estampar o CNPJ/razão da empresa emitente escolhida.
 * Sem id, cai na empresa principal (EMP-001) — mantém compatibilidade com quem não usa empresa.
 */
export async function getEmpresaById(id?: string | null): Promise<EmpresaData> {
  if (!id) return getEmpresa()
  const cached = _empresaByIdCache.get(id)
  if (cached) return cached
  try {
    const { data } = await supabase
      .from('sys_empresas')
      .select(SELECT_COLS)
      .eq('id', id)
      .single()
    if (data) {
      const empresa = mapEmpresa(data)
      _empresaByIdCache.set(id, empresa)
      return empresa
    }
  } catch { /* fallback */ }
  return getEmpresa()
}

/** Limpa o cache para forçar re-fetch (ex: após editar dados da empresa) */
export function clearEmpresaCache() { _empresaCache = null; _empresaByIdCache.clear() }
