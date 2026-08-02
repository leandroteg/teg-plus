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
  origem: 'admin' | 'portal_qr' | 'erp_equipe'
  observacao: string | null
  /** Foto do leito no check-in — obrigatória quando o check-in vem do Portal. */
  checkin_foto_url: string | null
  /** Foto na saída. Com a de entrada, é o par que sustenta cobrança de avaria. */
  checkout_foto_url: string | null
  checkin_por_nome: string | null
  checkout_por_nome: string | null
  checkout_observacao: string | null
  colaborador?: { matricula: string | null } | null
}

export interface Leito {
  id: string
  numero_seq: number
  codigo_leito: string
  imovel_id: string
  codigo: string
  quarto: string | null
  tipo: string | null
  ativo: boolean
  observacao: string | null
  ordem: number
  qr_token: string
  imovel?: { id: string; titulo: string | null; nome: string | null; descricao: string | null; cidade: string | null; uf: string | null; tipo: string | null } | null
}

export interface OcupacaoHistorico extends LeitoOcupacao {
  leito: {
    numero_seq: number
    codigo_leito: string
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
        .select('*, imovel:loc_imoveis(id, titulo, nome, descricao, cidade, uf, tipo)')
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
        .select('id, leito_id, colaborador_id, colaborador_nome, data_inicio, data_fim, checkin_em, checkout_em, origem, observacao, checkin_foto_url, checkout_foto_url, checkin_por_nome, checkout_por_nome, checkout_observacao, colaborador:rh_colaboradores(matricula)')
        .is('data_fim', null)
      if (error) throw error
      return (data ?? []) as unknown as LeitoOcupacao[]
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
        .select('*, colaborador:rh_colaboradores(matricula), leito:loc_leitos(numero_seq, codigo_leito, codigo, quarto, imovel_id, imovel:loc_imoveis(descricao, cidade, nome, titulo))')
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

// ── Foto do leito ───────────────────────────────────────────────────────────
// Mesmo bucket das fotos que o Portal manda (vistoria-fotos), em pasta separada:
// as duas pontas fotografam o mesmo leito e o histórico precisa mostrar juntas.
// Aqui o upload é direto — o ERP é authenticated; o Portal é anon e por isso
// passa pela edge portalteg-locacao-foto.
const FOTO_LADO_MAX = 1400

// Foto de celular chega com 8 MB; sobe reduzida para o histórico abrir rápido.
async function comprimir(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, FOTO_LADO_MAX / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * escala)
  const h = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.82))
  if (!blob) throw new Error('Não consegui processar a foto')
  return blob
}

export async function uploadFotoLeito(
  file: File, imovelId: string, momento: 'checkin' | 'checkout',
): Promise<string> {
  const blob = await comprimir(file)
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const path = `erp/leito-${momento}/${imovelId}/${nome}`
  const { error } = await supabase.storage
    .from('vistoria-fotos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from('vistoria-fotos').getPublicUrl(path).data.publicUrl
}

// ── Check-in / check-out pela equipe (TEG+) ─────────────────────────────────
// Alocar é reserva (checkin_em fica nulo); check-in é presença. São ações
// diferentes de propósito — quem chegou de verdade é o que interessa auditar.
export function useCheckinLeito() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async ({ leitoId, colaboradorId, fotoUrl, obs, quando }: {
      leitoId: string; colaboradorId?: string | null
      fotoUrl?: string | null; obs?: string | null; quando?: string | null
    }) => {
      const { data, error } = await supabase.rpc('loc_leito_checkin', {
        p_leito_id: leitoId,
        p_colaborador_id: colaboradorId ?? undefined,
        p_foto_url: fotoUrl ?? undefined,
        p_obs: obs ?? undefined,
        p_quando: quando ?? undefined,
      })
      if (error) throw error
      return data as { ok: boolean; msg: string; colaborador: string; leito: string; trocou: string }
    },
    onSuccess: invalidar,
  })
}

export function useCheckoutLeito() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async ({ ocupacaoId, fotoUrl, obs, dataFim }: {
      ocupacaoId: string; fotoUrl?: string | null; obs?: string | null; dataFim?: string | null
    }) => {
      const { data, error } = await supabase.rpc('loc_leito_checkout', {
        p_ocupacao_id: ocupacaoId,
        p_foto_url: fotoUrl ?? undefined,
        p_obs: obs ?? undefined,
        p_data_fim: dataFim ?? undefined,
      })
      if (error) throw error
      return data as { ok: boolean; msg: string; colaborador: string }
    },
    onSuccess: invalidar,
  })
}

// Regularização das ocupações antigas: carimba presença de vários de uma vez.
export function useCheckinLote() {
  const invalidar = useInvalidarLeitos()
  return useMutation({
    mutationFn: async (ocupacaoIds: string[]) => {
      const { data, error } = await supabase.rpc('loc_leito_checkin_lote', {
        p_ocupacao_ids: ocupacaoIds,
      })
      if (error) throw error
      return data as { ok: boolean; confirmados: number }
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
