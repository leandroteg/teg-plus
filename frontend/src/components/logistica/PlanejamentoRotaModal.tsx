import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  X, MapPin, Navigation, Clock, Ruler, Truck, Save, Loader2,
  Search, Package2, Route, Plus, Trash2, GripVertical, ArrowRight,
  Building2, ChevronDown, Zap, AlertTriangle, Calendar,
} from 'lucide-react'
import type { LogSolicitacao } from '../../types/logistica'

// ── Leaflet imports ──────────────────────────────────────────────────────────
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { serializeViagemRotaPayload } from '../../utils/logisticaViagem'
import { UpperInput } from '../UpperInput'
import { useVeiculos } from '../../hooks/useFrotas'
import type { FroVeiculo } from '../../types/frotas'

// Fix leaflet default icon issue
try {
  delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
} catch { /* leaflet not ready */ }

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
    veiculo_placa?: string
    data_prevista_saida?: string
    custo_estimado?: number
  }) => Promise<void>
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

// ── Address Autocomplete Input ───────────────────────────────────────────────

function EnderecoInput({
  value,
  onChange,
  onSelect,
  placeholder,
  isDark,
  label,
  icon: Icon,
}: {
  value: string
  onChange: (v: string) => void
  onSelect: (s: EnderecoSugestao) => void
  placeholder: string
  isDark: boolean
  label: string
  icon: typeof MapPin
}) {
  const [sugestoes, setSugestoes] = useState<EnderecoSugestao[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [cepMode, setCepMode] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  // Click outside close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const buscar = useCallback(async (query: string) => {
    if (query.length < 3) { setSugestoes([]); return }
    setLoading(true)
    try {
      const isCep = /^\d{5}-?\d{0,3}$/.test(query.replace(/\s/g, ''))

      if (isCep) {
        const limpo = query.replace(/\D/g, '')
        if (limpo.length >= 8) {
          const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${limpo}`, { signal: AbortSignal.timeout(8000) })
          if (res.ok) {
            const d = await res.json()
            const sug: EnderecoSugestao = {
              descricao: `${d.street || ''}, ${d.neighborhood || ''}, ${d.city} - ${d.state}`.replace(/^, /, ''),
              logradouro: d.street, bairro: d.neighborhood, cidade: d.city, uf: d.state, cep: d.cep,
              lat: d.location?.coordinates?.latitude, lng: d.location?.coordinates?.longitude,
            }
            setSugestoes([sug])
            setOpen(true)
          }
        }
      } else {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=br&format=json&addressdetails=1&limit=5`,
          { signal: AbortSignal.timeout(8000), headers: { 'Accept-Language': 'pt-BR' } },
        )
        if (res.ok) {
          const data = await res.json()
          const resultados: EnderecoSugestao[] = data.map((r: Record<string, unknown>) => {
            const addr = r.address as Record<string, string> | undefined
            return {
              descricao: String(r.display_name ?? ''),
              logradouro: addr?.road || addr?.pedestrian || '',
              bairro: addr?.suburb || addr?.neighbourhood || '',
              cidade: addr?.city || addr?.town || addr?.municipality || '',
              uf: addr?.state || '', cep: addr?.postcode || '',
              lat: Number(r.lat), lng: Number(r.lon),
            }
          })
          setSugestoes(resultados)
          setOpen(resultados.length > 0)
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  const handleChange = (v: string) => {
    onChange(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(v), 400)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        <Icon size={11} /> {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => sugestoes.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`w-full pl-3 pr-10 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${
            isDark
              ? 'bg-white/[0.06] border-white/[0.08] text-slate-200 focus:ring-orange-500/30 focus:border-orange-500/50 placeholder-slate-600'
              : 'bg-slate-50 border-slate-200 text-slate-700 focus:ring-orange-500/20 focus:border-orange-400 placeholder-slate-400'
          }`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 size={14} className="animate-spin text-orange-500" />}
          <button
            onClick={() => setCepMode(!cepMode)}
            title={cepMode ? 'Buscar por endereço' : 'Buscar por CEP'}
            className={`p-1 rounded-md transition-all ${
              cepMode
                ? 'bg-orange-500/20 text-orange-500'
                : isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Search size={12} />
          </button>
        </div>
      </div>

      {/* Dropdown sugestões */}
      {open && sugestoes.length > 0 && (
        <div className={`absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-xl border max-h-48 overflow-y-auto ${
          isDark ? 'bg-[#1e293b] border-white/[0.1]' : 'bg-white border-slate-200'
        }`}>
          {sugestoes.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(s)
                onChange(s.descricao || `${s.cidade} - ${s.uf}`)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-start gap-2 transition-all ${
                isDark ? 'hover:bg-white/[0.06] text-slate-300' : 'hover:bg-orange-50 text-slate-700'
              } ${i > 0 ? isDark ? 'border-t border-white/[0.04]' : 'border-t border-slate-100' : ''}`}
            >
              <MapPin size={14} className="text-orange-500 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">{s.descricao || `${s.cidade} - ${s.uf}`}</div>
                {s.cep && <div className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>CEP: {s.cep}</div>}
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
                  <UpperInput
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
          <UpperInput type="text" value={motorista} onChange={e => setMotorista(e.target.value)}
            placeholder="Nome" className={fieldCls} />
        </div>

        {/* Placa — readonly when vehicle selected, editable otherwise */}
        <div>
          <label className={labelCls}>Placa</label>
          <UpperInput type="text" value={placa}
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

export default function PlanejamentoRotaModal({ isDark, solicitacoes, allSolicitacoes, onClose, onSave }: Props) {
  // Estado: Pontos de rota (cada solicitação = 1 ponto com origem+destino)
  const [pontos, setPontos] = useState<PontoRota[]>(() =>
    solicitacoes.map(sol => ({
      id: sol.id,
      solicitacao: sol,
      endereco_origem: sol.origem || '',
      endereco_destino: sol.destino || '',
    }))
  )

  // Auto-geocodificar endereços que vêm da solicitação (sem coordenadas)
  useEffect(() => {
    async function geocode(endereco: string): Promise<{ lat: number; lng: number } | null> {
      if (!endereco || endereco.length < 3) return null
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco)}&countrycodes=br&format=json&limit=1`,
          { headers: { 'Accept-Language': 'pt-BR' } },
        )
        if (res.ok) {
          const data = await res.json()
          if (data[0]) return { lat: Number(data[0].lat), lng: Number(data[0].lon) }
        }
      } catch { /* silent */ }
      return null
    }
    let cancelled = false
    ;(async () => {
      const updated = [...pontos]
      let changed = false
      for (let i = 0; i < updated.length; i++) {
        if (cancelled) break
        const p = updated[i]
        if (p.endereco_origem && !p.lat_origem) {
          const geo = await geocode(p.endereco_origem)
          if (geo && !cancelled) { updated[i] = { ...updated[i], lat_origem: geo.lat, lng_origem: geo.lng }; changed = true }
        }
        if (p.endereco_destino && !p.lat_destino) {
          const geo = await geocode(p.endereco_destino)
          if (geo && !cancelled) { updated[i] = { ...updated[i], lat_destino: geo.lat, lng_destino: geo.lng }; changed = true }
        }
      }
      if (changed && !cancelled) setPontos(updated)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rota calculada
  const [rota, setRota] = useState<RotaCalculada | null>(null)
  const [calculando, setCalculando] = useState(false)

  // Planning fields
  const [modal, setModal] = useState('')
  const [motorista, setMotorista] = useState('')
  const [placa, setPlaca] = useState('')
  const [dataPartida, setDataPartida] = useState('')
  const [custo, setCusto] = useState<number | ''>('')
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

  // Calcular rota via OSRM (direto, sem n8n)
  const calcularRota = async () => {
    const waypoints = pontos.flatMap(p => {
      const pts: Array<{ lat: number; lng: number; label: string }> = []
      if (p.lat_origem && p.lng_origem) pts.push({ lat: p.lat_origem, lng: p.lng_origem, label: p.endereco_origem })
      if (p.lat_destino && p.lng_destino) pts.push({ lat: p.lat_destino, lng: p.lng_destino, label: p.endereco_destino })
      return pts
    })

    if (waypoints.length < 2) return

    setCalculando(true)
    try {
      const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';')
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`,
        { signal: AbortSignal.timeout(15000) },
      )

      if (res.ok) {
        const json = await res.json()
        const route = json.routes?.[0]
        if (route) {
          const distanciaKm = Math.round((route.distance / 1000) * 10) / 10
          const duracaoHoras = Math.round((route.duration / 3600) * 100) / 100
          const routePoints = route.geometry?.coordinates?.map((c: number[]) => ({ lat: c[1], lng: c[0] })) || []

          setRota({ distancia_total_km: distanciaKm, duracao_total_horas: duracaoHoras, pontos: routePoints })

          if (route.legs && Array.isArray(route.legs)) {
            setPontos(prev => prev.map((p, i) => {
              const leg = route.legs[i]
              return leg ? { ...p, distancia_km: Math.round((leg.distance / 1000) * 10) / 10, duracao_horas: Math.round((leg.duration / 3600) * 100) / 100 } : p
            }))
          }
        }
      }
    } catch {
      // Fallback: cálculo estimado por distância euclidiana
      let totalKm = 0
      const pts: Array<{ lat: number; lng: number }> = []
      pontos.forEach(p => {
        if (p.lat_origem && p.lng_origem && p.lat_destino && p.lng_destino) {
          const d = haversine(p.lat_origem, p.lng_origem, p.lat_destino, p.lng_destino)
          totalKm += d
          pts.push({ lat: p.lat_origem, lng: p.lng_origem })
          pts.push({ lat: p.lat_destino, lng: p.lng_destino })
        }
      })
      if (totalKm > 0) {
        setRota({
          distancia_total_km: Math.round(totalKm * 1.3),
          duracao_total_horas: Math.round((totalKm * 1.3) / 60 * 10) / 10,
          pontos: pts,
        })
      }
    } finally {
      setCalculando(false)
    }
  }

  // Haversine formula
  function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const handleSave = async () => {
    setSalvando(true)
    try {
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
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZyIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+')] opacity-40" />
          <div className="relative px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Route size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white tracking-tight">Planejamento de Rota</h2>
                <p className="text-xs text-white/70">{pontos.length} solicitação(ões) • Montagem de rota otimizada</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all">
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
                      <button onClick={() => removePonto(idx)}
                        className={`p-1 rounded-lg transition-all ${isDark ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Origem */}
                  <EnderecoInput
                    value={ponto.endereco_origem}
                    onChange={v => updatePonto(idx, 'endereco_origem', v)}
                    onSelect={s => handleSelectOrigem(idx, s)}
                    placeholder="Endereço ou CEP de origem..."
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
                    placeholder="Endereço ou CEP de destino..."
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

            {/* Planning fields — using DadosTransporte component with vehicle selector */}
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
      `}</style>
    </div>
  )
}
