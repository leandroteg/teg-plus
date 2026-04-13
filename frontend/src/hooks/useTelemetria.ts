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

export function useKmPorVeiculo(inicio: string | undefined, fim: string | undefined) {
  return useQuery<TelKmVeiculo[]>({
    queryKey: ['tel_km_veiculo', inicio, fim],
    queryFn: async () => {
      // Fetch all positions with hodometro in date range
      const { data: posicoes, error } = await supabase
        .from('tel_posicoes')
        .select('veiculo_id, placa, hodometro, cobli_ts')
        .gte('cobli_ts', inicio!)
        .lte('cobli_ts', fim!)
        .not('hodometro', 'is', null)
        .order('cobli_ts', { ascending: true })

      if (error) throw error

      // Group by veiculo_id, get first and last hodometro
      const porVeiculo = new Map<string, { placa: string; hodometros: number[] }>()
      for (const p of posicoes ?? []) {
        if (!p.veiculo_id || p.hodometro == null) continue
        if (!porVeiculo.has(p.veiculo_id)) {
          porVeiculo.set(p.veiculo_id, { placa: p.placa, hodometros: [] })
        }
        porVeiculo.get(p.veiculo_id)!.hodometros.push(p.hodometro)
      }

      // Fetch vehicle details
      const veiculoIds = Array.from(porVeiculo.keys())
      if (veiculoIds.length === 0) return []

      const { data: veiculos } = await supabase
        .from('fro_veiculos')
        .select('id, placa, marca, modelo')
        .in('id', veiculoIds)

      const veiculoMap = new Map((veiculos ?? []).map(v => [v.id, v]))

      const resultado: TelKmVeiculo[] = []
      for (const [vid, info] of porVeiculo) {
        const v = veiculoMap.get(vid)
        const km_inicio = info.hodometros[0]
        const km_fim = info.hodometros[info.hodometros.length - 1]
        resultado.push({
          veiculo_id: vid,
          placa: v?.placa ?? info.placa,
          marca: v?.marca ?? '',
          modelo: v?.modelo ?? '',
          km_inicio,
          km_fim,
          km_percorrido: km_fim - km_inicio,
        })
      }

      return resultado.sort((a, b) => b.km_percorrido - a.km_percorrido)
    },
    enabled: !!inicio && !!fim,
  })
}

// ── Utilização de Veículos (período) ─────────────────────────────────────────

export function useUtilizacaoVeiculos(inicio: string | undefined, fim: string | undefined) {
  return useQuery<TelUtilizacao[]>({
    queryKey: ['tel_utilizacao', inicio, fim],
    queryFn: async () => {
      // 1. Fetch ignition events in range
      const { data: eventos, error: errEv } = await supabase
        .from('tel_eventos')
        .select('veiculo_id, placa, tipo_evento, cobli_ts')
        .in('tipo_evento', ['ignition_on', 'ignition_off'])
        .gte('cobli_ts', inicio!)
        .lte('cobli_ts', fim!)
        .order('cobli_ts', { ascending: true })

      if (errEv) throw errEv

      // 2. Fetch positions with speed > 0 for movement hours
      const { data: posMovimento, error: errPos } = await supabase
        .from('tel_posicoes')
        .select('veiculo_id, cobli_ts')
        .gte('cobli_ts', inicio!)
        .lte('cobli_ts', fim!)
        .gt('velocidade', 0)
        .order('cobli_ts', { ascending: true })

      if (errPos) throw errPos

      const horas_total = (new Date(fim!).getTime() - new Date(inicio!).getTime()) / 3_600_000

      // Group ignition events per vehicle, pair on/off
      const ignicaoPorVeiculo = new Map<string, { placa: string; eventos: { tipo: string; ts: number }[] }>()
      for (const e of eventos ?? []) {
        if (!e.veiculo_id) continue
        if (!ignicaoPorVeiculo.has(e.veiculo_id)) {
          ignicaoPorVeiculo.set(e.veiculo_id, { placa: e.placa, eventos: [] })
        }
        ignicaoPorVeiculo.get(e.veiculo_id)!.eventos.push({
          tipo: e.tipo_evento,
          ts: new Date(e.cobli_ts).getTime(),
        })
      }

      // Compute hours engine on per vehicle
      const horasLigadoMap = new Map<string, number>()
      for (const [vid, info] of ignicaoPorVeiculo) {
        let horas = 0
        let ultimoOn: number | null = null
        for (const ev of info.eventos) {
          if (ev.tipo === 'ignition_on') {
            ultimoOn = ev.ts
          } else if (ev.tipo === 'ignition_off' && ultimoOn != null) {
            horas += (ev.ts - ultimoOn) / 3_600_000
            ultimoOn = null
          }
        }
        horasLigadoMap.set(vid, horas)
      }

      // Compute movement hours per vehicle (approximate: count distinct 1-min intervals with speed > 0)
      const movPorVeiculo = new Map<string, Set<number>>()
      for (const p of posMovimento ?? []) {
        if (!p.veiculo_id) continue
        if (!movPorVeiculo.has(p.veiculo_id)) {
          movPorVeiculo.set(p.veiculo_id, new Set())
        }
        // Round to minute for dedup
        const minuto = Math.floor(new Date(p.cobli_ts).getTime() / 60_000)
        movPorVeiculo.get(p.veiculo_id)!.add(minuto)
      }

      // Merge all vehicle IDs
      const todosVeiculos = new Set([...ignicaoPorVeiculo.keys(), ...movPorVeiculo.keys()])
      const veiculoIds = Array.from(todosVeiculos)
      if (veiculoIds.length === 0) return []

      const { data: veiculos } = await supabase
        .from('fro_veiculos')
        .select('id, placa, marca, modelo')
        .in('id', veiculoIds)

      const veiculoMap = new Map((veiculos ?? []).map(v => [v.id, v]))

      const resultado: TelUtilizacao[] = []
      for (const vid of veiculoIds) {
        const v = veiculoMap.get(vid)
        const info = ignicaoPorVeiculo.get(vid)
        const horas_ligado = horasLigadoMap.get(vid) ?? 0
        const horas_movimento = (movPorVeiculo.get(vid)?.size ?? 0) / 60 // minutes to hours

        resultado.push({
          veiculo_id: vid,
          placa: v?.placa ?? info?.placa ?? '',
          marca: v?.marca ?? '',
          modelo: v?.modelo ?? '',
          horas_ligado: Math.round(horas_ligado * 100) / 100,
          horas_movimento: Math.round(horas_movimento * 100) / 100,
          horas_total: Math.round(horas_total * 100) / 100,
          pct_utilizacao: horas_total > 0 ? Math.round((horas_ligado / horas_total) * 10000) / 100 : 0,
          pct_ocioso: horas_ligado > 0
            ? Math.round(((horas_ligado - horas_movimento) / horas_ligado) * 10000) / 100
            : 0,
        })
      }

      return resultado.sort((a, b) => b.pct_utilizacao - a.pct_utilizacao)
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
