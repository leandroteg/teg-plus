// ─────────────────────────────────────────────────────────────────────────────
// types/telemetria.ts — Módulo Telemetria (Logística)
// ─────────────────────────────────────────────────────────────────────────────

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
}

// Cobli event types
export type TipoEventoTel =
  | 'ignition_on' | 'ignition_off'
  | 'geofence_enter' | 'geofence_exit'
  | 'speed_alert'
  | 'hard_brake' | 'hard_acceleration' | 'hard_cornering'
  | 'low_external_battery' | 'disconnected_external_battery' | 'reconnected_external_battery'
  | 'desvio_rota'

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
  // dias_uso / dias_uteis_periodo * 100 (clamped a 100)
  pct_alocacao: number
}

// KPIs summary
export interface TelemetriaKPIs {
  total_com_posicao: number
  em_movimento: number
  alertas_hoje: number
  km_hoje: number
}
