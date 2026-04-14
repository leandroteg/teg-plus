import { useState, useMemo, useEffect } from 'react'
import { Search, Radio, ChevronLeft, ChevronRight } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from '../../../contexts/ThemeContext'
import { useUltimasPosicoes } from '../../../hooks/useTelemetria'
import { useVeiculos } from '../../../hooks/useFrotas'
import type { TelUltimaPosicao } from '../../../types/telemetria'

// Fix leaflet default icon issue (safely)
try {
  delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
} catch { /* leaflet not ready */ }

// ── Marker colors ───────────────────────────────────────────────────────────

function getStatusColor(pos: TelUltimaPosicao): string {
  if (!pos.ignicao) return '#6b7280'          // gray — off
  if (pos.velocidade > 0) return '#22c55e'    // green — moving
  return '#eab308'                             // yellow — idle
}

function getStatusLabel(pos: TelUltimaPosicao): string {
  if (!pos.ignicao) return 'Desligado'
  if (pos.velocidade > 0) return 'Em movimento'
  return 'Ocioso'
}

function createMarkerIcon(color: string, placa: string, statusLabel: string, velocidade: number) {
  const html = `
    <div style="position:relative;display:flex;align-items:center;gap:4px;white-space:nowrap;">
      <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
        <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.9"/>
        <circle cx="14" cy="14" r="5" fill="white" opacity="0.8"/>
      </svg>
      <div style="background:white;border-radius:6px;padding:2px 6px;box-shadow:0 1px 4px rgba(0,0,0,0.18);font-size:10px;line-height:1.3;pointer-events:none;">
        <b style="font-size:11px">${placa}</b>
        <span style="margin-left:3px;padding:1px 4px;border-radius:3px;background:${color}22;color:${color};font-weight:700;font-size:9px">${statusLabel}</span>
        ${velocidade > 0 ? `<span style="margin-left:3px;color:#64748b;font-size:9px">${velocidade} km/h</span>` : ''}
      </div>
    </div>`
  return L.divIcon({
    className: '',
    html,
    iconSize: [160, 28],
    iconAnchor: [14, 14],
    popupAnchor: [60, -16],
  })
}

// ── Relative time ───────────────────────────────────────────────────────────

function tempoRelativo(ts: string): string {
  const agora = Date.now()
  const diff = agora - new Date(ts).getTime()
  const seg = Math.floor(diff / 1000)
  if (seg < 60) return 'agora'
  const min = Math.floor(seg / 60)
  if (min < 60) return `há ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `há ${hrs}h`
  const dias = Math.floor(hrs / 24)
  return `há ${dias}d`
}

// ── Auto-fit bounds ─────────────────────────────────────────────────────────

function FitBounds({ positions }: { positions: TelUltimaPosicao[] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length === 0) return
    const bounds = L.latLngBounds(
      positions.map(p => [p.latitude, p.longitude] as [number, number])
    )
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [positions, map])

  return null
}

// ── Fly to selected ─────────────────────────────────────────────────────────

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (!position) return
    map.flyTo(position, 15, { duration: 0.8 })
  }, [position, map])

  return null
}

// ── Component ───────────────────────────────────────────────────────────────

export default function MapaAoVivo() {
  const { isLightSidebar: isLight } = useTheme()
  const { data: posicoes = [], isLoading } = useUltimasPosicoes()
  const { data: veiculos = [] } = useVeiculos()
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [sidebarAberta, setSidebarAberta] = useState(true)

  // Map veiculos by id for quick lookup
  const veiculoMap = useMemo(
    () => new Map(veiculos.map(v => [v.id, v])),
    [veiculos],
  )

  // Filter positions by search
  const posicoesFiltradas = useMemo(() => {
    if (!busca.trim()) return posicoes
    const termo = busca.toLowerCase()
    return posicoes.filter(p => {
      const v = veiculoMap.get(p.veiculo_id)
      return (
        p.placa.toLowerCase().includes(termo) ||
        (v && `${v.marca} ${v.modelo}`.toLowerCase().includes(termo))
      )
    })
  }, [posicoes, busca, veiculoMap])

  // Fly-to position when selecting a vehicle
  const flyToPosition = useMemo<[number, number] | null>(() => {
    if (!selecionado) return null
    const pos = posicoes.find(p => p.veiculo_id === selecionado)
    return pos ? [pos.latitude, pos.longitude] : null
  }, [selecionado, posicoes])

  // Status counters
  const contadores = useMemo(() => {
    let movendo = 0, ocioso = 0, desligado = 0
    for (const p of posicoes) {
      if (!p.ignicao) desligado++
      else if (p.velocidade > 0) movendo++
      else ocioso++
    }
    return { movendo, ocioso, desligado }
  }, [posicoes])

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!isLoading && posicoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Radio size={40} className={`mb-3 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
        <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          Aguardando dados de telemetria...
        </p>
      </div>
    )
  }

  const cardCls = isLight
    ? 'bg-white border border-slate-200 shadow-sm'
    : 'bg-[#1e293b] border border-white/[0.06]'

  return (
    <div className={`flex rounded-2xl overflow-hidden h-[520px] relative ${cardCls}`}>
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className={`flex flex-col shrink-0 border-r transition-all duration-300 ${
        sidebarAberta ? 'w-72' : 'w-0 border-r-0 overflow-hidden'
      } ${isLight ? 'border-slate-200' : 'border-white/[0.06]'}`}>
        {/* Search */}
        <div className="p-3">
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/[0.04] border border-white/[0.08]'
          }`}>
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              className={`flex-1 bg-transparent outline-none placeholder:text-slate-400 ${
                isLight ? 'text-slate-800' : 'text-white'
              }`}
              placeholder="Buscar placa..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
        </div>

        {/* Status tags */}
        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {contadores.movendo}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-700 dark:text-yellow-300">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            {contadores.ocioso}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            {contadores.desligado}
          </span>
        </div>

        {/* Vehicle list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`rounded-xl h-12 animate-pulse ${isLight ? 'bg-slate-100' : 'bg-white/[0.04]'}`} />
              ))
            : posicoesFiltradas.map(pos => {
                const v = veiculoMap.get(pos.veiculo_id)
                const color = getStatusColor(pos)
                const ativo = selecionado === pos.veiculo_id

                return (
                  <button
                    key={pos.veiculo_id}
                    onClick={() => setSelecionado(ativo ? null : pos.veiculo_id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${
                      ativo
                        ? isLight ? 'bg-orange-50 border border-orange-200' : 'bg-orange-500/10 border border-orange-500/25'
                        : isLight ? 'hover:bg-slate-50 border border-transparent' : 'hover:bg-white/[0.04] border border-transparent'
                    }`}
                  >
                    <span
                      className="shrink-0 w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {pos.placa}
                      </p>
                      {v && (
                        <p className="text-[10px] text-slate-500 truncate">
                          {v.marca} {v.modelo}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: color + '22', color }}>
                        {getStatusLabel(pos)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {tempoRelativo(pos.cobli_ts)}
                      </span>
                    </div>
                  </button>
                )
              })
          }
        </div>

        {/* Summary */}
        <div className={`px-3 py-2 text-[10px] font-bold border-t ${isLight ? 'border-slate-200 text-slate-400' : 'border-white/[0.06] text-slate-500'}`}>
          {posicoesFiltradas.length} veículo{posicoesFiltradas.length !== 1 ? 's' : ''}
          {busca.trim() && ` (filtrado de ${posicoes.length})`}
        </div>
      </div>

      {/* ── Toggle sidebar button ────────────────────────────────────────── */}
      <button
        onClick={() => setSidebarAberta(!sidebarAberta)}
        className={`absolute top-3 z-[1000] rounded-lg p-1.5 shadow-md transition-all ${
          sidebarAberta ? 'left-[276px]' : 'left-3'
        } ${isLight
          ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          : 'bg-[#1e293b] border border-white/[0.1] text-slate-300 hover:bg-white/[0.06]'
        }`}
      >
        {sidebarAberta ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* ── Map ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <MapContainer
          center={[-15.77, -47.93]}
          zoom={5}
          className="h-full w-full z-0"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds positions={posicoesFiltradas} />
          <FlyTo position={flyToPosition} />

          {posicoesFiltradas.map(pos => {
            const v = veiculoMap.get(pos.veiculo_id)
            const color = getStatusColor(pos)
            const label = getStatusLabel(pos)
            const selected = selecionado === pos.veiculo_id
            return (
              <Marker
                key={pos.veiculo_id}
                position={[pos.latitude, pos.longitude]}
                icon={createMarkerIcon(color, pos.placa, label, pos.velocidade)}
                zIndexOffset={selected ? 1000 : 0}
                eventHandlers={{
                  click: () => setSelecionado(selected ? null : pos.veiculo_id),
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1.5 min-w-[170px]">
                    <p className="font-bold text-sm text-slate-800">{pos.placa}</p>
                    {v && <p className="text-slate-500">{v.marca} {v.modelo}</p>}
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{pos.velocidade} km/h</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: color + '22', color }}>
                        {label}
                      </span>
                    </div>
                    {pos.hodometro != null && (
                      <p className="text-slate-400">Hodometro: {Math.round(pos.hodometro).toLocaleString('pt-BR')} km</p>
                    )}
                    <p className="text-slate-400">{tempoRelativo(pos.cobli_ts)}</p>
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
