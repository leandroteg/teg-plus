import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  X, MapPin, Navigation, Clock, Ruler, Truck, Save, Loader2,
  Search, Package2, Route, Plus, Trash2, GripVertical, ArrowRight, ArrowUp, ArrowDown,
  Building2, ChevronDown, Zap, AlertTriangle, Calendar,
} from 'lucide-react'
import type { LogSolicitacao } from '../../types/logistica'
import { useVeiculos } from '../../hooks/useFrotas'
import type { FroVeiculo } from '../../types/frotas'

// ── Leaflet imports ──────────────────────────────────────────────────────────
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { serializeViagemRotaPayload } from '../../utils/logisticaViagem'

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const N8N_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook'

// ── Types ────────────────────────────────────────────────────────────────────

interface EnderecoSugestao {
  descricao: string
  logradouro?: string
  bairro?: string
  cidade: string
  uf: string
  cep?: string
  lat?: number
  lng?: number
}

interface PontoRota {
  id: string
  solicitacao?: LogSolicitacao
  endereco_origem: string
  endereco_destino: string
  lat_origem?: number
  lng_origem?: number
  lat_destino?: number
  lng_destino?: number
  distancia_km?: number
  duracao_horas?: number
}

interface RotaCalculada {
  distancia_total_km: number
  duracao_total_horas: number
  pontos: Array<{ lat: number; lng: number }>
  polyline?: string
}

interface WaypointStop {
  lat: number
  lng: number
  label: string
}

interface WaypointPlan {
  stops: WaypointStop[]
  legRanges: Array<{ startLegIndex: number; endLegIndexExclusive: number }>
}

interface Props {
  isDark: boolean
  solicitacoes: LogSolicitacao[]  // Solicitações selecionadas para planejar
  allSolicitacoes: LogSolicitacao[]  // Todas as solicitações pendentes (para adicionar)
  onClose: () => void
  onSave: (data: {
    solicitacaoIds: string[]
    rota: PontoRota[]
    distancia_total_km: number
    duracao_total_horas: number
    modal?: string
    motorista_nome?: string
    motorista_telefone?: string
    veiculo_placa?: string
    data_prevista_saida?: string
    custo_estimado?: number
    origem_principal?: string
    destino_final?: string
    rota_polyline?: string
  }) => Promise<void>
  /** Dados iniciais para pré-preencher quando editando planejamento existente */
  initialData?: {
    modal?: string
    motorista_nome?: string
    veiculo_placa?: string
    data_prevista_saida?: string
    custo_estimado?: number
  }
}

// ── Custom marker icons ──────────────────────────────────────────────────────

function createIcon(color: string, label?: string) {
  return L.divIcon({
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
    html: `<div style="
      position:relative;width:32px;height:40px;display:flex;align-items:flex-start;justify-content:center;
    ">
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="8" fill="white" opacity="0.9"/>
      </svg>
      ${label ? `<span style="
        position:absolute;top:8px;left:0;width:32px;text-align:center;
        font-size:11px;font-weight:800;color:${color};
      ">${label}</span>` : ''}
    </div>`,
  })
}

function toRadians(value: number) {
  return value * Math.PI / 180
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const originLat = toRadians(a.lat)
  const destLat = toRadians(b.lat)
  const angle =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destLat) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(angle), Math.sqrt(1 - angle))
}

function normalizeStopLabel(value?: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function sameStop(
  a: { lat?: number; lng?: number; label?: string },
  b: { lat?: number; lng?: number; label?: string },
) {
  if (typeof a.lat === 'number' && typeof a.lng === 'number' && typeof b.lat === 'number' && typeof b.lng === 'number') {
    return haversineKm({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) <= 5
  }
  return normalizeStopLabel(a.label) !== '' && normalizeStopLabel(a.label) === normalizeStopLabel(b.label)
}

function originStopOf(ponto: PontoRota) {
  return {
    lat: ponto.lat_origem,
    lng: ponto.lng_origem,
    label: ponto.endereco_origem || ponto.solicitacao?.origem || '',
  }
}

function destinoStopOf(ponto: PontoRota) {
  return {
    lat: ponto.lat_destino,
    lng: ponto.lng_destino,
    label: ponto.endereco_destino || ponto.solicitacao?.destino || '',
  }
}

function optimizePontosOrder(pontos: PontoRota[]) {
  if (pontos.length <= 1) return pontos

  const indexed = pontos.map((ponto, index) => ({ ponto, index }))
  const remaining = [...indexed]
  const ordered: typeof indexed = []

  const startingCandidates = indexed.filter(candidate =>
    !indexed.some(other =>
      other.ponto.id !== candidate.ponto.id &&
      sameStop(destinoStopOf(other.ponto), originStopOf(candidate.ponto))
    )
  )

  const start =
    startingCandidates.sort((a, b) => a.index - b.index)[0]
    ?? indexed[0]

  ordered.push(start)
  remaining.splice(remaining.findIndex(item => item.ponto.id === start.ponto.id), 1)

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1].ponto
    const currentDestino = destinoStopOf(current)

    const next = remaining
      .map(candidate => {
        const candidateOrigem = originStopOf(candidate.ponto)
        const exactMatch = sameStop(currentDestino, candidateOrigem)
        const deadheadKm =
          typeof currentDestino.lat === 'number' &&
          typeof currentDestino.lng === 'number' &&
          typeof candidateOrigem.lat === 'number' &&
          typeof candidateOrigem.lng === 'number'
            ? haversineKm(
                { lat: currentDestino.lat, lng: currentDestino.lng },
                { lat: candidateOrigem.lat, lng: candidateOrigem.lng },
              )
            : exactMatch
              ? 0
              : Number.POSITIVE_INFINITY

        return { ...candidate, exactMatch, deadheadKm }
      })
      .sort((a, b) => {
        if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1
        if (a.deadheadKm !== b.deadheadKm) return a.deadheadKm - b.deadheadKm
        return a.index - b.index
      })[0]

    ordered.push(next)
    remaining.splice(remaining.findIndex(item => item.ponto.id === next.ponto.id), 1)
  }

  return ordered.map(item => item.ponto)
}

function buildWaypointPlan(pontos: PontoRota[]): WaypointPlan {
  const stops: WaypointStop[] = []
  const legRanges: WaypointPlan['legRanges'] = []

  const pushStop = (stop: WaypointStop) => {
    const last = stops[stops.length - 1]
    if (!last || !sameStop(last, stop)) {
      stops.push(stop)
    }
    return stops.length - 1
  }

  pontos.forEach(ponto => {
    const origem = originStopOf(ponto)
    const destino = destinoStopOf(ponto)

    if (typeof origem.lat !== 'number' || typeof origem.lng !== 'number' || typeof destino.lat !== 'number' || typeof destino.lng !== 'number') {
      return
    }

    const origemIndex = pushStop({
      lat: origem.lat,
      lng: origem.lng,
      label: origem.label,
    })
    const destinoIndex = pushStop({
      lat: destino.lat,
      lng: destino.lng,
      label: destino.label,
    })

    legRanges.push({
      startLegIndex: origemIndex,
      endLegIndexExclusive: destinoIndex,
    })
  })

  return { stops, legRanges }
}

// ── Map bounds fitter ────────────────────────────────────────────────────────

function MapFitter({ points }: { points: Array<{ lat: number; lng: number }> }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 })
  }, [map, points])
  return null
}

// ── Address Autocomplete Input (Endereço + CEP) ─────────────────────────────

function EnderecoInput({
  value,
  onChange,
  onSelect,
  isDark,
  label,
  icon: Icon,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (s: EnderecoSugestao) => void
  isDark: boolean
  label: string
  icon: typeof MapPin
}) {
  const [sugestoes, setSugestoes] = useState<EnderecoSugestao[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'endereco' | 'cep'>('endereco')
  const [cepValue, setCepValue] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const abortRef = useRef<AbortController>()
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Buscar endereço via Nominatim (gratuito, sem API key) ────────────────
  const buscarEndereco = useCallback(async (query: string) => {
    if (query.length < 3) { setSugestoes([]); setOpen(false); return }

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    try {
      // Tenta n8n primeiro (timeout curto de 3s para não bloquear fallback)
      try {
        const n8nAbort = new AbortController()
        const n8nTimer = setTimeout(() => n8nAbort.abort(), 3000)
        // Also abort if parent aborts
        abortRef.current.signal.addEventListener('abort', () => n8nAbort.abort())
        const res = await fetch(`${N8N_URL}/logistica/autocomplete-endereco`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, pais: 'BR' }),
          signal: n8nAbort.signal,
        })
        clearTimeout(n8nTimer)
        if (res.ok) {
          const json = await res.json()
          const resultados = json.sugestoes || json.results || []
          if (resultados.length > 0) {
            setSugestoes(resultados)
            setOpen(true)
            return
          }
        }
      } catch (e) {
        if (abortRef.current?.signal.aborted) return
      }

      // Fallback: Nominatim OpenStreetMap (gratuito)
      const encoded = encodeURIComponent(query)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&addressdetails=1&limit=6&countrycodes=br`,
        { signal: abortRef.current.signal, headers: { 'Accept-Language': 'pt-BR' } }
      )
      if (res.ok) {
        const data = await res.json() as Array<{
          display_name: string; lat: string; lon: string
          address?: { road?: string; suburb?: string; city?: string; town?: string; state?: string; postcode?: string }
        }>
        const resultados: EnderecoSugestao[] = data.map(d => ({
          descricao: d.display_name.replace(/, Brasil$/i, ''),
          logradouro: d.address?.road,
          bairro: d.address?.suburb,
          cidade: d.address?.city || d.address?.town || '',
          uf: d.address?.state || '',
          cep: d.address?.postcode,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        }))
        setSugestoes(resultados)
        setOpen(resultados.length > 0)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Buscar por CEP ────────────────────────────────────────────────────────
  const buscarCep = useCallback(async (cep: string) => {
    const limpo = cep.replace(/\D/g, '')
    if (limpo.length < 5) { setSugestoes([]); setOpen(false); return }

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    try {
      // Tenta n8n primeiro (timeout curto de 3s)
      try {
        const n8nAbort = new AbortController()
        const n8nTimer = setTimeout(() => n8nAbort.abort(), 3000)
        abortRef.current.signal.addEventListener('abort', () => n8nAbort.abort())
        const res = await fetch(`${N8N_URL}/logistica/consulta-cep`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cep: limpo }),
          signal: n8nAbort.signal,
        })
        clearTimeout(n8nTimer)
        if (res.ok) {
          const json = await res.json()
          if (json.cidade || json.city) {
            const sug: EnderecoSugestao = {
              descricao: json.descricao || `${json.logradouro || json.street || ''}, ${json.bairro || json.neighborhood || ''}, ${json.cidade || json.city} - ${json.uf || json.state}`,
              logradouro: json.logradouro || json.street,
              bairro: json.bairro || json.neighborhood,
              cidade: json.cidade || json.city || '',
              uf: json.uf || json.state || '',
              cep: json.cep || limpo,
              lat: json.lat || json.latitude,
              lng: json.lng || json.longitude,
            }
            setSugestoes([sug])
            setOpen(true)
            return
          }
        }
      } catch (e) {
        if (abortRef.current?.signal.aborted) return
      }

      // Fallback: BrasilAPI direto
      if (limpo.length === 8) {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${limpo}`, { signal: abortRef.current.signal })
        if (res.ok) {
          const d = await res.json()
          const desc = [d.street, d.neighborhood, d.city ? `${d.city} - ${d.state}` : ''].filter(Boolean).join(', ')
          const sug: EnderecoSugestao = {
            descricao: desc,
            logradouro: d.street,
            bairro: d.neighborhood,
            cidade: d.city,
            uf: d.state,
            cep: d.cep,
            lat: d.location?.coordinates?.latitude,
            lng: d.location?.coordinates?.longitude,
          }
          setSugestoes([sug])
          setOpen(true)

          // Se não tem lat/lng, geocodificar via Nominatim
          if (!sug.lat && desc) {
            try {
              const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(desc + ', Brasil')}&format=json&limit=1`,
                { headers: { 'Accept-Language': 'pt-BR' } }
              )
              if (geoRes.ok) {
                const [geo] = await geoRes.json()
                if (geo) {
                  sug.lat = parseFloat(geo.lat)
                  sug.lng = parseFloat(geo.lon)
                  setSugestoes([{ ...sug }])
                }
              }
            } catch { /* silent */ }
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced handlers
  const handleEnderecoChange = (v: string) => {
    onChange(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscarEndereco(v), 300)
  }

  const handleCepChange = (v: string) => {
    // Format CEP: 01234-567
    const digits = v.replace(/\D/g, '').slice(0, 8)
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
    setCepValue(formatted)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscarCep(digits), 300)
  }

  const handleSelect = (s: EnderecoSugestao) => {
    const desc = s.descricao || `${s.logradouro || ''}, ${s.bairro || ''}, ${s.cidade} - ${s.uf}`.replace(/^, /, '')
    onSelect(s)
    onChange(desc)
    if (s.cep) setCepValue(s.cep.replace(/(\d{5})(\d{3})/, '$1-$2'))
    setOpen(false)
    setSugestoes([])
  }

  const inputClass = `w-full pl-3 pr-9 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
    isDark
      ? 'bg-white/[0.06] border-white/[0.08] text-slate-200 focus:ring-orange-500/30 focus:border-orange-500/50 placeholder-slate-600'
      : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-orange-500/20 focus:border-orange-400 placeholder-slate-400'
  }`

  const tabClass = (active: boolean) => `px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
    active
      ? 'bg-orange-500 text-white shadow-sm'
      : isDark
        ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]'
        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
  }`

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          <Icon size={11} /> {label}
        </label>
        {/* Toggle: Endereço / CEP */}
        <div className={`flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
          <button type="button" onClick={() => setMode('endereco')} className={tabClass(mode === 'endereco')}>
            Endereço
          </button>
          <button type="button" onClick={() => setMode('cep')} className={tabClass(mode === 'cep')}>
            CEP
          </button>
        </div>
      </div>

      {mode === 'endereco' ? (
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={e => handleEnderecoChange(e.target.value)}
            onFocus={() => sugestoes.length > 0 && setOpen(true)}
            placeholder="Rua, Av, Cidade... (autocomplete)"
            className={inputClass}
          />
          <button type="button"
            onClick={() => { if (value.length >= 3) buscarEndereco(value) }}
            disabled={loading || value.length < 3}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-all disabled:opacity-30 hover:bg-orange-100 dark:hover:bg-orange-500/20">
            {loading ? (
              <Loader2 size={14} className="animate-spin text-orange-500" />
            ) : (
              <Search size={13} className={`${isDark ? 'text-slate-500 hover:text-orange-400' : 'text-slate-400 hover:text-orange-600'} transition-colors`} />
            )}
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={cepValue}
            onChange={e => handleCepChange(e.target.value)}
            onFocus={() => sugestoes.length > 0 && setOpen(true)}
            placeholder="01234-567"
            maxLength={9}
            className={inputClass}
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {loading ? (
              <Loader2 size={14} className="animate-spin text-orange-500" />
            ) : (
              <Building2 size={13} className={isDark ? 'text-slate-600' : 'text-slate-400'} />
            )}
          </div>
        </div>
      )}

      {/* Show resolved address below CEP input */}
      {mode === 'cep' && value && (
        <div className={`mt-1 text-[11px] px-2 py-1 rounded-lg truncate ${
          isDark ? 'bg-white/[0.03] text-slate-400' : 'bg-slate-50 text-slate-500'
        }`}>
          <MapPin size={10} className="inline mr-1 text-orange-400" />{value}
        </div>
      )}

      {/* Dropdown sugestões */}
      {open && sugestoes.length > 0 && (
        <div className={`absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-2xl border max-h-52 overflow-y-auto ${
          isDark ? 'bg-[#1e293b] border-white/[0.1]' : 'bg-white border-slate-200'
        }`} style={{ animation: 'fadeIn 0.15s ease-out' }}>
          {sugestoes.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelect(s)}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-start gap-2.5 transition-all ${
                isDark ? 'hover:bg-orange-500/10 text-slate-300' : 'hover:bg-orange-50 text-slate-700'
              } ${i > 0 ? isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-100' : ''}`}
            >
              <div className={`mt-0.5 p-1 rounded-md shrink-0 ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
                <MapPin size={12} className="text-orange-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{s.descricao || `${s.cidade} - ${s.uf}`}</div>
                <div className={`text-[11px] mt-0.5 flex items-center gap-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {s.cep && <span>CEP: {s.cep}</span>}
                  {s.cidade && <span>{s.cidade}{s.uf ? ` - ${s.uf}` : ''}</span>}
                  {s.lat != null && <span className="text-emerald-500">📍</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dados do Transporte (com integração Frotas) ─────────────────────────────

function DadosTransporte({ isDark, modal, setModal, motorista, setMotorista, placa, setPlaca, dataPartida, setDataPartida, custo, setCusto }: {
  isDark: boolean
  modal: string; setModal: (v: string) => void
  motorista: string; setMotorista: (v: string) => void
  placa: string; setPlaca: (v: string) => void
  dataPartida: string; setDataPartida: (v: string) => void
  custo: number | ''; setCusto: (v: number | '') => void
}) {
  const isFrota = modal === 'frota_propria' || modal === 'frota_locada'
  const { data: veiculos } = useVeiculos(isFrota ? undefined : { status: 'disponivel' as never })
  const [veiculoQuery, setVeiculoQuery] = useState('')
  const [veiculoOpen, setVeiculoOpen] = useState(false)
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<FroVeiculo | null>(null)
  const veiculoRef = useRef<HTMLDivElement>(null)

  // Click outside close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (veiculoRef.current && !veiculoRef.current.contains(e.target as Node)) setVeiculoOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filter & sort vehicles
  const veiculosFiltrados = useMemo(() => {
    if (!veiculos) return []
    const list = veiculos.filter(v =>
      v.status === 'disponivel' || v.status === 'em_uso'
    )
    if (!veiculoQuery) return list
    const q = veiculoQuery.toLowerCase()
    return list.filter(v =>
      v.placa.toLowerCase().includes(q) ||
      v.modelo.toLowerCase().includes(q) ||
      v.marca.toLowerCase().includes(q) ||
      (v.categoria && v.categoria.toLowerCase().includes(q))
    )
  }, [veiculos, veiculoQuery])

  const handleSelectVeiculo = (v: FroVeiculo) => {
    setVeiculoSelecionado(v)
    setPlaca(v.placa)
    setVeiculoQuery('')
    setVeiculoOpen(false)
    // Set modal based on propriedade
    if (v.propriedade === 'locada') setModal('frota_locada')
    else setModal('frota_propria')
  }

  const handleClearVeiculo = () => {
    setVeiculoSelecionado(null)
    setPlaca('')
    setMotorista('')
    setVeiculoQuery('')
  }

  const handleModalChange = (v: string) => {
    setModal(v)
    if (v !== 'frota_propria' && v !== 'frota_locada') {
      setVeiculoSelecionado(null)
      setVeiculoQuery('')
    }
  }

  const PROP_LABEL: Record<string, string> = { propria: 'Próprio', locada: 'Locado', cedida: 'Cedido' }
  const STATUS_COLORS: Record<string, string> = {
    disponivel: isDark ? 'text-emerald-400' : 'text-emerald-600',
    em_uso: isDark ? 'text-amber-400' : 'text-amber-600',
  }

  const fieldCls = `w-full px-3 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
    isDark
      ? 'bg-white/[0.06] border-white/[0.08] text-slate-200 focus:ring-orange-500/30 placeholder-slate-600'
      : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-orange-500/20 placeholder-slate-400'
  }`

  const labelCls = `text-[10px] font-bold uppercase tracking-wider mb-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`

  return (
    <div className={`p-4 border-t space-y-3 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
      <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        <Truck size={12} /> Dados do Transporte
      </h3>

      <div className="grid grid-cols-2 gap-2.5">
        {/* Modal */}
        <div className="col-span-2">
          <label className={labelCls}>Modal</label>
          <select value={modal} onChange={e => handleModalChange(e.target.value)}
            className={`${fieldCls} appearance-none cursor-pointer`}>
            <option value="">Selecione...</option>
            <option value="frota_propria">Frota Própria / Locada</option>
            <option value="transportadora">Transportadora</option>
            <option value="motoboy">Motoboy</option>
            <option value="correios">Correios</option>
          </select>
        </div>

        {/* Veículo selector — only when Frota */}
        {isFrota && (
          <div className="col-span-2" ref={veiculoRef}>
            <label className={labelCls}>Veículo</label>
            <div className="relative">
              {veiculoSelecionado ? (
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                  isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-sm font-bold ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                      {veiculoSelecionado.placa}
                    </span>
                    <span className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {veiculoSelecionado.marca} {veiculoSelecionado.modelo}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                      isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {PROP_LABEL[veiculoSelecionado.propriedade] || veiculoSelecionado.propriedade}
                    </span>
                  </div>
                  <button type="button" onClick={handleClearVeiculo}
                    className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-400'}`}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={veiculoQuery}
                    onChange={e => { setVeiculoQuery(e.target.value); setVeiculoOpen(true) }}
                    onFocus={() => setVeiculoOpen(true)}
                    placeholder="Buscar por placa, modelo ou marca..."
                    className={fieldCls}
                  />
                  <Search size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                </>
              )}

              {veiculoOpen && !veiculoSelecionado && (
                <div className={`absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-xl border max-h-56 overflow-y-auto ${
                  isDark ? 'bg-[#1e293b] border-white/10' : 'bg-white border-slate-200'
                }`} style={{ animation: 'fadeIn 0.15s ease-out' }}>
                  {veiculosFiltrados.length === 0 ? (
                    <div className={`px-3 py-3 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {veiculoQuery ? 'Nenhum veículo encontrado' : 'Carregando veículos...'}
                    </div>
                  ) : veiculosFiltrados.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleSelectVeiculo(v)}
                      className={`w-full text-left px-3 py-2.5 transition-colors flex items-center gap-3 ${
                        isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {v.placa}
                          </span>
                          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {v.marca} {v.modelo} {v.ano_mod || ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium ${STATUS_COLORS[v.status] || (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                            ● {v.status === 'disponivel' ? 'Disponível' : v.status === 'em_uso' ? 'Em uso' : v.status}
                          </span>
                          <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                            {PROP_LABEL[v.propriedade] || v.propriedade}
                          </span>
                          {v.capacidade_carga_kg && (
                            <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                              {v.capacidade_carga_kg.toLocaleString('pt-BR')} kg
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Motorista */}
        <div>
          <label className={labelCls}>Motorista</label>
          <input type="text" value={motorista} onChange={e => setMotorista(e.target.value)}
            placeholder="Nome" className={fieldCls} />
        </div>

        {/* Placa — readonly when vehicle selected, editable otherwise */}
        <div>
          <label className={labelCls}>Placa</label>
          <input type="text" value={placa}
            onChange={e => { if (!veiculoSelecionado) setPlaca(e.target.value.toUpperCase()) }}
            readOnly={!!veiculoSelecionado}
            placeholder="ABC-1234"
            className={`${fieldCls} ${veiculoSelecionado ? 'opacity-60 cursor-not-allowed' : ''}`} />
        </div>

        {/* Data partida */}
        <div>
          <label className={labelCls}>Saída prevista</label>
          <input type="datetime-local" value={dataPartida} onChange={e => setDataPartida(e.target.value)}
            className={fieldCls} />
        </div>

        {/* Custo */}
        <div>
          <label className={labelCls}>Custo estimado</label>
          <input type="number" min={0} step={0.01} value={custo} onChange={e => setCusto(e.target.value ? Number(e.target.value) : '')}
            placeholder="R$ 0,00" className={fieldCls} />
        </div>
      </div>
    </div>
  )
}

// ── Modal principal ──────────────────────────────────────────────────────────

export default function PlanejamentoRotaModal({ isDark, solicitacoes, allSolicitacoes, onClose, onSave, initialData }: Props) {
  // Estado: Pontos de rota (cada solicitação = 1 ponto com origem+destino)
  const [pontos, setPontos] = useState<PontoRota[]>(() =>
    solicitacoes.map(sol => ({
      id: sol.id,
      solicitacao: sol,
      endereco_origem: sol.origem || '',
      endereco_destino: sol.destino || '',
    }))
  )

  // Rota calculada — pré-popular com dados existentes da solicitação/viagem
  const [rota, setRota] = useState<RotaCalculada | null>(() => {
    const s = solicitacoes[0]
    if (s?.distancia_km || s?.tempo_estimado_h) {
      return {
        distancia_km: s.distancia_km ?? 0,
        tempo_estimado_h: s.tempo_estimado_h ?? 0,
        polyline: (s as any).rota_polyline || '',
        trechos: [],
      }
    }
    return null
  })
  const [calculando, setCalculando] = useState(false)

  // Planning fields — pré-preencher com initialData ou dados da primeira solicitação
  const s0 = solicitacoes[0]
  const [modal, setModal] = useState(initialData?.modal || s0?.modal || '')
  const [motorista, setMotorista] = useState(initialData?.motorista_nome || s0?.motorista_nome || '')
  const [placa, setPlaca] = useState(initialData?.veiculo_placa || s0?.veiculo_placa || '')
  const [dataPartida, setDataPartida] = useState(() => {
    const d = initialData?.data_prevista_saida || s0?.data_prevista_saida || ''
    return d ? d.slice(0, 16) : ''
  })
  const [custo, setCusto] = useState<number | ''>(initialData?.custo_estimado ?? s0?.custo_estimado ?? '')
  const [salvando, setSalvando] = useState(false)

  // Adicionar mais solicitações
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setShowAddMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Solicitações que ainda não estão no plano
  const disponiveis = useMemo(() =>
    allSolicitacoes.filter(s =>
      s.status === 'solicitado' && !pontos.some(p => p.id === s.id)
    ),
    [allSolicitacoes, pontos]
  )

  // Todos os pontos georreferenciados para o mapa
  const mapPoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number; label: string; tipo: 'origem' | 'destino' }> = []
    pontos.forEach((p, i) => {
      if (p.lat_origem && p.lng_origem) pts.push({ lat: p.lat_origem, lng: p.lng_origem, label: `${i + 1}A`, tipo: 'origem' })
      if (p.lat_destino && p.lng_destino) pts.push({ lat: p.lat_destino, lng: p.lng_destino, label: `${i + 1}B`, tipo: 'destino' })
    })
    return pts
  }, [pontos])

  // Polyline points
  const polyPoints = useMemo(() => {
    if (rota?.pontos && rota.pontos.length > 0) return rota.pontos.map(p => [p.lat, p.lng] as [number, number])
    // Fallback: linhas retas entre pontos
    const pts: [number, number][] = []
    pontos.forEach(p => {
      if (p.lat_origem && p.lng_origem) pts.push([p.lat_origem, p.lng_origem])
      if (p.lat_destino && p.lng_destino) pts.push([p.lat_destino, p.lng_destino])
    })
    return pts
  }, [rota, pontos])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const updatePonto = (index: number, field: keyof PontoRota, value: unknown) => {
    setPontos(prev => {
      const next = [...prev]
      ;(next[index] as Record<string, unknown>)[field] = value
      return next
    })
  }

  const movePonto = (from: number, to: number) => {
    if (to < 0 || to >= pontos.length) return
    setPontos(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setRota(null) // Invalidar rota calculada ao reordenar
  }

  const addSolicitacao = (sol: LogSolicitacao) => {
    setPontos(prev => [...prev, {
      id: sol.id,
      solicitacao: sol,
      endereco_origem: sol.origem || '',
      endereco_destino: sol.destino || '',
    }])
    setShowAddMenu(false)
  }

  const removePonto = (index: number) => {
    setPontos(prev => prev.filter((_, i) => i !== index))
  }

  const handleSelectOrigem = (index: number, s: EnderecoSugestao) => {
    setPontos(prev => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        endereco_origem: s.descricao || `${s.cidade} - ${s.uf}`,
        lat_origem: s.lat,
        lng_origem: s.lng,
      }
      return next
    })
  }

  const handleSelectDestino = (index: number, s: EnderecoSugestao) => {
    setPontos(prev => {
      const next = [...prev]
      next[index] = {
        ...next[index],
        endereco_destino: s.descricao || `${s.cidade} - ${s.uf}`,
        lat_destino: s.lat,
        lng_destino: s.lng,
      }
      return next
    })
  }

  // Decode polyline6 (OSRM uses precision 5 by default)
  function decodePolyline(encoded: string, precision = 5): Array<{ lat: number; lng: number }> {
    const factor = 10 ** precision
    const result: Array<{ lat: number; lng: number }> = []
    let lat = 0, lng = 0, index = 0
    while (index < encoded.length) {
      let shift = 0, b: number, dlat = 0
      do { b = encoded.charCodeAt(index++) - 63; dlat |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      lat += (dlat & 1) ? ~(dlat >> 1) : (dlat >> 1)
      shift = 0; let dlng = 0
      do { b = encoded.charCodeAt(index++) - 63; dlng |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      lng += (dlng & 1) ? ~(dlng >> 1) : (dlng >> 1)
      result.push({ lat: lat / factor, lng: lng / factor })
    }
    return result
  }

  // Calcular rota via OSRM (gratuito, trajeto real de carro)
  const calcularRota = async () => {
    const orderedPontos = optimizePontosOrder(pontos)
    const waypointPlan = buildWaypointPlan(orderedPontos)
    const waypoints = waypointPlan.stops

    if (waypoints.length < 2) return

    setCalculando(true)
    try {
      // OSRM free API — trajeto real de carro com geometria
      const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';')
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline&steps=false`
      const res = await fetch(osrmUrl, { signal: AbortSignal.timeout(15000) })

      if (res.ok) {
        const json = await res.json()
        if (json.code === 'Ok' && json.routes?.length > 0) {
          const route = json.routes[0]
          const distKm = Math.round(route.distance / 1000)
          const durHrs = Math.round(route.duration / 3600 * 10) / 10

          // Decode polyline to get road geometry
          const routePoints = decodePolyline(route.geometry)

          setRota({
            distancia_total_km: distKm,
            duracao_total_horas: durHrs,
            pontos: routePoints,
            polyline: route.geometry,
          })

          // Atualizar distâncias por trecho (leg) se houver múltiplos pontos
          if (route.legs && route.legs.length > 0) {
            const updatedPontos = orderedPontos.map((ponto, index) => {
              const range = waypointPlan.legRanges[index]
              if (!range) return ponto

              const serviceLegs = route.legs.slice(range.startLegIndex, range.endLegIndexExclusive)
              const serviceDistance = serviceLegs.reduce((sum: number, leg: { distance?: number }) => sum + (leg.distance || 0), 0)
              const serviceDuration = serviceLegs.reduce((sum: number, leg: { duration?: number }) => sum + (leg.duration || 0), 0)

              return {
                ...ponto,
                distancia_km: Math.round(serviceDistance / 1000),
                duracao_horas: Math.round(serviceDuration / 3600 * 10) / 10,
              }
            })

            setPontos(updatedPontos)
          } else {
            setPontos(orderedPontos)
          }
          return
        }
      }
      throw new Error('OSRM failed')
    } catch {
      let totalKm = 0
      const pts: Array<{ lat: number; lng: number }> = []
      const updatedPontos = orderedPontos.map(p => {
        if (p.lat_origem && p.lng_origem && p.lat_destino && p.lng_destino) {
          const directKm = haversineKm(
            { lat: p.lat_origem, lng: p.lng_origem },
            { lat: p.lat_destino, lng: p.lng_destino },
          )
          totalKm += directKm
          pts.push({ lat: p.lat_origem, lng: p.lng_origem })
          pts.push({ lat: p.lat_destino, lng: p.lng_destino })
          return {
            ...p,
            distancia_km: Math.round(directKm * 1.3),
            duracao_horas: Math.round(((directKm * 1.3) / 60) * 10) / 10,
          }
        }
        return p
      })
      if (totalKm > 0) {
        setRota({
          distancia_total_km: Math.round(totalKm * 1.3),
          duracao_total_horas: Math.round((totalKm * 1.3) / 60 * 10) / 10,
          pontos: pts,
        })
        setPontos(updatedPontos)
      }
    } finally {
      setCalculando(false)
    }
  }

  const handleSave = async () => {
    setSalvando(true)
    try {
      // Determinar origem e destino da viagem a partir dos pontos da rota
      const primeiraOrigem = pontos[0]?.endereco_origem || pontos[0]?.solicitacao?.origem || ''
      const ultimoDestino = pontos[pontos.length - 1]?.endereco_destino || pontos[pontos.length - 1]?.solicitacao?.destino || ''

      await onSave({
        solicitacaoIds: pontos.map(p => p.id),
        rota: pontos,
        distancia_total_km: rota?.distancia_total_km || 0,
        duracao_total_horas: rota?.duracao_total_horas || 0,
        modal: modal || undefined,
        motorista_nome: motorista || undefined,
        veiculo_placa: placa || undefined,
        data_prevista_saida: dataPartida || undefined,
        custo_estimado: custo !== '' ? custo : undefined,
        origem_principal: primeiraOrigem || undefined,
        destino_final: ultimoDestino || undefined,
        rota_polyline: serializeViagemRotaPayload({
          version: 1,
          polyline: rota?.polyline,
          distancia_total_km: rota?.distancia_total_km || 0,
          duracao_total_horas: rota?.duracao_total_horas || 0,
          etapas: pontos.map((ponto, index) => ({
            solicitacao_id: ponto.id,
            ordem: index + 1,
            origem: ponto.endereco_origem || ponto.solicitacao?.origem || '',
            destino: ponto.endereco_destino || ponto.solicitacao?.destino || '',
            distancia_km: ponto.distancia_km,
            duracao_horas: ponto.duracao_horas,
          })),
        }),
      })
    } finally {
      setSalvando(false)
    }
  }

  // Center map (Brazil default)
  const defaultCenter: [number, number] = [-15.77, -47.93]
  const hasPoints = mapPoints.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden
        ${isDark ? 'bg-[#0f172a] border border-white/[0.08]' : 'bg-white'}`}
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-t-3xl shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600" />
          <div className="relative px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Route size={20} className="text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-white tracking-tight">Planejamento de Rota</h2>
                <p className="text-xs text-white/70 truncate">{pontos.length} solicitação(ões) • Montagem de rota otimizada</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* Left: Route builder */}
          <div className={`lg:w-[420px] flex-shrink-0 flex flex-col border-r overflow-y-auto ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}>

            {/* Pontos de rota */}
            <div className="p-4 space-y-3 flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <Navigation size={12} /> Pontos da Rota
                </h3>
                {/* Add solicitation */}
                <div ref={addMenuRef} className="relative">
                  <button
                    onClick={() => setShowAddMenu(!showAddMenu)}
                    disabled={disponiveis.length === 0}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                      isDark
                        ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-30'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200 disabled:opacity-30'
                    }`}
                  >
                    <Plus size={11} /> Adicionar
                  </button>
                  {showAddMenu && disponiveis.length > 0 && (
                    <div className={`absolute right-0 top-full mt-1 w-72 rounded-xl shadow-xl border max-h-60 overflow-y-auto z-50 ${
                      isDark ? 'bg-[#1e293b] border-white/[0.1]' : 'bg-white border-slate-200'
                    }`}>
                      {disponiveis.map(sol => (
                        <button
                          key={sol.id}
                          onClick={() => addSolicitacao(sol)}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition-all ${
                            isDark ? 'hover:bg-white/[0.06] text-slate-300' : 'hover:bg-orange-50 text-slate-700'
                          }`}
                        >
                          <Package2 size={13} className="text-orange-500 shrink-0" />
                          <div>
                            <div className="text-xs font-bold">{sol.numero}</div>
                            <div className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {sol.origem} → {sol.destino}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {pontos.map((ponto, idx) => (
                <div key={ponto.id}
                  className={`rounded-2xl border p-3 space-y-2.5 transition-all ${
                    isDark
                      ? 'bg-white/[0.03] border-white/[0.06] hover:border-orange-500/30'
                      : 'bg-slate-50/50 border-slate-200 hover:border-orange-300'
                  }`}
                >
                  {/* Ponto header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                        <span className="text-[10px] font-extrabold text-white">{idx + 1}</span>
                      </div>
                      {ponto.solicitacao && (
                        <span className={`text-[11px] font-bold ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                          #{ponto.solicitacao.numero}
                        </span>
                      )}
                      {ponto.solicitacao?.descricao && (
                        <span className={`text-[11px] truncate max-w-[120px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          {ponto.solicitacao.descricao}
                        </span>
                      )}
                    </div>
                    {pontos.length > 1 && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => movePonto(idx, idx - 1)} disabled={idx === 0}
                          className={`p-1 rounded-lg transition-all disabled:opacity-20 ${isDark ? 'text-slate-500 hover:text-white hover:bg-white/[0.08]' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                          title="Mover para cima">
                          <ArrowUp size={12} />
                        </button>
                        <button onClick={() => movePonto(idx, idx + 1)} disabled={idx === pontos.length - 1}
                          className={`p-1 rounded-lg transition-all disabled:opacity-20 ${isDark ? 'text-slate-500 hover:text-white hover:bg-white/[0.08]' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                          title="Mover para baixo">
                          <ArrowDown size={12} />
                        </button>
                        <button onClick={() => removePonto(idx)}
                          className={`p-1 rounded-lg transition-all ${isDark ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Origem */}
                  <EnderecoInput
                    value={ponto.endereco_origem}
                    onChange={v => updatePonto(idx, 'endereco_origem', v)}
                    onSelect={s => handleSelectOrigem(idx, s)}
                    isDark={isDark}
                    label="Origem"
                    icon={MapPin}
                  />

                  {/* Arrow */}
                  <div className="flex justify-center">
                    <ArrowRight size={14} className={`rotate-90 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                  </div>

                  {/* Destino */}
                  <EnderecoInput
                    value={ponto.endereco_destino}
                    onChange={v => updatePonto(idx, 'endereco_destino', v)}
                    onSelect={s => handleSelectDestino(idx, s)}
                    isDark={isDark}
                    label="Destino"
                    icon={Navigation}
                  />

                  {/* Distância individual */}
                  {ponto.distancia_km != null && (
                    <div className={`flex items-center gap-3 text-[11px] px-2 py-1.5 rounded-lg ${
                      isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <span className="flex items-center gap-1"><Ruler size={11} /> {ponto.distancia_km} km</span>
                      {ponto.duracao_horas != null && (
                        <span className="flex items-center gap-1"><Clock size={11} /> {ponto.duracao_horas}h</span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Calcular rota button */}
              {pontos.length > 0 && (
                <button
                  onClick={calcularRota}
                  disabled={calculando || mapPoints.length < 2}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                    calculando
                      ? 'bg-orange-500/50 text-white cursor-wait'
                      : mapPoints.length < 2
                        ? isDark ? 'bg-white/[0.04] text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-600 to-amber-500 text-white hover:from-orange-700 hover:to-amber-600 shadow-lg shadow-orange-500/20'
                  }`}
                >
                  {calculando ? (
                    <><Loader2 size={16} className="animate-spin" /> Calculando rota...</>
                  ) : (
                    <><Zap size={16} /> Calcular Rota</>
                  )}
                </button>
              )}

              {/* Resultado da rota */}
              {rota && (
                <div className={`rounded-2xl p-4 ${
                  isDark ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20' : 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Route size={14} className="text-emerald-500" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      Resumo da Rota
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl p-3 text-center ${isDark ? 'bg-black/20' : 'bg-white'}`}>
                      <Ruler size={18} className="text-emerald-500 mx-auto mb-1" />
                      <div className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {rota.distancia_total_km.toLocaleString('pt-BR')}
                      </div>
                      <div className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>km total</div>
                    </div>
                    <div className={`rounded-xl p-3 text-center ${isDark ? 'bg-black/20' : 'bg-white'}`}>
                      <Clock size={18} className="text-amber-500 mx-auto mb-1" />
                      <div className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                        {rota.duracao_total_horas < 1
                          ? `${Math.round(rota.duracao_total_horas * 60)}min`
                          : `${rota.duracao_total_horas.toFixed(1)}h`
                        }
                      </div>
                      <div className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>tempo estimado</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Planning fields */}
            <DadosTransporte
              isDark={isDark}
              modal={modal} setModal={setModal}
              motorista={motorista} setMotorista={setMotorista}
              placa={placa} setPlaca={setPlaca}
              dataPartida={dataPartida} setDataPartida={setDataPartida}
              custo={custo} setCusto={setCusto}
            />
          </div>

          {/* Right: Map + overview */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            {/* Map */}
            <div className="flex-1 relative">
              {mapPoints.length === 0 ? (
                <div className={`absolute inset-0 flex flex-col items-center justify-center ${isDark ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                    <MapPin size={32} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                  </div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Preencha os endereços para visualizar o mapa
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Use endereço ou CEP com autocomplete
                  </p>
                </div>
              ) : (
                <MapContainer
                  center={hasPoints ? [mapPoints[0].lat, mapPoints[0].lng] : defaultCenter}
                  zoom={5}
                  style={{ width: '100%', height: '100%' }}
                  className="rounded-none"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapFitter points={mapPoints} />

                  {/* Markers */}
                  {mapPoints.map((pt, i) => (
                    <Marker
                      key={`${pt.lat}-${pt.lng}-${i}`}
                      position={[pt.lat, pt.lng]}
                      icon={createIcon(pt.tipo === 'origem' ? '#f97316' : '#10b981', pt.label)}
                    >
                      <Popup>
                        <div className="text-sm font-bold">{pt.label}</div>
                        <div className="text-xs text-slate-500">{pt.tipo === 'origem' ? 'Origem' : 'Destino'}</div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* Route line */}
                  {polyPoints.length >= 2 && (
                    <Polyline
                      positions={polyPoints}
                      pathOptions={{
                        color: '#f97316',
                        weight: 4,
                        opacity: 0.8,
                        dashArray: rota?.pontos?.length ? undefined : '10, 8',
                      }}
                    />
                  )}
                </MapContainer>
              )}

              {/* Map overlay info */}
              {rota && (
                <div className="absolute top-3 right-3 z-[1000]">
                  <div className={`rounded-xl px-3 py-2 shadow-lg backdrop-blur-md ${
                    isDark ? 'bg-black/60 text-white' : 'bg-white/90 text-slate-800'
                  }`}>
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <span className="flex items-center gap-1"><Ruler size={13} className="text-orange-500" /> {rota.distancia_total_km.toLocaleString('pt-BR')} km</span>
                      <span className="flex items-center gap-1"><Clock size={13} className="text-amber-500" /> {rota.duracao_total_horas.toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────────── */}
        <div className={`px-6 py-4 flex items-center justify-between border-t ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-slate-200 bg-slate-50/50'}`}>
          <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {pontos.length} ponto(s) na rota
            {rota && ` • ${rota.distancia_total_km.toLocaleString('pt-BR')} km • ${rota.duracao_total_horas.toFixed(1)}h`}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isDark ? 'text-slate-400 hover:text-white hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={salvando || pontos.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white
                bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-700 hover:to-amber-600
                shadow-lg shadow-orange-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Salvar Planejamento
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
