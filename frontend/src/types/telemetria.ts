// ─────────────────────────────────────────────────────────────────────────────
// types/telemetria.ts — Módulo Telemetria (Logística)
// ─────────────────────────────────────────────────────────────────────────────

// Provedor de telemetria (multi-provedor: Cobli + Mobi7 + futuros)
// Linhas antigas são DEFAULT 'cobli' no banco (compatível).
export type TelProvider = 'cobli' | 'mobi7'

// Position record from tel_posicoes table
export interface TelPosicao {
  id: string
  veiculo_id: string | null
  placa: string
  latitude: number
  longitude: number
  velocidade: number
  ignicao: boolean
  hodometro: number | null
  evento: string
  cobli_ts: string
  created_at: string
  provider?: TelProvider
}

// Latest position per vehicle (from tel_ultima_posicao view)
export interface TelUltimaPosicao {
  veiculo_id: string
  placa: string
  latitude: number
  longitude: number
  velocidade: number
  ignicao: boolean
  hodometro: number | null
  cobli_ts: string
  provider?: TelProvider
}

// Tipos de evento de telemetria — Cobli + Mobi7
export type TipoEventoTel =
  // Cobli
  | 'ignition_on' | 'ignition_off'
  | 'geofence_enter' | 'geofence_exit'
  | 'speed_alert'
  | 'hard_brake' | 'hard_acceleration' | 'hard_cornering'
  | 'low_external_battery' | 'disconnected_external_battery' | 'reconnected_external_battery'
  | 'desvio_rota'
  // Mobi7 (ofensas/comportamentos)
  | 'speeding'
  | 'acceleration_light' | 'acceleration_medium' | 'acceleration_high'
  | 'braking_light' | 'braking_medium' | 'braking_high'
  | 'cornering'

// Event record from tel_eventos table
export interface TelEvento {
  id: string
  veiculo_id: string | null
  placa: string
  tipo_evento: TipoEventoTel
  latitude: number | null
  longitude: number | null
  velocidade: number | null
  dados_extra: Record<string, unknown>
  cobli_ts: string
  created_at: string
  veiculo?: { id: string; placa: string; marca: string; modelo: string }
  provider?: TelProvider
}

// KM per vehicle
export interface TelKmVeiculo {
  veiculo_id: string
  placa: string
  marca: string
  modelo: string
  km_inicio: number
  km_fim: number
  km_percorrido: number
}

// Utilization per vehicle
export interface TelUtilizacao {
  veiculo_id: string
  placa: string
  marca: string
  modelo: string
  horas_ligado: number
  horas_movimento: number
  horas_total: number
  pct_utilizacao: number
  pct_ocioso: number
  // Contagem de dias distintos com ao menos um evento de ignicao ligada
  dias_uso: number
  // Total de dias uteis (seg-sex) no periodo selecionado
  dias_uteis_periodo: number
  // Dias uteis em que esse veiculo teve dados (descontando inicio da base / quedas)
  dias_uteis_ajustado: number
  // Dias uteis sem dados (= dias_uteis_periodo - dias_uteis_ajustado)
  dias_sem_dados: number
  // dias_uso / dias_uteis_ajustado * 100 (clamped a 100)
  pct_alocacao: number
}

// KPIs summary
export interface TelemetriaKPIs {
  total_com_posicao: number
  em_movimento: number
  alertas_hoje: number
  km_hoje: number
}
