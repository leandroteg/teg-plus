// ─────────────────────────────────────────────────────────────────────────────
// pages/locacao/MapaImoveis.tsx — sub-visão "Mapa de Imóveis" do Controle de Leitos
// Leaflet/OSM (padrão da telemetria). Forma = tipo do imóvel; cor = vagas/status.
// Bases (canteiros) também plotadas. Clique → detalhes; imóvel abre o drawer.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, AttributionControl } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronLeft, ChevronRight, MapPin, Info as InfoIcon } from 'lucide-react'
import type { LocImovel } from '../../types/locacao'
import { useImoveisMapa, useBasesMapa, type Leito, type BaseMapa } from '../../hooks/useLeitos'

const fmtCur = (v?: number | null) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const nomeImovel = (i: LocImovel) => i.titulo || i.nome || i.descricao || 'Imóvel'

// tipos: forma geométrica + rótulo
const TIPO_INFO: Record<string, { shape: 'circle' | 'triangle' | 'square' | 'diamond'; label: string }> = {
  ALOJ: { shape: 'circle',   label: 'Alojamento' },
  CANT: { shape: 'triangle', label: 'Canteiro' },
  CD:   { shape: 'square',   label: 'Centro de Distribuição' },
  ESC:  { shape: 'diamond',  label: 'Escritório' },
}

// Cor por vagas (alojamento) ou status (demais)
function corImovel(i: LocImovel, vagas?: { total: number; livres: number }): { cor: string; rotulo: string } {
  if (i.tipo === 'ALOJ') {
    if (!vagas || vagas.total === 0) return { cor: '#94a3b8', rotulo: 'Sem leitos' }
    if (vagas.livres > 0) return { cor: '#22c55e', rotulo: `${vagas.livres} vaga${vagas.livres > 1 ? 's' : ''}` }
    return { cor: '#ef4444', rotulo: 'Lotado' }
  }
  const st: Record<string, { cor: string; rotulo: string }> = {
    ativo:      { cor: '#6366f1', rotulo: 'Ativo' },
    em_entrada: { cor: '#06b6d4', rotulo: 'Em entrada' },
    em_saida:   { cor: '#f97316', rotulo: 'Em saída' },
    inativo:    { cor: '#94a3b8', rotulo: 'Inativo' },
  }
  return st[i.status] ?? st.ativo
}

// SVG da forma pra divIcon
function shapeSvg(shape: string, cor: string, size = 22): string {
  const s = size, c = s / 2, st = 'stroke="white" stroke-width="2.5"'
  if (shape === 'triangle')
    return `<polygon points="${c},2 ${s - 2},${s - 3} 2,${s - 3}" fill="${cor}" ${st}/>`
  if (shape === 'square')
    return `<rect x="3" y="3" width="${s - 6}" height="${s - 6}" rx="3" fill="${cor}" ${st}/>`
  if (shape === 'diamond')
    return `<polygon points="${c},2 ${s - 2},${c} ${c},${s - 2} 2,${c}" fill="${cor}" ${st}/>`
  if (shape === 'star') {
    const pts = starPoints(c, c, c - 2, (c - 2) * 0.45, 5)
    return `<polygon points="${pts}" fill="${cor}" ${st}/>`
  }
  return `<circle cx="${c}" cy="${c}" r="${c - 2}" fill="${cor}" ${st}/>`
}
function starPoints(cx: number, cy: number, ro: number, ri: number, n: number): string {
  const out: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri
    const a = (Math.PI / n) * i - Math.PI / 2
    out.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return out.join(' ')
}
function makeIcon(shape: string, cor: string, destaque = false): L.DivIcon {
  const sz = destaque ? 30 : 22
  return L.divIcon({
    className: '',
    html: `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))">${shapeSvg(shape, cor, sz)}</svg>`,
    iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2], popupAnchor: [0, -sz / 2],
  })
}

// jitter determinístico p/ pontos aproximados não empilharem
function jitter(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return ((h / 0xffff) - 0.5) * 0.014
}

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (!pts.length) return
    map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 })
  }, [pts, map])
  return null
}
function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap()
  useEffect(() => { if (pos) map.flyTo(pos, 14, { duration: 0.7 }) }, [pos, map])
  return null
}

type Sel = { kind: 'imovel'; id: string } | { kind: 'base'; id: string } | null

// ══════════════════════════════════════════════════════════════════════════════
export interface MapaFiltros { busca: string; tipo: string; cidade: string; ocup: string; cc: string }

export default function MapaImoveis({ leitosPorImovel, ocupadosSet, onAbrir, isDark, filtros }: {
  leitosPorImovel: Map<string, Leito[]>
  ocupadosSet: Set<string>
  onAbrir: (a: LocImovel) => void
  isDark: boolean
  filtros: MapaFiltros
}) {
  const { data: imoveis = [], isLoading } = useImoveisMapa()
  const { data: bases = [] } = useBasesMapa()

  const { busca, tipo: fTipo, cidade: fCidade, ocup: fOcup, cc: fCC } = filtros
  const [sel, setSel] = useState<Sel>(null)
  const [sidebar, setSidebar] = useState(true)

  const vagasDe = (id: string) => {
    const ls = (leitosPorImovel.get(id) ?? []).filter(l => l.ativo)
    const ocup = ls.filter(l => ocupadosSet.has(l.id)).length
    return { total: ls.length, livres: ls.length - ocup, ocupados: ocup }
  }

  // filtros
  const imoveisF = useMemo(() => {
    const q = busca.toLowerCase()
    return imoveis.filter(i => {
      if (fTipo !== 'todos' && fTipo !== 'base' && i.tipo !== fTipo) return false
      if (fTipo === 'base') return false
      if (fCidade && i.cidade !== fCidade) return false
      if (fCC && (i as any).centro_custo?.id !== fCC) return false
      if (fOcup) {
        const v = vagasDe(i.id)
        if (fOcup === 'vaga' && !(i.tipo === 'ALOJ' && v.livres > 0)) return false
        if (fOcup === 'lotado' && !(i.tipo === 'ALOJ' && v.total > 0 && v.livres === 0)) return false
        if (fOcup === 'sem' && !(i.tipo === 'ALOJ' && v.total === 0)) return false
      }
      if (q && !(nomeImovel(i).toLowerCase().includes(q) || i.endereco?.toLowerCase().includes(q) || i.cidade?.toLowerCase().includes(q))) return false
      return true
    })
  }, [imoveis, busca, fTipo, fCidade, fCC, fOcup, leitosPorImovel, ocupadosSet])

  const basesF = useMemo(() => {
    if (fTipo !== 'todos' && fTipo !== 'base') return []
    if (fOcup || fCC) return []  // filtros de imóvel não se aplicam a base
    const q = busca.toLowerCase()
    return bases.filter(b => {
      if (fCidade && b.cidade !== fCidade) return false
      if (q && !(b.nome.toLowerCase().includes(q) || b.endereco?.toLowerCase().includes(q) || b.cidade?.toLowerCase().includes(q))) return false
      return true
    })
  }, [bases, busca, fTipo, fCidade, fOcup, fCC])

  const posImovel = (i: LocImovel): [number, number] => {
    const lat = i.latitude! + (i.geo_aprox ? jitter(i.id) : 0)
    const lng = i.longitude! + (i.geo_aprox ? jitter(i.id + 'x') : 0)
    return [lat, lng]
  }
  const posBase = (b: BaseMapa): [number, number] => [
    b.latitude! + (b.geo_aprox ? jitter(b.id) : 0),
    b.longitude! + (b.geo_aprox ? jitter(b.id + 'x') : 0),
  ]

  const allPts = useMemo<[number, number][]>(() =>
    [...imoveisF.map(posImovel), ...basesF.map(posBase)], [imoveisF, basesF])

  const flyPos = useMemo<[number, number] | null>(() => {
    if (!sel) return null
    if (sel.kind === 'imovel') { const i = imoveis.find(x => x.id === sel.id); return i ? posImovel(i) : null }
    const b = bases.find(x => x.id === sel.id); return b ? posBase(b) : null
  }, [sel, imoveis, bases])

  const cardCls = isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white border border-slate-200'

  return (
    <div className={`flex rounded-2xl overflow-hidden relative h-[calc(100vh-13rem)] min-h-[480px] ${cardCls}`}>
      {/* Sidebar — só a lista (filtros ficam no header) */}
      <div className={`flex flex-col shrink-0 border-r transition-all duration-300 ${sidebar ? 'w-64' : 'w-0 border-r-0 overflow-hidden'} ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
        <div className={`px-3 py-2 border-b text-[10px] font-bold uppercase tracking-wider ${isDark ? 'border-white/[0.06] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
          {imoveisF.length} imóveis · {basesF.length} bases
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {isLoading ? Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`rounded-xl h-11 animate-pulse ${isDark ? 'bg-white/[0.04]' : 'bg-slate-100'}`} />
          )) : (
            <>
              {imoveisF.map(i => {
                const v = i.tipo === 'ALOJ' ? vagasDe(i.id) : undefined
                const { cor, rotulo } = corImovel(i, v)
                const ativo = sel?.kind === 'imovel' && sel.id === i.id
                return (
                  <button key={i.id} onClick={() => setSel(ativo ? null : { kind: 'imovel', id: i.id })}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors border ${ativo
                      ? isDark ? 'bg-cyan-500/10 border-cyan-500/25' : 'bg-cyan-50 border-cyan-200'
                      : 'border-transparent ' + (isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50')}`}>
                    <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cor }} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{nomeImovel(i)}</p>
                      <p className="text-[10px] text-slate-500 truncate">{i.cidade || '—'}{i.geo_aprox ? ' · aprox.' : ''}</p>
                    </div>
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: cor + '22', color: cor }}>{rotulo}</span>
                  </button>
                )
              })}
              {basesF.map(b => {
                const ativo = sel?.kind === 'base' && sel.id === b.id
                const cor = b.ativa ? '#0d9488' : '#94a3b8'
                return (
                  <button key={b.id} onClick={() => setSel(ativo ? null : { kind: 'base', id: b.id })}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors border ${ativo
                      ? isDark ? 'bg-cyan-500/10 border-cyan-500/25' : 'bg-cyan-50 border-cyan-200'
                      : 'border-transparent ' + (isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50')}`}>
                    <span className="shrink-0 text-[13px]" style={{ color: cor }}>★</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>{b.nome}</p>
                      <p className="text-[10px] text-slate-500 truncate">Base · {b.cidade || '—'}{b.geo_aprox ? ' · aprox.' : ''}</p>
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Legenda de formas */}
        <div className={`px-3 py-2 border-t text-[9px] ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
          <div className="flex flex-wrap gap-x-2.5 gap-y-1">
            <span>● Alojamento</span><span>▲ Canteiro</span><span>■ CD</span><span>◆ Escritório</span><span>★ Base</span>
          </div>
        </div>
      </div>

      <button onClick={() => setSidebar(!sidebar)}
        className={`absolute top-3 z-[1000] rounded-lg p-1.5 shadow-md transition-all ${sidebar ? 'left-[244px]' : 'left-3'} ${isDark ? 'bg-[#1e293b] border border-white/[0.1] text-slate-300' : 'bg-white border border-slate-200 text-slate-600'}`}>
        {sidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Mapa */}
      <div className="flex-1 relative">
        <MapContainer center={[-18.9, -47]} zoom={6} className="h-full w-full z-0" zoomControl={false} attributionControl={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <AttributionControl position="bottomleft" prefix={false} />
          <FitBounds pts={allPts} />
          <FlyTo pos={flyPos} />

          {imoveisF.map(i => {
            const v = i.tipo === 'ALOJ' ? vagasDe(i.id) : undefined
            const { cor, rotulo } = corImovel(i, v)
            const shape = TIPO_INFO[i.tipo || '']?.shape ?? 'circle'
            const selected = sel?.kind === 'imovel' && sel.id === i.id
            return (
              <Marker key={i.id} position={posImovel(i)} icon={makeIcon(shape, cor, selected)}
                zIndexOffset={selected ? 1000 : 0}
                eventHandlers={{ click: () => setSel({ kind: 'imovel', id: i.id }) }}>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[190px]">
                    <p className="font-bold text-sm text-slate-800">{nomeImovel(i)}</p>
                    <p className="text-slate-500">{TIPO_INFO[i.tipo || '']?.label ?? i.tipo} · {i.cidade || '—'}</p>
                    {i.endereco && <p className="text-slate-400">{i.endereco}{i.numero ? `, ${i.numero}` : ''}</p>}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: cor + '22', color: cor }}>{rotulo}</span>
                      {v && v.total > 0 && <span className="text-slate-500">{v.ocupados}/{v.total} ocupados</span>}
                    </div>
                    <p className="text-slate-500">{fmtCur(i.valor_aluguel_mensal)}/mês{i.geo_aprox ? ' · 📍 aprox.' : ''}</p>
                    <button onClick={() => onAbrir(i)}
                      className="w-full mt-1.5 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-600 text-white text-[11px] font-bold hover:bg-cyan-700">
                      <InfoIcon size={11} /> Ver detalhes
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {basesF.map(b => {
            const cor = b.ativa ? '#0d9488' : '#94a3b8'
            const selected = sel?.kind === 'base' && sel.id === b.id
            return (
              <Marker key={b.id} position={posBase(b)} icon={makeIcon('star', cor, selected)}
                zIndexOffset={selected ? 1000 : 0}
                eventHandlers={{ click: () => setSel({ kind: 'base', id: b.id }) }}>
                <Popup>
                  <div className="text-xs space-y-1 min-w-[180px]">
                    <p className="font-bold text-sm text-slate-800">★ {b.nome}</p>
                    <p className="text-slate-500">Base / Canteiro · {b.cidade || '—'}{b.eh_sede ? ' · Sede' : ''}</p>
                    {b.endereco && <p className="text-slate-400">{b.endereco}</p>}
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: cor + '22', color: cor }}>{b.ativa ? 'Ativa' : 'Inativa'}</span>
                    {b.geo_aprox && <p className="text-slate-400">📍 localização aproximada</p>}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {(imoveisF.length + basesF.length) === 0 && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <MapPin size={36} className="text-slate-300 mb-2" />
            <p className="text-sm text-slate-400">Nenhum imóvel no filtro</p>
          </div>
        )}
      </div>
    </div>
  )
}
