// ─────────────────────────────────────────────────────────────────────────────
// hooks/useLeitos.ts — Controle de Leitos (Locação de Imóveis)
// Alojamentos (loc_imoveis tipo=ALOJ) → leitos (loc_leitos) → ocupações
// (loc_leito_ocupacoes). Operações via RPCs SECURITY DEFINER.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { LocImovel } from '../types/locacao'

export interface LeitoOcupacao {
  id: string
  leito_id: string
  colaborador_id: string | null
  colaborador_nome: string
  data_inicio: string
  data_fim: string | null
  checkin_em: string | null
  checkout_em: string | null
  origem: 'admin' | 'portal_qr'
  observacao: string | null
}

export interface Leito {
  id: string
  numero_seq: number
  imovel_id: string
  codigo: string
  quarto: string | null
  tipo: string | null
  ativo: boolean
  observacao: string | null
  ordem: number
  qr_token: string
}

export interface OcupacaoHistorico extends LeitoOcupacao {
  leito: {
    numero_seq: number
    codigo: string
    quarto: string | null
    imovel_id: string
    imovel: { descricao: string; cidade: string | null; nome: string | null } | null
  } | null
}

// ── Alojamentos (imóveis tipo ALOJ) ──────────────────────────────────────────
export function useAlojamentos() {
  return useQuery({
    queryKey: ['loc_alojamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_imoveis')
        .select('*, contrato:con_contratos!loc_imoveis_contrato_fk(id, numero, data_inicio, data_fim_previsto, data_assinatura, status), centro_custo:sys_centros_custo(id, codigo, descricao)')
        .in('tipo', ['ALOJ', 'HTL'])
        .neq('status', 'inativo')
        .order('cidade', { ascending: true })
        .order('descricao', { ascending: true })
      if (error) throw error
      return (data ?? []) as LocImovel[]
    },
  })
}

// ── Leitos (todos, sem ocupação embutida) ────────────────────────────────────
export function useLeitos() {
  return useQuery({
    queryKey: ['loc_leitos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_leitos')
        .select('*')
        .order('ordem', { ascending: true })
      if (error) throw error
      return (data ?? []) as Leito[]
    },
  })
}

// Atualiza dados do alojamento (código + prefeito responsável) — loc_imoveis
export function useAtualizarAlojamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<LocImovel, 'codigo' | 'prefeito_nome' | 'prefeito_telefone'>>) => {
      const { error } = await supabase
        .from('loc_imoveis')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loc_alojamentos'] }),
  })
}

// ── Mapa: imóveis (todos, com coordenadas) + bases ───────────────────────────
export interface BaseMapa {
  id: string; nome: string; cidade: string | null; uf: string | null
  endereco: string | null; latitude: number | null; longitude: number | null
  geo_aprox: boolean | null; ativa: boolean | null; eh_sede: boolean | null; tipo: string | null
}

export function useImoveisMapa() {
  return useQuery({
    queryKey: ['loc_imoveis_mapa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_imoveis')
        .select('*, contrato:con_contratos!loc_imoveis_contrato_fk(id, numero, data_inicio, data_fim_previsto, data_assinatura, status), centro_custo:sys_centros_custo(id, codigo, descricao)')
        .not('latitude', 'is', null)
      if (error) throw error
      return (data ?? []) as LocImovel[]
    },
  })
}

export function useBasesMapa() {
  return useQuery({
    queryKey: ['est_bases_mapa'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('est_bases')
        .select('id, nome, cidade, uf, endereco, latitude, longitude, geo_aprox, ativa, eh_sede, tipo')
        .not('latitude', 'is', null)
      if (error) throw error
      return (data ?? []) as BaseMapa[]
    },
  })
}

// ── Ocupações ativas (data_fim null) — juntadas por leito_id no cliente ───────
export function useOcupacoesAtivas() {
  return useQuery({
    queryKey: ['loc_leito_ocupacoes', 'ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loc_leito_ocupacoes')
        .select('id, leito_id, colaborador_id, colaborador_nome, data_inicio, data_fim, checkin_em, checkout_em, origem, observacao')
        .is('data_fim', null)
      if (error) throw error
      return (data ?? []) as LeitoOcupacao[]
    },
  })
}

// ── Histórico de ocupações ───────────────────────────────────────────────────
export function useLeitosHistorico(filtros?: { imovel_id?: string; colaborador_id?: string }) {
  return useQuery({
    queryKey: ['loc_leito_ocupacoes', filtros],
    queryFn: async () => {
      let q = supabase
        .from('loc_leito_ocupacoes')
        .select('*, leito:loc_leitos(numero_seq, codigo, quarto, imovel_id, imovel:loc_imoveis(descricao, cidade, nome))')
        .order('data_inicio', { ascending: false })
        .limit(500)
      if (filtros?.colaborador_id) q = q.eq('colaborador_id', filtros.colaborador_id)
      const { data, error } = await q
      if (error) throw error
      let rows = (data ?? []) as OcupacaoHistorico[]
      if (filtros?.imovel_id) rows = rows.filter(r => r.leito?.imovel_id === filtros.imovel_id)
      return rows
    },
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────
function useInvalidarLeitos() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['loc_leitos'] })
    qc.invalidateQueries({ queryKey: ['loc_leito_ocupacoes'] })
  }
}

// Gera N leitos num alojamento
export function useGerarLeitos() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async ({ imovelId, qtd, prefixo }: { imovelId: string; qtd: number; prefixo?: string }) => {
      const { data, error } = await supabase.rpc('loc_leitos_gerar', {
        p_imovel_id: imovelId, p_qtd: qtd, p_prefixo: prefixo ?? 'L',
      })
      if (error) throw error
      return data as number
    },
    onSuccess: invalidar,
  })
}

// Edita um leito (código, quarto, tipo, ativo, observação)
export function useAtualizarLeito() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<Leito, 'codigo' | 'quarto' | 'tipo' | 'ativo' | 'observacao'>>) => {
      const { error } = await supabase
        .from('loc_leitos')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

// Remove um leito (só se nunca teve ocupação — senão desative)
export function useExcluirLeito() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('loc_leitos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidar,
  })
}

// Aloca colaborador a um leito
export function useAlocarLeito() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async ({ leitoId, colaboradorId, dataInicio, obs }: {
      leitoId: string; colaboradorId: string; dataInicio?: string; obs?: string
    }) => {
      const { data, error } = await supabase.rpc('loc_leito_alocar', {
        p_leito_id: leitoId, p_colaborador_id: colaboradorId,
        p_data_inicio: dataInicio ?? undefined, p_obs: obs ?? undefined,
      })
      if (error) throw error
      return data as LeitoOcupacao
    },
    onSuccess: invalidar,
  })
}

// Libera (check-out) uma ocupação
export function useLiberarLeito() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async ({ ocupacaoId, dataFim }: { ocupacaoId: string; dataFim?: string }) => {
      const { data, error } = await supabase.rpc('loc_leito_liberar', {
        p_ocupacao_id: ocupacaoId, p_data_fim: dataFim ?? undefined,
      })
      if (error) throw error
      return data as LeitoOcupacao
    },
    onSuccess: invalidar,
  })
}

// Move um colaborador de leito
export function useMoverLeito() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async ({ ocupacaoId, novoLeitoId, data }: { ocupacaoId: string; novoLeitoId: string; data?: string }) => {
      const { data: res, error } = await supabase.rpc('loc_leito_mover', {
        p_ocupacao_id: ocupacaoId, p_novo_leito_id: novoLeitoId, p_data: data ?? undefined,
      })
      if (error) throw error
      return res as LeitoOcupacao
    },
    onSuccess: invalidar,
  })
}
