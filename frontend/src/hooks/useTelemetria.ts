// ─────────────────────────────────────────────────────────────────────────────
// hooks/useTelemetria.ts — Módulo Telemetria (Logística)
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type {
  TelUltimaPosicao, TelPosicao, TelEvento,
  TelKmVeiculo, TelUtilizacao, TelemetriaKPIs,
  TipoEventoTel,
} from '../types/telemetria'

// ── Últimas Posições (polling 30s) ───────────────────────────────────────────

export function useUltimasPosicoes() {
  return useQuery<TelUltimaPosicao[]>({
    queryKey: ['tel_ultima_posicao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tel_ultima_posicao')
        .select('*')
      if (error) throw error
      return data as TelUltimaPosicao[]
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

// ── Histórico de Posições (rota) ─────────────────────────────────────────────

export function useHistoricoPosicoes(veiculoId: string | undefined, inicio: string | undefined, fim: string | undefined) {
  return useQuery<TelPosicao[]>({
    queryKey: ['tel_posicoes', veiculoId, inicio, fim],
    queryFn: async () => {
      let q = supabase
        .from('tel_posicoes')
        .select('*')
        .eq('veiculo_id', veiculoId!)
        .order('cobli_ts', { ascending: true })

      if (inicio) q = q.gte('cobli_ts', inicio)
      if (fim)    q = q.lte('cobli_ts', fim)

      const { data, error } = await q
      if (error) throw error
      return data as TelPosicao[]
    },
    enabled: !!veiculoId,
  })
}

// ── Eventos de Telemetria ────────────────────────────────────────────────────

export function useEventosTelemetria(filtros?: {
  tipo_evento?: TipoEventoTel
  veiculo_id?: string
  desde?: string
  ate?: string
}) {
  return useQuery<TelEvento[]>({
    queryKey: ['tel_eventos', filtros],
    queryFn: async () => {
      let q = supabase
        .from('tel_eventos')
        .select('*, veiculo:fro_veiculos!veiculo_id(id, placa, marca, modelo)')
        .order('cobli_ts', { ascending: false })
        .limit(500)

      if (filtros?.tipo_evento) q = q.eq('tipo_evento', filtros.tipo_evento)
      if (filtros?.veiculo_id)  q = q.eq('veiculo_id', filtros.veiculo_id)
      if (filtros?.desde)       q = q.gte('cobli_ts', filtros.desde)
      if (filtros?.ate)         q = q.lte('cobli_ts', filtros.ate)

      const { data, error } = await q
      if (error) throw error
      return data as TelEvento[]
    },
    refetchInterval: 60_000,
  })
}

// ── KM por Veículo (período) ─────────────────────────────────────────────────
// Usa RPC rpc_telemetria_km (agrega no DB) para evitar limite de 1000 rows.

interface RpcKmRow {
  veiculo_id: string
  placa: string
  marca: string
  modelo: string
  km_inicio: number | string
  km_fim: number | string
  km_percorrido: number | string
}

export function useKmPorVeiculo(inicio: string | undefined, fim: string | undefined) {
  return useQuery<TelKmVeiculo[]>({
    queryKey: ['tel_km_veiculo', inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_telemetria_km', {
        p_inicio: inicio,
        p_fim: fim,
      })
      if (error) throw error
      const rows = (data ?? []) as RpcKmRow[]
      return rows.map(r => ({
        veiculo_id: r.veiculo_id,
        placa: r.placa,
        marca: r.marca ?? '',
        modelo: r.modelo ?? '',
        km_inicio: Number(r.km_inicio) || 0,
        km_fim: Number(r.km_fim) || 0,
        km_percorrido: Number(r.km_percorrido) || 0,
      }))
    },
    enabled: !!inicio && !!fim,
  })
}

// ── Utilização de Veículos (período) ─────────────────────────────────────────
// Agora usa RPC rpc_telemetria_utilizacao para agregar no DB, evitando
// limite de 1000 rows do PostgREST (eventos/posicoes >1000 estavam sendo cortados).

interface RpcUtilizacaoRow {
  veiculo_id: string
  placa: string
  marca: string
  modelo: string
  horas_ligado: number | string
  horas_movimento: number | string
  horas_total: number | string
  dias_uso: number
  dias_uteis_periodo: number
  dias_uteis_ajustado: number
  dias_sem_dados: number
}

export function useUtilizacaoVeiculos(inicio: string | undefined, fim: string | undefined) {
  return useQuery<TelUtilizacao[]>({
    queryKey: ['tel_utilizacao', inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('rpc_telemetria_utilizacao', {
        p_inicio: inicio,
        p_fim: fim,
      })
      if (error) throw error
      const rows = (data ?? []) as RpcUtilizacaoRow[]

      return rows.map(r => {
        const horas_ligado = Number(r.horas_ligado) || 0
        const horas_movimento = Number(r.horas_movimento) || 0
        const horas_total = Number(r.horas_total) || 0
        const pct_utilizacao = horas_total > 0 ? Math.round((horas_ligado / horas_total) * 10000) / 100 : 0
        const pct_ocioso = horas_ligado > 0
          ? Math.round(((horas_ligado - horas_movimento) / horas_ligado) * 10000) / 100
          : 0
        // % Alocacao ajustada: usa dias_uteis_ajustado (dias com dados) como denominador
        // para nao penalizar veiculos que comecaram no meio do periodo ou tiveram queda
        const denom = r.dias_uteis_ajustado > 0 ? r.dias_uteis_ajustado : r.dias_uteis_periodo
        const pct_alocacao = denom > 0
          ? Math.min(100, Math.round((r.dias_uso / denom) * 10000) / 100)
          : 0
        return {
          veiculo_id: r.veiculo_id,
          placa: r.placa,
          marca: r.marca ?? '',
          modelo: r.modelo ?? '',
          horas_ligado,
          horas_movimento,
          horas_total,
          pct_utilizacao,
          pct_ocioso,
          dias_uso: r.dias_uso,
          dias_uteis_periodo: r.dias_uteis_periodo,
          dias_uteis_ajustado: r.dias_uteis_ajustado,
          dias_sem_dados: r.dias_sem_dados,
          pct_alocacao,
        }
      }).sort((a, b) => b.dias_uso - a.dias_uso)
    },
    enabled: !!inicio && !!fim,
  })
}

// ── KPIs Telemetria ──────────────────────────────────────────────────────────

export function useTelemetriaKPIs() {
  return useQuery<TelemetriaKPIs>({
    queryKey: ['tel_kpis'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0]
      const inicioHoje = hoje + 'T00:00:00'

      const [posRes, eventosRes, kmRes] = await Promise.all([
        // Total vehicles with position + moving now
        supabase.from('tel_ultima_posicao').select('veiculo_id, velocidade'),
        // Alerts today (excludes ignition_on/off which are informational)
        supabase
          .from('tel_eventos')
          .select('id', { count: 'exact' })
          .gte('cobli_ts', inicioHoje)
          .not('tipo_evento', 'in', '("ignition_on","ignition_off")'),
        // KM today: first and last hodometro per vehicle
        supabase
          .from('tel_posicoes')
          .select('veiculo_id, hodometro')
          .gte('cobli_ts', inicioHoje)
          .not('hodometro', 'is', null)
          .order('cobli_ts', { ascending: true }),
      ])

      const posicoes = posRes.data ?? []
      const total_com_posicao = posicoes.length
      const em_movimento = posicoes.filter(p => p.velocidade > 0).length

      // Calculate total KM today
      const kmPorVeiculo = new Map<string, { primeiro: number; ultimo: number }>()
      for (const p of kmRes.data ?? []) {
        if (!p.veiculo_id || p.hodometro == null) continue
        if (!kmPorVeiculo.has(p.veiculo_id)) {
          kmPorVeiculo.set(p.veiculo_id, { primeiro: p.hodometro, ultimo: p.hodometro })
        } else {
          kmPorVeiculo.get(p.veiculo_id)!.ultimo = p.hodometro
        }
      }
      let km_hoje = 0
      for (const v of kmPorVeiculo.values()) {
        km_hoje += Math.max(0, v.ultimo - v.primeiro)
      }

      return {
        total_com_posicao,
        em_movimento,
        alertas_hoje: eventosRes.count ?? 0,
        km_hoje: Math.round(km_hoje),
      } as TelemetriaKPIs
    },
    refetchInterval: 30_000,
  })
}
