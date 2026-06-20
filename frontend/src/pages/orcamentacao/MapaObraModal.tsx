import { useEffect, useState } from 'react'
import { X, MapPin, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { MapContainer, TileLayer, Polyline, Polygon, CircleMarker, Tooltip, LayersControl, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import JSZip from 'jszip'
import { supabase } from '../../services/supabase'

const BUCKET = 'orcamentacao-arquivos'

interface Linha { nome: string; coords: [number, number][] }
interface Ponto { nome: string; pos: [number, number] }
interface Poligono { nome: string; coords: [number, number][] }
interface Geo { linhas: Linha[]; pontos: Ponto[]; poligonos: Poligono[] }

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

function coordsFrom(t: string | null | undefined): [number, number][] {
  const out: [number, number][] = []
  for (const tok of (t || '').trim().split(/\s+/)) {
    const p = tok.split(',')
    if (p.length >= 2) {
      const lon = parseFloat(p[0]); const lat = parseFloat(p[1])
      if (!isNaN(lat) && !isNaN(lon)) out.push([lat, lon])
    }
  }
  return out
}

function parseKml(text: string): Geo {
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  const g: Geo = { linhas: [], pontos: [], poligonos: [] }
  for (const pm of Array.from(doc.getElementsByTagName('Placemark'))) {
    const nome = (pm.getElementsByTagName('name')[0]?.textContent || '').trim()
    for (const ls of Array.from(pm.getElementsByTagName('LineString'))) {
      const c = coordsFrom(ls.getElementsByTagName('coordinates')[0]?.textContent)
      if (c.length >= 2) g.linhas.push({ nome, coords: c })
    }
    for (const pt of Array.from(pm.getElementsByTagName('Point'))) {
      const c = coordsFrom(pt.getElementsByTagName('coordinates')[0]?.textContent)
      if (c.length) g.pontos.push({ nome, pos: c[0] })
    }
    for (const pg of Array.from(pm.getElementsByTagName('Polygon'))) {
      const ring = pg.getElementsByTagName('coordinates')[0]?.textContent
      const c = coordsFrom(ring)
      if (c.length >= 3) g.poligonos.push({ nome, coords: c })
    }
  }
  return g
}

function Fit({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length >= 2) { try { map.fitBounds(L.latLngBounds(coords as L.LatLngTuple[]), { padding: [40, 40] }) } catch { /* */ } }
    else if (coords.length === 1) { map.setView(coords[0] as L.LatLngTuple, 13) }
    setTimeout(() => map.invalidateSize(), 80)
  }, [coords, map])
  return null
}

export default function MapaObraModal({ orcamentoId, obraNome, onClose, isDark }: {
  orcamentoId: string; obraNome: string; onClose: () => void; isDark: boolean
}) {
  const [geo, setGeo] = useState<Geo | null>(null)
  const [erro, setErro] = useState('')
  const [kmzUrl, setKmzUrl] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data: arqs, error } = await supabase.from('orc_arquivos').select('storage_path, tipo, nome').eq('orcamento_id', orcamentoId)
        if (error) throw error
        const kmz = (arqs ?? []).find(a => a.tipo === 'kmz' || /\.(kmz|kml)$/i.test(a.nome))
        if (!kmz) throw new Error('KMZ não encontrado neste orçamento.')
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(kmz.storage_path, 86400)
        if (!signed?.signedUrl) throw new Error('Não consegui gerar o link do KMZ.')
        if (vivo) setKmzUrl(signed.signedUrl)
        const buf = await fetch(signed.signedUrl).then(r => r.arrayBuffer())
        let kmlText = ''
        if (/\.kmz$/i.test(kmz.nome) || kmz.tipo === 'kmz') {
          const zip = await JSZip.loadAsync(buf)
          const name = Object.keys(zip.files).find(n => /\.kml$/i.test(n))
          if (!name) throw new Error('KML não encontrado dentro do KMZ.')
          kmlText = await zip.files[name].async('text')
        } else {
          kmlText = new TextDecoder().decode(buf)
        }
        if (vivo) setGeo(parseKml(kmlText))
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Falha ao carregar o KMZ.')
      }
    })()
    return () => { vivo = false }
  }, [orcamentoId])

  const ehAlvo = (nome: string) => {
    if (!nome) return false
    const a = norm(nome); const b = norm(obraNome)
    return a === b || a.includes(b) || b.includes(a)
  }
  const alvoLinha = geo?.linhas.find(l => ehAlvo(l.nome))
  const fitCoords = alvoLinha?.coords
    || (geo && [...geo.linhas.flatMap(l => l.coords), ...geo.pontos.map(p => p.pos)]) || []

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()} className={`relative w-full max-w-5xl rounded-2xl border overflow-hidden shadow-2xl ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <p className={`text-sm font-extrabold flex items-center gap-1.5 truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <MapPin size={15} className="text-amber-500 shrink-0" /> {obraNome}
            </p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {geo ? `${geo.linhas.length} traçado(s) · ${geo.pontos.length} ponto(s)${alvoLinha ? ' · obra destacada' : ' · obra não localizada — mostrando o lote'}` : 'Traçado do KMZ'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={kmzUrl ? `https://www.google.com/maps?q=${encodeURIComponent(kmzUrl)}` : undefined} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${kmzUrl ? (isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200') : 'bg-slate-200 text-slate-400 pointer-events-none'}`}
              title="Abrir no Google Maps">
              <ExternalLink size={13} /> Google Maps
            </a>
            <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={18} /></button>
          </div>
        </div>

        <div className="h-[68vh] relative">
          {erro ? (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>
              <AlertCircle size={22} /> <span className="text-sm">{erro}</span>
            </div>
          ) : !geo ? (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 size={22} className="animate-spin text-amber-500" /> <span className="text-sm">Carregando o traçado…</span>
            </div>
          ) : (
            <MapContainer center={[-19, -47]} zoom={8} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Satélite">
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" maxZoom={19} />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Ruas">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />
                </LayersControl.BaseLayer>
              </LayersControl>

              {/* polígonos (faixa) */}
              {geo.poligonos.map((pg, i) => (
                <Polygon key={'pg' + i} positions={pg.coords} pathOptions={{ color: '#10b981', weight: 1, fillOpacity: 0.12 }} />
              ))}

              {/* linhas (traçados) */}
              {geo.linhas.map((l, i) => {
                const destaque = ehAlvo(l.nome)
                return (
                  <Polyline key={'ln' + i} positions={l.coords}
                    pathOptions={{ color: destaque ? '#f59e0b' : '#64748b', weight: destaque ? 5 : 2.5, opacity: destaque ? 1 : 0.55 }}>
                    {l.nome && <Tooltip sticky>{l.nome}</Tooltip>}
                  </Polyline>
                )
              })}

              {/* pontos (torres / marcos) */}
              {geo.pontos.map((p, i) => {
                const destaque = ehAlvo(p.nome)
                return (
                  <CircleMarker key={'pt' + i} center={p.pos}
                    radius={destaque ? 4 : 2.5}
                    pathOptions={{ color: destaque ? '#b45309' : '#475569', fillColor: destaque ? '#f59e0b' : '#94a3b8', fillOpacity: 0.9, weight: 1 }}>
                    {p.nome && <Tooltip>{p.nome}</Tooltip>}
                  </CircleMarker>
                )
              })}

              <Fit coords={fitCoords} />
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  )
}
