import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { Fornecedor } from '../types/financeiro'
import type { ClasseFinanceira, CentroCusto, Obra, Colaborador, AiCadastroResult } from '../types/cadastros'

// ── Fornecedores ────────────────────────────────────────────────────────────
export function useCadFornecedores(filtros?: { ativo?: boolean }) {
  return useQuery<Fornecedor[]>({
    queryKey: ['cad-fornecedores', filtros],
    queryFn: async () => {
      let q = supabase.from('cmp_fornecedores').select('*').order('razao_social')
      if (filtros?.ativo !== undefined) q = q.eq('ativo', filtros.ativo)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as Fornecedor[]
    },
  })
}

export function useSalvarFornecedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Fornecedor> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('cmp_fornecedores').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cmp_fornecedores').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cad-fornecedores'] })
      qc.invalidateQueries({ queryKey: ['fornecedores'] })
    },
  })
}

// ── Classes Financeiras ─────────────────────────────────────────────────────
export function useCadClasses(filtros?: { tipo?: string }) {
  return useQuery<ClasseFinanceira[]>({
    queryKey: ['cad-classes', filtros],
    queryFn: async () => {
      let q = supabase.from('fin_classes_financeiras').select('*').order('codigo')
      if (filtros?.tipo) q = q.eq('tipo', filtros.tipo)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as ClasseFinanceira[]
    },
  })
}

export function useSalvarClasse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ClasseFinanceira> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('fin_classes_financeiras').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('fin_classes_financeiras').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cad-classes'] }),
  })
}

// ── Centros de Custo ────────────────────────────────────────────────────────
export function useCadCentrosCusto() {
  return useQuery<CentroCusto[]>({
    queryKey: ['cad-centros-custo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sys_centros_custo')
        .select('*, obra:sys_obras!obra_id(id, codigo, nome)')
        .order('codigo')
      if (error) return []
      return (data ?? []) as CentroCusto[]
    },
  })
}

export function useSalvarCentroCusto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<CentroCusto> & { id?: string }) => {
      const { id, obra, ...rest } = payload as any
      if (id) {
        const { error } = await supabase.from('sys_centros_custo').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sys_centros_custo').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cad-centros-custo'] }),
  })
}

// ── Obras ───────────────────────────────────────────────────────────────────
export function useCadObras() {
  return useQuery<Obra[]>({
    queryKey: ['cad-obras'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sys_obras').select('*').order('nome')
      if (error) return []
      return (data ?? []) as Obra[]
    },
  })
}

export function useSalvarObra() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Obra> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { error } = await supabase.from('sys_obras').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('sys_obras').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cad-obras'] })
      qc.invalidateQueries({ queryKey: ['obras'] })
    },
  })
}

// ── Colaboradores ───────────────────────────────────────────────────────────
export function useCadColaboradores(filtros?: { obra_id?: string; departamento?: string }) {
  return useQuery<Colaborador[]>({
    queryKey: ['cad-colaboradores', filtros],
    queryFn: async () => {
      let q = supabase
        .from('rh_colaboradores')
        .select('*, obra:sys_obras!obra_id(id, codigo, nome)')
        .order('nome')
      if (filtros?.obra_id) q = q.eq('obra_id', filtros.obra_id)
      if (filtros?.departamento) q = q.eq('departamento', filtros.departamento)
      const { data, error } = await q
      if (error) return []
      return (data ?? []) as Colaborador[]
    },
  })
}

export function useSalvarColaborador() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Colaborador> & { id?: string }) => {
      const { id, obra, ...rest } = payload as any
      if (id) {
        const { error } = await supabase.from('rh_colaboradores').update(rest).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('rh_colaboradores').insert(rest)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cad-colaboradores'] }),
  })
}

// ── AI Cadastro Parse ───────────────────────────────────────────────────────
export function useAiCadastroParse() {
  return useMutation({
    mutationFn: async (vars: {
      entity_type: string
      input_type: 'cnpj' | 'cpf' | 'file' | 'text'
      content: string
      base64?: string
      filename?: string
    }): Promise<AiCadastroResult> => {
      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

      if (vars.input_type === 'cnpj') {
        const clean = vars.content.replace(/\D/g, '')
        if (clean.length !== 14) throw new Error('CNPJ deve ter 14 digitos')
        try {
          const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`)
          if (!res.ok) throw new Error('CNPJ nao encontrado')
          const d = await res.json()
          return {
            fields: {
              razao_social:  { value: d.razao_social, confidence: 0.99 },
              nome_fantasia: { value: d.nome_fantasia || '', confidence: d.nome_fantasia ? 0.99 : 0.3 },
              cnpj:          { value: clean, confidence: 1 },
              endereco:      { value: `${d.logradouro}, ${d.numero} ${d.complemento || ''}`.trim(), confidence: 0.95 },
              cidade:        { value: d.municipio, confidence: 0.99 },
              uf:            { value: d.uf, confidence: 0.99 },
              cep:           { value: d.cep?.replace(/\D/g, '') || '', confidence: 0.95 },
              telefone:      { value: d.ddd_telefone_1 || '', confidence: d.ddd_telefone_1 ? 0.9 : 0.2 },
              email:         { value: d.email || '', confidence: d.email ? 0.85 : 0.1 },
            },
          }
        } catch {
          throw new Error('Nao foi possivel consultar o CNPJ. Verifique e tente novamente.')
        }
      }

      if (n8nUrl && (vars.input_type === 'file' || vars.input_type === 'text')) {
        try {
          const res = await fetch(`${n8nUrl}/cadastros/ai-parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vars),
          })
          if (!res.ok) throw new Error('AI parse failed')
          return await res.json() as AiCadastroResult
        } catch {
          if (vars.input_type === 'file') {
            throw new Error('Processamento de arquivos requer o servico de IA. Tente digitar manualmente.')
          }
        }
      }

      return extractBasicFields(vars.content)
    },
  })
}

function extractBasicFields(text: string): AiCadastroResult {
  const fields: Record<string, { value: string; confidence: number }> = {}
  const cnpjMatch = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
  if (cnpjMatch) fields.cnpj = { value: cnpjMatch[0].replace(/\D/g, ''), confidence: 0.9 }
  const cpfMatch = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)
  if (cpfMatch) fields.cpf = { value: cpfMatch[0].replace(/\D/g, ''), confidence: 0.9 }
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/)
  if (emailMatch) fields.email = { value: emailMatch[0], confidence: 0.85 }
  const phoneMatch = text.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/)
  if (phoneMatch) fields.telefone = { value: phoneMatch[0], confidence: 0.8 }
  return { fields }
}
