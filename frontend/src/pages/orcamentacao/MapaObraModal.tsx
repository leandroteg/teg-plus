import { useEffect, useState } from 'react'
import { X, MapPin, Loader2, AlertCircle, ExternalLink, Tag, Eye, EyeOff } from 'lucide-react'
import { MapContainer, TileLayer, Polyline, Polygon, CircleMarker, Tooltip, Popup, LayersControl, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import JSZip from 'jszip'
import { supabase } from '../../services/supabase'

const BUCKET = 'orcamentacao-arquivos'

interface Estilo { color: string; opacity: number; width: number }
interface Linha extends Estilo { nome: string; coords: [number, number][]; regiao: string; dados: Record<string, string> }
interface Ponto { nome: string; pos: [number, number]; color: string }
interface Poligono { nome: string; coords: [number, number][] }
interface Geo { linhas: Linha[]; pontos: Ponto[]; poligonos: Poligono[] }

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
const ln = (el: Element) => el.localName || el.tagName

// rótulos dos campos do ExtendedData
const ROTULO: Record<string, string> = {
  ID: 'ID', GEDEX: 'GEDEX', US: 'US', TENSAO_OPERACAO: 'Tensão (kV)', PLANO: 'Plano',
  CADASTRADOR: 'Cadastrador', DOCUMENTO: 'Documento', REVISAO: 'Revisão',
}

// KML usa cor AABBGGRR (hex). Converte pra CSS #RRGGBB + opacidade.
function kmlCor(kml: string | null | undefined): { color: string; opacity: number } | null {
  if (!kml) return null
  const h = kml.trim().replace(/^#/, '')
  if (h.length !== 8) return null
  const aa = parseInt(h.slice(0, 2), 16)
  const bb = h.slice(2, 4), gg = h.slice(4, 6), rr = h.slice(6, 8)
  if (isNaN(aa)) return null
  return { color: `#${rr}${gg}${bb}`, opacity: Math.max(0.2, aa / 255) }
}

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

function nomeDireto(el: Element): string {
  for (const c of Array.from(el.children)) if (ln(c) === 'name') return (c.textContent || '').trim()
  return ''
}

function parseKml(text: string): Geo {
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  const g: Geo = { linhas: [], pontos: [], poligonos: [] }

  // estilos (cor/largura de linha)
  const styles: Record<string, Estilo> = {}
  for (const st of Array.from(doc.getElementsByTagName('Style'))) {
    const id = st.getAttribute('id'); if (!id) continue
    const lsEl = st.getElementsByTagName('LineStyle')[0]
    const c = kmlCor(lsEl?.getElementsByTagName('color')[0]?.textContent)
    const w = parseFloat(lsEl?.getElementsByTagName('width')[0]?.textContent || '')
    styles[id] = { color: c?.color ?? '#2563eb', opacity: c?.opacity ?? 1, width: isNaN(w) ? 3 : Math.max(2, w) }
  }
  const styleMaps: Record<string, string> = {}
  for (const sm of Array.from(doc.getElementsByTagName('StyleMap'))) {
    const id = sm.getAttribute('id'); if (!id) continue
    for (const pair of Array.from(sm.getElementsByTagName('Pair'))) {
      const key = pair.getElementsByTagName('key')[0]?.textContent?.trim()
      const url = pair.getElementsByTagName('styleUrl')[0]?.textContent?.trim()
      if (key === 'normal' && url) styleMaps[id] = url.replace(/^#/, '')
    }
  }
  const resolver = (styleUrl: string | null | undefined): Estilo => {
    let id = (styleUrl || '').replace(/^#/, '')
    if (styleMaps[id]) id = styleMaps[id]
    return styles[id] ?? { color: '#2563eb', opacity: 1, width: 3 }
  }

  const generico = new Set(['ld', 'regioes', 'lugares temporarios', 'lugares'])
  const dadosDe = (pm: Element): Record<string, string> => {
    const d: Record<string, string> = {}
    for (const sd of Array.from(pm.getElementsByTagName('SimpleData'))) {
      const k = sd.getAttribute('name'); if (k && sd.textContent) d[k] = sd.textContent.trim()
    }
    for (const dt of Array.from(pm.getElementsByTagName('Data'))) {
      const k = dt.getAttribute('name'); const v = dt.getElementsByTagName('value')[0]?.textContent
      if (k && v) d[k] = v.trim()
    }
    return d
  }

  // percorre a árvore mantendo a pilha de pastas → define a região de cada obra
  const walk = (el: Element, pastas: string[]) => {
    for (const child of Array.from(el.children)) {
      const t = ln(child)
      if (t === 'Folder') {
        walk(child, [...pastas, nomeDireto(child)])
      } else if (t === 'Document') {
        walk(child, pastas)
      } else if (t === 'Placemark') {
        const nome = nomeDireto(child)
        const est = resolver(child.getElementsByTagName('styleUrl')[0]?.textContent)
        const regiao = [...pastas].reverse().find(p => p && !generico.has(norm(p))) || ''
        const dados = dadosDe(child)
        for (const lsg of Array.from(child.getElementsByTagName('LineString'))) {
          const c = coordsFrom(lsg.getElementsByTagName('coordinates')[0]?.textContent)
          if (c.length >= 2) g.linhas.push({ nome, coords: c, regiao, dados, ...est })
        }
        for (const pt of Array.from(child.getElementsByTagName('Point'))) {
          const c = coordsFrom(pt.getElementsByTagName('coordinates')[0]?.textContent)
          if (c.length) g.pontos.push({ nome, pos: c[0], color: est.color })
        }
        for (const pg of Array.from(child.getElementsByTagName('Polygon'))) {
          const c = coordsFrom(pg.getElementsByTagName('coordinates')[0]?.textContent)
          if (c.length >= 3) g.poligonos.push({ nome, coords: c })
        }
      } else {
        walk(child, pastas)
      }
    }
  }
  if (doc.documentElement) walk(doc.documentElement, [])
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

function BalaoObra({ l }: { l: Linha }) {
  const entries = Object.entries(l.dados).filter(([k]) => k !== 'NOME_INSTALACAO' && l.dados[k])
  return (
    <div style={{ minWidth: 180 }}>
      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 4 }}>{l.nome}</div>
      {l.regiao && <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>Região: {l.regiao}</div>}
      {entries.length > 0 && (
        <table style={{ fontSize: 11, borderCollapse: 'collapse' }}>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k}>
                <td style={{ color: '#64748b', paddingRight: 8, verticalAlign: 'top' }}>{ROTULO[k] ?? k}</td>
                <td style={{ fontWeight: 600 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function MapaObraModal({ orcamentoId, obraNome, onClose, isDark }: {
  orcamentoId: string; obraNome: string; onClose: () => void; isDark: boolean
}) {
  const [geo, setGeo] = useState<Geo | null>(null)
  const [erro, setErro] = useState('')
  const [kmzUrl, setKmzUrl] = useState('')
  const [regioesOff, setRegioesOff] = useState<Set<string>>(new Set())
  const [mostrarNomes, setMostrarNomes] = useState(true)

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

  // regiões presentes (cor representativa + contagem)
  const regioes: { nome: string; color: string; count: number }[] = []
  if (geo) {
    const m = new Map<string, { color: string; count: number }>()
    for (const l of geo.linhas) {
      const r = l.regiao || 'Outras'
      const cur = m.get(r); if (cur) cur.count++; else m.set(r, { color: l.color, count: 1 })
    }
    for (const [nome, v] of m) regioes.push({ nome, color: v.color, count: v.count })
  }
  const visivel = (l: Linha) => !regioesOff.has(l.regiao || 'Outras')
  const linhas = (geo?.linhas ?? []).filter(visivel)
  const alvos = linhas.filter(l => ehAlvo(l.nome))
  const fitCoords = (alvos.length ? alvos.flatMap(l => l.coords) : null)
    || (geo && [...geo.linhas.flatMap(l => l.coords), ...geo.pontos.map(p => p.pos)]) || []

  const toggleRegiao = (r: string) => setRegioesOff(prev => {
    const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n
  })

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <style>{`
        .leaflet-tooltip.obra-rotulo{background:rgba(255,255,255,.92);border:none;box-shadow:0 1px 3px rgba(0,0,0,.35);font-size:10px;font-weight:700;color:#0f172a;padding:1px 5px;border-radius:5px;white-space:nowrap}
        .leaflet-tooltip.obra-rotulo-alvo{background:#f59e0b;color:#fff;font-size:11px}
        .leaflet-tooltip.obra-rotulo::before,.leaflet-tooltip.obra-rotulo-alvo::before{display:none}
      `}</style>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()} className={`relative w-full max-w-5xl rounded-2xl border overflow-hidden shadow-2xl ${isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'}`}>
        <div className={`flex items-center justify-between px-5 py-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="min-w-0">
            <p className={`text-sm font-extrabold flex items-center gap-1.5 truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              <MapPin size={15} className="text-amber-500 shrink-0" /> {obraNome}
            </p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {geo
                ? `${geo.linhas.length} obras · ${regioes.length} regiões · cores originais do KMZ${alvos.length ? ' · obra destacada' : ''}`
                : 'Traçado do KMZ'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setMostrarNomes(v => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${mostrarNomes ? 'bg-amber-500 text-white' : (isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}`}
              title="Mostrar/ocultar nomes das obras">
              {mostrarNomes ? <Eye size={13} /> : <EyeOff size={13} />} Nomes
            </button>
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
            <>
              <MapContainer center={[-19, -47]} zoom={8} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="Satélite">
                    <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="&copy; Esri" maxZoom={19} />
                  </LayersControl.BaseLayer>
                  <LayersControl.BaseLayer name="Ruas">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" maxZoom={19} />
                  </LayersControl.BaseLayer>
                </LayersControl>

                {/* polígonos (faixa) — se houver */}
                {geo.poligonos.map((pg, i) => (
                  <Polygon key={'pg' + i} positions={pg.coords} pathOptions={{ color: '#10b981', weight: 1, fillOpacity: 0.12 }} />
                ))}

                {/* halo branco sob a obra destacada */}
                {alvos.map((l, i) => (
                  <Polyline key={'halo' + i} positions={l.coords} pathOptions={{ color: '#ffffff', weight: l.width + 7, opacity: 0.9, interactive: false }} />
                ))}

                {/* todas as linhas visíveis — cor original + rótulo + balão */}
                {linhas.map((l, i) => {
                  const alvo = ehAlvo(l.nome)
                  const label = mostrarNomes || alvo
                  return (
                    <Polyline key={'ln' + i} positions={l.coords}
                      pathOptions={{ color: l.color, weight: alvo ? l.width + 3 : l.width, opacity: alvo ? 1 : l.opacity }}>
                      {l.nome && (
                        <Tooltip permanent={label} sticky={!label} direction="center"
                          className={`obra-rotulo ${alvo ? 'obra-rotulo-alvo' : ''}`}>
                          {l.nome}
                        </Tooltip>
                      )}
                      <Popup><BalaoObra l={l} /></Popup>
                    </Polyline>
                  )
                })}

                {/* pontos (torres/marcos) — se houver */}
                {geo.pontos.map((p, i) => (
                  <CircleMarker key={'pt' + i} center={p.pos} radius={ehAlvo(p.nome) ? 4 : 2.5}
                    pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.9, weight: 1 }}>
                    {p.nome && <Tooltip>{p.nome}</Tooltip>}
                  </CircleMarker>
                ))}

                <Fit coords={fitCoords} />
              </MapContainer>

              {/* legenda / filtro por região */}
              {regioes.length > 0 && (
                <div className={`absolute bottom-3 left-3 z-[1000] rounded-xl border shadow-lg overflow-hidden ${isDark ? 'bg-[#0f172a]/95 border-white/10' : 'bg-white/95 border-slate-200'}`}>
                  <div className={`px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1.5 ${isDark ? 'text-slate-300 border-b border-white/10' : 'text-slate-500 border-b border-slate-100'}`}>
                    <Tag size={11} /> Regiões
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    {regioes.map(r => {
                      const off = regioesOff.has(r.nome)
                      return (
                        <button key={r.nome} onClick={() => toggleRegiao(r.nome)}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition-colors ${off ? 'opacity-40' : ''} ${isDark ? 'hover:bg-white/[0.06] text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                          title={off ? 'Mostrar' : 'Ocultar'}>
                          <span className="w-3 h-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                          <span className="font-bold flex-1 text-left">{r.nome}</span>
                          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{r.count}</span>
                          {off ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
