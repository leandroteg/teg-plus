import { useEffect, useState } from 'react'
import { X, MapPin, Loader2, AlertCircle, ExternalLink, Download } from 'lucide-react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import JSZip from 'jszip'
import { supabase } from '../../services/supabase'

const BUCKET = 'orcamentacao-arquivos'

interface Linha { nome: string; coords: [number, number][] }

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

function parseKml(text: string): Linha[] {
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  const out: Linha[] = []
  const pms = Array.from(doc.getElementsByTagName('Placemark'))
  for (const pm of pms) {
    const nome = (pm.getElementsByTagName('name')[0]?.textContent || '').trim()
    const lss = Array.from(pm.getElementsByTagName('LineString'))
    for (const ls of lss) {
      const ctext = ls.getElementsByTagName('coordinates')[0]?.textContent || ''
      const coords: [number, number][] = []
      for (const tok of ctext.trim().split(/\s+/)) {
        const p = tok.split(',')
        if (p.length >= 2) {
          const lon = parseFloat(p[0]); const lat = parseFloat(p[1])
          if (!isNaN(lat) && !isNaN(lon)) coords.push([lat, lon])
        }
      }
      if (coords.length >= 2) out.push({ nome, coords })
    }
  }
  return out
}

function Fit({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length >= 2) {
      try { map.fitBounds(L.latLngBounds(coords as L.LatLngTuple[]), { padding: [40, 40] }) } catch { /* */ }
    }
    setTimeout(() => map.invalidateSize(), 80)
  }, [coords, map])
  return null
}

export default function MapaObraModal({ orcamentoId, obraNome, onClose, isDark }: {
  orcamentoId: string; obraNome: string; onClose: () => void; isDark: boolean
}) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [erro, setErro] = useState('')
  const [kmzUrl, setKmzUrl] = useState('')
  const [kmzNome, setKmzNome] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const { data: arqs, error } = await supabase.from('orc_arquivos')
          .select('storage_path, tipo, nome').eq('orcamento_id', orcamentoId)
        if (error) throw error
        const kmz = (arqs ?? []).find(a => a.tipo === 'kmz' || /\.(kmz|kml)$/i.test(a.nome))
        if (!kmz) throw new Error('KMZ não encontrado neste orçamento.')
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(kmz.storage_path, 86400)
        if (!signed?.signedUrl) throw new Error('Não consegui gerar o link do KMZ.')
        if (vivo) { setKmzUrl(signed.signedUrl); setKmzNome(kmz.nome) }
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
        const ls = parseKml(kmlText)
        if (vivo) setLinhas(ls)
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Falha ao carregar o KMZ.')
      }
    })()
    return () => { vivo = false }
  }, [orcamentoId])

  const alvo = linhas?.find(l => norm(l.nome) === norm(obraNome))
    || linhas?.find(l => norm(l.nome).includes(norm(obraNome)) || norm(obraNome).includes(norm(l.nome)))
  const fitCoords = alvo?.coords || (linhas && linhas.length ? linhas.flatMap(l => l.coords) : [])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()} className={`relative w-full max-w-4xl rounded-2xl border overflow-hidden shadow-2xl ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <p className={`text-sm font-extrabold flex items-center gap-1.5 truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <MapPin size={15} className="text-amber-500 shrink-0" /> {obraNome}
            </p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Traçado do KMZ {alvo ? '· obra destacada' : '· obra não localizada no KMZ — mostrando o lote'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={kmzUrl ? `https://www.google.com/maps?q=${encodeURIComponent(kmzUrl)}` : undefined}
              target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                kmzUrl ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-300 text-slate-500 pointer-events-none'
              }`}
              title="Abrir o KMZ original no Google Maps"
            >
              <ExternalLink size={13} /> Google Maps
            </a>
            <a
              href={kmzUrl || undefined} download={kmzNome || 'tracado.kmz'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                kmzUrl ? (isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200') : 'bg-slate-200 text-slate-400 pointer-events-none'
              }`}
              title="Baixar o KMZ (abrir no Google Earth)"
            >
              <Download size={13} /> KMZ
            </a>
            <button onClick={onClose} className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.06] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}><X size={18} /></button>
          </div>
        </div>

        <div className="h-[60vh] relative">
          {erro ? (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${isDark ? 'text-rose-300' : 'text-rose-600'}`}>
              <AlertCircle size={22} /> <span className="text-sm">{erro}</span>
            </div>
          ) : !linhas ? (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Loader2 size={22} className="animate-spin text-amber-500" /> <span className="text-sm">Carregando o traçado…</span>
            </div>
          ) : (
            <MapContainer center={[-19, -45]} zoom={7} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
              {linhas.map((l, i) => {
                const destaque = alvo && norm(l.nome) === norm(alvo.nome)
                return (
                  <Polyline key={i} positions={l.coords}
                    pathOptions={{ color: destaque ? '#f59e0b' : '#94a3b8', weight: destaque ? 5 : 2, opacity: destaque ? 1 : 0.5 }} />
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
