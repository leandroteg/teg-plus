import type {
  LogSolicitacao,
  LogViagem,
  LogViagemRotaEtapa,
  LogViagemRotaPayload,
} from '../types/logistica'

export interface ViagemEtapaDetalhada extends LogViagemRotaEtapa {
  solicitacao?: LogSolicitacao
  eta_previsto?: string
}

function toPositiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function parseViagemRotaPayload(raw?: string | null): LogViagemRotaPayload | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<LogViagemRotaPayload>
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.etapas)) {
      return null
    }

    const etapas = parsed.etapas
      .map((etapa, index) => ({
        solicitacao_id: etapa?.solicitacao_id,
        ordem: toPositiveNumber(etapa?.ordem) ?? index + 1,
        origem: String(etapa?.origem ?? ''),
        destino: String(etapa?.destino ?? ''),
        distancia_km: toPositiveNumber(etapa?.distancia_km),
        duracao_horas: toPositiveNumber(etapa?.duracao_horas),
      }))
      .filter(etapa => etapa.origem || etapa.destino)

    return {
      version: 1,
      polyline: typeof parsed.polyline === 'string' ? parsed.polyline : undefined,
      distancia_total_km: toPositiveNumber(parsed.distancia_total_km),
      duracao_total_horas: toPositiveNumber(parsed.duracao_total_horas),
      etapas,
    }
  } catch {
    return null
  }
}

export function serializeViagemRotaPayload(payload: LogViagemRotaPayload): string {
  return JSON.stringify(payload)
}

function buildFallbackEtapas(viagem: Partial<LogViagem> | undefined, solicitacoes: LogSolicitacao[]): LogViagemRotaEtapa[] {
  const ordered = [...solicitacoes].sort((a, b) => (a.ordem_na_viagem ?? 0) - (b.ordem_na_viagem ?? 0))
  const count = ordered.length || 1
  const distancePerStage = toPositiveNumber(viagem?.distancia_total_km) ? Number(viagem?.distancia_total_km) / count : undefined
  const durationPerStage = toPositiveNumber(viagem?.tempo_estimado_h) ? Number(viagem?.tempo_estimado_h) / count : undefined

  return ordered.map((sol, index) => ({
    solicitacao_id: sol.id,
    ordem: sol.ordem_na_viagem ?? index + 1,
    origem: sol.origem,
    destino: sol.destino,
    distancia_km: distancePerStage,
    duracao_horas: durationPerStage,
  }))
}

export function buildViagemEtapas(viagem: Partial<LogViagem> | undefined, solicitacoes: LogSolicitacao[]): ViagemEtapaDetalhada[] {
  const ordered = [...solicitacoes].sort((a, b) => (a.ordem_na_viagem ?? 0) - (b.ordem_na_viagem ?? 0))
  const routePayload = parseViagemRotaPayload(viagem?.rota_polyline)
  const routeEtapas = routePayload?.etapas?.length ? routePayload.etapas : buildFallbackEtapas(viagem, ordered)

  return ordered.map((sol, index) => {
    const etapa = routeEtapas.find(item => item.solicitacao_id === sol.id)
      ?? routeEtapas.find(item => item.ordem === (sol.ordem_na_viagem ?? index + 1))
      ?? buildFallbackEtapas(viagem, [sol])[0]

    return {
      ...etapa,
      ordem: sol.ordem_na_viagem ?? etapa.ordem ?? index + 1,
      origem: etapa.origem || sol.origem,
      destino: etapa.destino || sol.destino,
      solicitacao: sol,
    }
  })
}

export function applyEtasToEtapas(etapas: ViagemEtapaDetalhada[], departureIso?: string | null): ViagemEtapaDetalhada[] {
  if (!departureIso) return etapas

  const departure = new Date(departureIso)
  if (Number.isNaN(departure.getTime())) return etapas

  let accumulatedMs = 0

  return etapas.map(etapa => {
    const durationHours = toPositiveNumber(etapa.duracao_horas) ?? 0
    accumulatedMs += durationHours * 60 * 60 * 1000
    return {
      ...etapa,
      eta_previsto: new Date(departure.getTime() + accumulatedMs).toISOString(),
    }
  })
}

export function getViagemResumo(viagem: Partial<LogViagem> | undefined, etapas: ViagemEtapaDetalhada[]) {
  const routePayload = parseViagemRotaPayload(viagem?.rota_polyline)
  const distancia = toPositiveNumber(routePayload?.distancia_total_km) ?? toPositiveNumber(viagem?.distancia_total_km)
  const duracao = toPositiveNumber(routePayload?.duracao_total_horas) ?? toPositiveNumber(viagem?.tempo_estimado_h)

  return {
    distancia_total_km: distancia ?? etapas.reduce((sum, etapa) => sum + (toPositiveNumber(etapa.distancia_km) ?? 0), 0),
    duracao_total_horas: duracao ?? etapas.reduce((sum, etapa) => sum + (toPositiveNumber(etapa.duracao_horas) ?? 0), 0),
  }
}
