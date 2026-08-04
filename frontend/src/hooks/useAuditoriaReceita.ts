// ─────────────────────────────────────────────────────────────────────────────
// useAuditoriaReceita.ts — Confere o cadastro dos fornecedores com o cartão CNPJ
// (Receita Federal) e aplica as correções aprovadas pelo usuário.
//
// Regras (definidas com o Elton, 03/ago):
//   • sincroniza razão social, fantasia, endereço, cidade, UF e CEP
//   • NÃO toca telefone/e-mail — o contato cadastrado pelo time vale mais
//   • situação diferente de ATIVA na Receita → fornecedor inativado
//
// A consulta roda em blocos com intervalo entre chamadas (as APIs públicas
// limitam por minuto) e grava cada resultado em cmp_fornecedores_receita_auditoria,
// que funciona como checkpoint: dá para parar, fechar a tela e continuar depois.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { api } from '../services/api'

/** Campos que a auditoria sincroniza (lista branca — igual à do RPC). */
export const CAMPOS_AUDITAVEIS = ['razao_social', 'nome_fantasia', 'endereco', 'cidade', 'uf', 'cep'] as const
export type CampoAuditavel = typeof CAMPOS_AUDITAVEIS[number]

export const CAMPO_LABEL: Record<CampoAuditavel, string> = {
  razao_social: 'Razão social',
  nome_fantasia: 'Nome fantasia',
  endereco: 'Endereço',
  cidade: 'Cidade',
  uf: 'UF',
  cep: 'CEP',
}

export interface AuditoriaReceita {
  id: string
  fornecedor_id: string
  cnpj: string
  consultado_em: string
  situacao: string | null
  divergencias: Partial<Record<CampoAuditavel, { atual: string; receita: string }>>
  qtd_divergencias: number
  status: 'pendente' | 'aplicado' | 'ignorado' | 'erro' | 'ok'
  erro: string | null
  aplicado_em: string | null
  aplicado_por: string | null
  fornecedor?: { razao_social: string; nome_fantasia: string | null; ativo: boolean } | null
}

const soDigitos = (s?: string | null) => (s ?? '').replace(/\D/g, '')

/** Normaliza para comparar: sem acento, maiúsculo, espaços colapsados, sem pontuação solta. */
function norm(s?: string | null) {
  return (s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[.,\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Monta o endereço no formato do cadastro: LOGRADOURO, NUMERO - COMPL - BAIRRO.
 * Sem logradouro devolve vazio de propósito: a Receita às vezes traz só o
 * bairro, e sugerir "CENTRO" apagaria um endereço bom que já existe.
 */
export function montarEndereco(e?: { logradouro?: string; numero?: string; complemento?: string; bairro?: string }) {
  if (!e?.logradouro?.trim()) return ''
  const base = [e.logradouro.trim(), e.numero?.trim()].filter(Boolean).join(', ')
  return [base, e.complemento?.trim(), e.bairro?.trim()].filter(Boolean).join(' - ')
}

type FornecedorRow = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  ativo: boolean
}

/** Compara cadastro x Receita e devolve só o que realmente diverge. */
export function calcularDivergencias(f: FornecedorRow, r: Awaited<ReturnType<typeof api.consultarCNPJ>>) {
  const receita: Record<CampoAuditavel, string> = {
    razao_social: (r.razao_social ?? '').trim(),
    nome_fantasia: (r.nome_fantasia ?? '').trim(),
    endereco: montarEndereco(r.endereco),
    cidade: (r.endereco?.cidade ?? '').trim(),
    uf: (r.endereco?.uf ?? '').trim().toUpperCase(),
    cep: soDigitos(r.endereco?.cep),
  }
  const atual: Record<CampoAuditavel, string> = {
    razao_social: (f.razao_social ?? '').trim(),
    nome_fantasia: (f.nome_fantasia ?? '').trim(),
    endereco: (f.endereco ?? '').trim(),
    cidade: (f.cidade ?? '').trim(),
    uf: (f.uf ?? '').trim().toUpperCase(),
    cep: soDigitos(f.cep),
  }

  const div: Record<string, { atual: string; receita: string }> = {}
  for (const campo of CAMPOS_AUDITAVEIS) {
    const vReceita = receita[campo]
    if (!vReceita) continue                    // Receita sem o dado: não sugere apagar
    if (norm(vReceita) === norm(atual[campo])) continue
    div[campo] = { atual: atual[campo], receita: vReceita }
  }
  return div
}

// ── Lista de auditorias já consultadas ───────────────────────────────────────

export function useAuditoriasReceita(filtro?: 'divergentes' | 'irregulares' | 'todas') {
  return useQuery<AuditoriaReceita[]>({
    queryKey: ['auditoria-receita', filtro ?? 'divergentes'],
    queryFn: async () => {
      let q = supabase
        .from('cmp_fornecedores_receita_auditoria')
        .select('*, fornecedor:cmp_fornecedores!fornecedor_id(razao_social, nome_fantasia, ativo)')
        .order('qtd_divergencias', { ascending: false })
        .limit(1000)

      if (filtro === 'divergentes') q = q.gt('qtd_divergencias', 0).eq('status', 'pendente')
      if (filtro === 'irregulares') q = q.not('situacao', 'is', null).neq('situacao', 'ATIVA')

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as AuditoriaReceita[]
    },
    staleTime: 15_000,
  })
}

/** Resumo do andamento: quantos faltam consultar, quantos divergem, irregulares. */
export function useResumoAuditoriaReceita() {
  return useQuery({
    queryKey: ['auditoria-receita-resumo'],
    queryFn: async () => {
      const [{ count: totalFornecedores }, { count: consultados }, { count: divergentes }, { count: irregulares }, { count: aplicados }] = await Promise.all([
        supabase.from('cmp_fornecedores').select('id', { count: 'exact', head: true })
          .eq('ativo', true).not('cnpj', 'is', null),
        supabase.from('cmp_fornecedores_receita_auditoria').select('id', { count: 'exact', head: true }),
        supabase.from('cmp_fornecedores_receita_auditoria').select('id', { count: 'exact', head: true })
          .gt('qtd_divergencias', 0).eq('status', 'pendente'),
        supabase.from('cmp_fornecedores_receita_auditoria').select('id', { count: 'exact', head: true })
          .not('situacao', 'is', null).neq('situacao', 'ATIVA'),
        supabase.from('cmp_fornecedores_receita_auditoria').select('id', { count: 'exact', head: true })
          .eq('status', 'aplicado'),
      ])
      return {
        totalFornecedores: totalFornecedores ?? 0,
        consultados: consultados ?? 0,
        divergentes: divergentes ?? 0,
        irregulares: irregulares ?? 0,
        aplicados: aplicados ?? 0,
      }
    },
    staleTime: 10_000,
  })
}

// ── Execução da varredura ────────────────────────────────────────────────────

export interface ProgressoAuditoria {
  rodando: boolean
  processados: number
  total: number
  atual: string
  divergentesEncontrados: number
  irregularesEncontrados: number
  erros: number
}

const PROGRESSO_ZERO: ProgressoAuditoria = {
  rodando: false, processados: 0, total: 0, atual: '',
  divergentesEncontrados: 0, irregularesEncontrados: 0, erros: 0,
}

export function useVarreduraReceita() {
  const qc = useQueryClient()
  const [progresso, setProgresso] = useState<ProgressoAuditoria>(PROGRESSO_ZERO)
  const abortRef = useRef(false)

  const parar = useCallback(() => { abortRef.current = true }, [])

  const iniciar = useCallback(async (opcoes?: { limite?: number; intervaloMs?: number }) => {
    const limite = opcoes?.limite ?? 200
    const intervalo = opcoes?.intervaloMs ?? 1200   // respeita o limite das APIs públicas
    abortRef.current = false

    // Fornecedores ativos com CNPJ que ainda não foram consultados
    const { data: jaAuditados } = await supabase
      .from('cmp_fornecedores_receita_auditoria')
      .select('fornecedor_id')
      .limit(5000)
    const idsAuditados = new Set((jaAuditados ?? []).map(r => r.fornecedor_id as string))

    const { data: fornecedores } = await supabase
      .from('cmp_fornecedores')
      .select('id, razao_social, nome_fantasia, cnpj, endereco, cidade, uf, cep, ativo')
      .eq('ativo', true)
      .not('cnpj', 'is', null)
      .order('razao_social')
      .limit(2000)

    const fila = ((fornecedores ?? []) as FornecedorRow[])
      .filter(f => soDigitos(f.cnpj).length === 14 && !idsAuditados.has(f.id))
      .slice(0, limite)

    setProgresso({ ...PROGRESSO_ZERO, rodando: true, total: fila.length })

    let divergentes = 0, irregulares = 0, erros = 0
    for (let i = 0; i < fila.length; i++) {
      if (abortRef.current) break
      const f = fila[i]
      setProgresso(p => ({ ...p, processados: i, atual: f.razao_social }))

      try {
        const r = await api.consultarCNPJ(soDigitos(f.cnpj))
        if (r.error) {
          erros++
          await supabase.from('cmp_fornecedores_receita_auditoria').upsert({
            fornecedor_id: f.id, cnpj: soDigitos(f.cnpj), status: 'erro',
            erro: r.message ?? 'Falha na consulta', consultado_em: new Date().toISOString(),
          }, { onConflict: 'fornecedor_id' })
        } else {
          const div = calcularDivergencias(f, r)
          const qtd = Object.keys(div).length
          const situacao = (r.situacao ?? '').toUpperCase() || null
          const irregular = !!situacao && situacao !== 'ATIVA'
          if (qtd > 0) divergentes++
          if (irregular) irregulares++

          await supabase.from('cmp_fornecedores_receita_auditoria').upsert({
            fornecedor_id: f.id,
            cnpj: soDigitos(f.cnpj),
            consultado_em: new Date().toISOString(),
            situacao,
            receita: r as unknown as Record<string, unknown>,
            divergencias: div,
            qtd_divergencias: qtd,
            status: qtd > 0 || irregular ? 'pendente' : 'ok',
            erro: null,
          }, { onConflict: 'fornecedor_id' })
        }
      } catch (e) {
        erros++
        await supabase.from('cmp_fornecedores_receita_auditoria').upsert({
          fornecedor_id: f.id, cnpj: soDigitos(f.cnpj), status: 'erro',
          erro: e instanceof Error ? e.message : 'Erro inesperado',
          consultado_em: new Date().toISOString(),
        }, { onConflict: 'fornecedor_id' })
      }

      setProgresso(p => ({
        ...p, processados: i + 1,
        divergentesEncontrados: divergentes, irregularesEncontrados: irregulares, erros,
      }))
      if (i < fila.length - 1) await new Promise(res => setTimeout(res, intervalo))
    }

    setProgresso(p => ({ ...p, rodando: false, atual: '' }))
    qc.invalidateQueries({ queryKey: ['auditoria-receita'] })
    qc.invalidateQueries({ queryKey: ['auditoria-receita-resumo'] })
  }, [qc])

  return { progresso, iniciar, parar }
}

// ── Aplicação das correções ──────────────────────────────────────────────────

export function useAplicarCorrecaoReceita() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ auditoriaId, campos }: { auditoriaId: string; campos?: CampoAuditavel[] }) => {
      const { data, error } = await supabase.rpc('cmp_fornecedor_aplicar_receita', {
        p_auditoria_id: auditoriaId,
        p_campos: campos && campos.length > 0 ? campos : null,
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditoria-receita'] })
      qc.invalidateQueries({ queryKey: ['auditoria-receita-resumo'] })
      qc.invalidateQueries({ queryKey: ['cad-fornecedores'] })
    },
  })
}

export function useIgnorarAuditoria() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (auditoriaId: string) => {
      const { error } = await supabase
        .from('cmp_fornecedores_receita_auditoria')
        .update({ status: 'ignorado' })
        .eq('id', auditoriaId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditoria-receita'] })
      qc.invalidateQueries({ queryKey: ['auditoria-receita-resumo'] })
    },
  })
}

/** Inativa de uma vez todos os fornecedores irregulares na Receita. */
export function useInativarIrregulares() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('cmp_fornecedor_inativar_irregulares')
      if (error) throw new Error(error.message)
      return (data as number) ?? 0
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditoria-receita'] })
      qc.invalidateQueries({ queryKey: ['auditoria-receita-resumo'] })
      qc.invalidateQueries({ queryKey: ['cad-fornecedores'] })
    },
  })
}
