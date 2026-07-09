// ─────────────────────────────────────────────────────────────────────────────
// components/rh/JornalTegBuilder.tsx — Sobe o PDF do Jornal TEG e fatia em cards.
// Fluxo: upload PDF → renderiza páginas (pdf.js) → desenha retângulos sobre cada
// página → cada retângulo vira um card (imagem exata do bloco) → salva a edição.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState, useCallback } from 'react'
import {
  Upload, Loader2, Trash2, Save, FileText, CheckCircle2, Sparkles,
  Newspaper, AlertTriangle, Square,
} from 'lucide-react'
import { renderPdfPages, cropCanvasToBlob } from '../../lib/pdfRender'
import {
  useCriarEdicao, useSalvarCards, uploadJornalArquivo, detectarBlocosJornal,
  type JornalCard,
} from '../../hooks/useJornal'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'

// Retângulo em fração (0–1) da página → resolução-independente
interface Crop {
  id: string
  page: number
  x: number; y: number; w: number; h: number   // frações 0–1
  thumb: string                                  // objectURL p/ preview
  titulo?: string                                // vindo da detecção por IA
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

let cropSeq = 0

export default function JornalTegBuilder({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth()
  const { isLightSidebar: isLight } = useTheme()
  const criarEdicao = useCriarEdicao()
  const salvarCards = useSalvarCards()

  const hoje = new Date()
  const [titulo, setTitulo] = useState('')
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pageUrls, setPageUrls] = useState<string[]>([])
  const canvasesRef = useRef<HTMLCanvasElement[]>([])

  const [rendering, setRendering] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detProg, setDetProg] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [erro, setErro] = useState('')

  const [crops, setCrops] = useState<Crop[]>([])

  // desenho em curso
  const [draw, setDraw] = useState<{ page: number; x0: number; y0: number; x1: number; y1: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const inp = isLight
    ? 'w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30'
    : 'w-full px-3 py-2.5 rounded-xl bg-white/6 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30'
  const txt = isLight ? 'text-slate-800' : 'text-white'

  const reset = () => {
    setPdfFile(null); setPageUrls([]); canvasesRef.current = []
    setCrops([]); setDone(false); setErro(''); setTitulo('')
  }

  async function handlePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { setErro('Selecione um arquivo PDF.'); return }
    setErro(''); setRendering(true); setPdfFile(file); setCrops([])
    try {
      const buf = await file.arrayBuffer()
      const canvases = await renderPdfPages(buf.slice(0), 2.2)
      canvasesRef.current = canvases
      setPageUrls(canvases.map(c => c.toDataURL('image/png')))
      if (!titulo) setTitulo(`Jornal TEG — ${MESES[mes - 1]} ${ano}`)
      setRendering(false)
      // detecção automática dos blocos com IA
      await autoDetect(canvases)
    } catch (err) {
      console.error(err)
      setErro('Falha ao ler o PDF. Verifique o arquivo e tente novamente.')
      setPdfFile(null)
      setRendering(false)
    }
  }

  // ── Detecta blocos de todas as páginas via Gemini Vision e cria os cards ─────
  async function autoDetect(canvases: HTMLCanvasElement[]) {
    setDetecting(true); setErro(''); setCrops([])
    let feitos = 0
    setDetProg(`0/${canvases.length}`)
    try {
      const novos: Crop[] = []
      for (let pi = 0; pi < canvases.length; pi++) {
        const canvas = canvases[pi]
        const b64 = canvas.toDataURL('image/png').split(',')[1]
        try {
          const blocos = await detectarBlocosJornal(pi + 1, b64)
          for (const bl of blocos) {
            const x = clamp01(bl.x), y = clamp01(bl.y)
            const w = clamp01(Math.min(bl.w, 1 - x)), h = clamp01(Math.min(bl.h, 1 - y))
            if (w < 0.02 || h < 0.015) continue
            const blob = await cropCanvasToBlob(canvas, x * canvas.width, y * canvas.height, w * canvas.width, h * canvas.height)
            novos.push({ id: `c${++cropSeq}`, page: pi, x, y, w, h, thumb: URL.createObjectURL(blob), titulo: bl.titulo })
          }
        } catch (e) {
          console.error('detecção página', pi + 1, e)
        }
        feitos++; setDetProg(`${feitos}/${canvases.length}`)
        setCrops([...novos])
      }
      if (!novos.length) setErro('A IA não detectou blocos. Você pode recortar manualmente arrastando sobre a página.')
    } finally {
      setDetecting(false)
    }
  }

  // ── Desenho do retângulo sobre uma página ──────────────────────────────────
  const onDown = (page: number) => (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setDraw({ page, x0: x, y0: y, x1: x, y1: y })
  }
  const onMove = (e: React.MouseEvent) => {
    if (!draw) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDraw({ ...draw, x1: (e.clientX - r.left) / r.width, y1: (e.clientY - r.top) / r.height })
  }
  const onUp = useCallback(async () => {
    if (!draw) return
    const x = Math.min(draw.x0, draw.x1), y = Math.min(draw.y0, draw.y1)
    const w = Math.abs(draw.x1 - draw.x0), h = Math.abs(draw.y1 - draw.y0)
    const cur = draw
    setDraw(null)
    if (w < 0.03 || h < 0.02) return // clique acidental
    const canvas = canvasesRef.current[cur.page]
    if (!canvas) return
    const blob = await cropCanvasToBlob(canvas, x * canvas.width, y * canvas.height, w * canvas.width, h * canvas.height)
    setCrops(cs => [...cs, { id: `c${++cropSeq}`, page: cur.page, x, y, w, h, thumb: URL.createObjectURL(blob) }])
  }, [draw])

  const removeCrop = (id: string) => setCrops(cs => cs.filter(c => c.id !== id))

  async function addFullPage(page: number) {
    const canvas = canvasesRef.current[page]
    if (!canvas) return
    const blob = await cropCanvasToBlob(canvas, 0, 0, canvas.width, canvas.height)
    setCrops(cs => [...cs, { id: `c${++cropSeq}`, page, x: 0, y: 0, w: 1, h: 1, thumb: URL.createObjectURL(blob) }])
  }

  // ── Salvar edição + cards ───────────────────────────────────────────────────
  async function handleSalvar() {
    if (!pdfFile || !crops.length) return
    setSaving(true); setErro('')
    try {
      // 1) sobe o PDF original (não-fatal: se falhar, salva os cards mesmo assim)
      let pdfUrl: string | null = null
      try { pdfUrl = await uploadJornalArquivo(pdfFile, 'pdf', 'pdf') }
      catch (e) { console.warn('Upload do PDF original falhou; seguindo sem ele.', e) }
      // 2) capa = primeira página renderizada
      let capaUrl: string | null = null
      if (canvasesRef.current[0]) {
        const capaBlob = await cropCanvasToBlob(canvasesRef.current[0], 0, 0, canvasesRef.current[0].width, canvasesRef.current[0].height)
        capaUrl = await uploadJornalArquivo(capaBlob, 'capa')
      }
      // 3) cria a edição
      const edicao = await criarEdicao.mutateAsync({
        titulo: titulo || `Jornal TEG — ${MESES[mes - 1]} ${ano}`,
        mes, ano, pdf_url: pdfUrl, capa_url: capaUrl, publicado: false,
        criado_por: (user as { nome?: string; email?: string } | null)?.nome
          ?? (user as { email?: string } | null)?.email ?? null,
      })
      // 4) recorta e sobe cada card
      const rows: Omit<JornalCard, 'id' | 'created_at'>[] = []
      for (let i = 0; i < crops.length; i++) {
        const c = crops[i]
        const canvas = canvasesRef.current[c.page]
        const px = { x: c.x * canvas.width, y: c.y * canvas.height, w: c.w * canvas.width, h: c.h * canvas.height }
        const blob = await cropCanvasToBlob(canvas, px.x, px.y, px.w, px.h)
        const url = await uploadJornalArquivo(blob, 'card')
        rows.push({
          edicao_id: edicao.id, pagina: c.page + 1, ordem: i,
          titulo: c.titulo ?? null, imagem_url: url,
          largura: Math.round(px.w), altura: Math.round(px.h),
        })
      }
      await salvarCards.mutateAsync(rows)
      setDone(true)
      onSaved?.()
    } catch (err) {
      console.error(err)
      setErro('Falha ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Sucesso ───────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-14 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
        <CheckCircle2 size={48} className="text-emerald-400" />
        <p className="text-lg font-bold text-emerald-300">Edição salva com {crops.length} card{crops.length !== 1 ? 's' : ''}!</p>
        <p className="text-xs text-slate-400">Salva como rascunho (não publicada). Publique na lista de edições.</p>
        <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-semibold">
          <Newspaper size={14} /> Nova edição
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Metadados */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="text-[11px] text-slate-400 block mb-1.5">Título da edição</label>
          <input className={inp} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Jornal TEG — Junho 2026" />
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1.5">Mês</label>
          <select className={`${inp} ${isLight ? '' : '[&>option]:bg-slate-900'}`} value={mes} onChange={e => setMes(+e.target.value)}>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-slate-400 block mb-1.5">Ano</label>
          <input type="number" className={inp} value={ano} onChange={e => setAno(+e.target.value)} />
        </div>
      </div>

      {/* Upload */}
      {!pageUrls.length && (
        <>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdf} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={rendering}
            className={`w-full py-10 rounded-2xl border-2 border-dashed text-sm hover:border-violet-500/50 hover:text-violet-400 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50 ${isLight ? 'border-slate-300 text-slate-500' : 'border-white/15 text-slate-400 hover:text-violet-300'}`}
          >
            {rendering
              ? <><Loader2 size={22} className="animate-spin text-violet-400" /> Renderizando páginas…</>
              : <><Upload size={22} /> <span className="font-semibold">Selecionar PDF do Jornal TEG</span><span className="text-[11px] text-slate-500">O sistema renderiza as páginas para você recortar os blocos</span></>}
          </button>
        </>
      )}

      {erro && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <AlertTriangle size={14} /> {erro}
        </div>
      )}

      {/* Editor de recorte */}
      {pageUrls.length > 0 && (
        <>
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-violet-500/8 border border-violet-500/20">
            {detecting
              ? <Loader2 size={16} className="text-violet-400 shrink-0 animate-spin" />
              : <Sparkles size={16} className="text-violet-400 shrink-0" />}
            <div className={`text-xs leading-relaxed flex-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {detecting ? (
                <><span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white/80'}`}>Detectando blocos com IA…</span> {detProg} páginas — aguarde.</>
              ) : (
                <><span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white/80'}`}>Blocos detectados automaticamente.</span> Ajuste se precisar: arraste sobre a página pra adicionar um bloco, ou remova na lixeira. {pdfFile?.name}</>
              )}
            </div>
            {!detecting && (
              <button onClick={() => autoDetect(canvasesRef.current)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-400 hover:text-violet-300 px-2 py-1 rounded-lg hover:bg-white/5 shrink-0">
                <Sparkles size={12} /> Detectar de novo
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* Páginas */}
            <div className="space-y-6">
              {pageUrls.map((url, pi) => (
                <div key={pi}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">Página {pi + 1}</span>
                    <button onClick={() => addFullPage(pi)} className="flex items-center gap-1.5 text-[11px] text-violet-300 hover:text-violet-200 px-2 py-1 rounded-lg hover:bg-white/5">
                      <Square size={11} /> Página inteira
                    </button>
                  </div>
                  <div
                    className="relative w-full rounded-xl overflow-hidden ring-1 ring-white/10 cursor-crosshair select-none"
                    onMouseDown={onDown(pi)}
                    onMouseMove={onMove}
                    onMouseUp={onUp}
                    onMouseLeave={() => draw?.page === pi && onUp()}
                  >
                    <img src={url} alt={`Página ${pi + 1}`} className="w-full block pointer-events-none" draggable={false} />
                    {/* retângulos já criados nesta página */}
                    {crops.filter(c => c.page === pi).map(c => (
                      <div key={c.id} className="absolute border-2 border-violet-400 bg-violet-500/20"
                        style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }} />
                    ))}
                    {/* desenho em curso */}
                    {draw?.page === pi && (
                      <div className="absolute border-2 border-dashed border-violet-300 bg-violet-400/15"
                        style={{
                          left: `${Math.min(draw.x0, draw.x1) * 100}%`,
                          top: `${Math.min(draw.y0, draw.y1) * 100}%`,
                          width: `${Math.abs(draw.x1 - draw.x0) * 100}%`,
                          height: `${Math.abs(draw.y1 - draw.y0) * 100}%`,
                        }} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Cards recortados */}
            <div className="lg:sticky lg:top-4 self-start space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${txt}`}>{crops.length} card{crops.length !== 1 ? 's' : ''}</span>
                {crops.length > 0 && <button onClick={() => setCrops([])} className="text-[11px] text-slate-500 hover:text-rose-400">limpar</button>}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto styled-scrollbar pr-1">
                {crops.map(c => (
                  <div key={c.id} className="relative group rounded-lg overflow-hidden ring-1 ring-white/10 bg-white/5">
                    <img src={c.thumb} alt="" className="w-full object-cover" />
                    <button onClick={() => removeCrop(c.id)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-white/70">pág {c.page + 1}</span>
                  </div>
                ))}
                {!crops.length && <p className="col-span-2 text-[11px] text-slate-500 py-6 text-center">Nenhum bloco recortado ainda.</p>}
              </div>
              <button
                onClick={handleSalvar}
                disabled={saving || !crops.length}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-semibold disabled:opacity-50"
              >
                {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <><Save size={15} /> Salvar edição ({crops.length})</>}
              </button>
              <button onClick={reset} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-white/10 text-xs text-slate-400 hover:bg-white/5">
                <FileText size={13} /> Trocar PDF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
