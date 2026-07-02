import { useState, useEffect, useRef, Suspense, type ComponentType } from 'react'
import {
  Play, Pause, ChevronLeft, ChevronRight, X, Maximize2, Minimize2,
  Plus, Presentation, Mail, Loader2, Trash2, Clock,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { PAINEIS, type PainelDef } from './registry'

// Persistência local da configuração do slide show (intervalo + slides).
// Quando o envio automático por e-mail for ligado no backend, a config migra p/ DB.
const LS_KEY = 'paineis_slideshow_v2'
const DEFAULT_INTERVAL = 20

// Um slide = um painel (key) + opcionalmente uma ABA interna do painel (tab).
// Ex.: o EGP tem abas Faturamento/Medição que entram como slides próprios.
export type Slide = { key: string; tab?: string; label?: string }

const DEFAULT_SLIDES: Slide[] = [
  { key: 'sgi' },
  { key: 'egp' },
  { key: 'egp', tab: 'faturamento', label: 'EGP · Faturamento' },
  { key: 'egp', tab: 'medicao', label: 'EGP · Medição' },
  { key: 'obras' },
  { key: 'rh' },
  { key: 'patrimonial' },
]

// Abas internas que podem ser adicionadas à rotação (além dos painéis base).
const SUBTABS: Slide[] = [
  { key: 'egp', tab: 'producao', label: 'EGP · Produção' },
  { key: 'egp', tab: 'faturamento', label: 'EGP · Faturamento' },
  { key: 'egp', tab: 'medicao', label: 'EGP · Medição' },
  { key: 'egp', tab: 'cronograma', label: 'EGP · Cronograma' },
  { key: 'egp', tab: 'custos', label: 'EGP · Custos' },
]

type Cfg = { slides: Slide[]; intervalSec: number }
function loadCfg(): Cfg {
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (r && Array.isArray(r.slides) && r.slides.length) return { slides: r.slides, intervalSec: Number(r.intervalSec) || DEFAULT_INTERVAL }
  } catch { /* ignore */ }
  return { slides: DEFAULT_SLIDES, intervalSec: DEFAULT_INTERVAL }
}

const slideKey = (s: Slide) => `${s.key}${s.tab ? ':' + s.tab : ''}`
const slideLabel = (s: Slide, def?: PainelDef) => s.label || def?.label || s.key

type Resolved = { s: Slide; def: PainelDef }

// ── Player em tela cheia ──────────────────────────────────────────────────────
function SlideShowPlayer({ slides, intervalSec, onClose }: { slides: Resolved[]; intervalSec: number; onClose: () => void }) {
  const { isDark } = useTheme()
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [fs, setFs] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const n = slides.length
  const go = (d: number) => setIdx(i => (i + d + n) % n)

  useEffect(() => {
    if (!playing || n <= 1) return
    const t = setTimeout(() => setIdx(i => (i + 1) % n), Math.max(3, intervalSec) * 1000)
    return () => clearTimeout(t)
  }, [playing, idx, intervalSec, n])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [n])

  const toggleFs = async () => {
    try {
      if (!document.fullscreenElement) { await rootRef.current?.requestFullscreen(); setFs(true) }
      else { await document.exitFullscreen(); setFs(false) }
    } catch { /* ignore */ }
  }
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  const cur = slides[idx]
  const label = slideLabel(cur.s, cur.def)
  // Componente do painel; pode receber `initialPainel` (aba inicial) — só o EGP usa.
  const Painel = cur.def.Painel as ComponentType<{ initialPainel?: string }>
  const bg = isDark ? 'bg-[#0b1220]' : 'bg-slate-50'
  const ctrlBg = isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'

  return (
    <div ref={rootRef} className={`fixed inset-0 z-[100] flex flex-col ${bg}`}>
      <div className={`flex items-center justify-between gap-3 px-5 py-3 ${isDark ? 'bg-black/30' : 'bg-white/80 border-b border-slate-200'} backdrop-blur`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">{cur.def.emoji}</span>
          <div className="min-w-0">
            <p className={`text-base font-extrabold leading-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{label}</p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Painel {idx + 1} de {n} · Painéis Estratégicos</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => go(-1)} title="Anterior (←)" className={`w-9 h-9 rounded-xl flex items-center justify-center ${ctrlBg}`}><ChevronLeft size={18} /></button>
          <button onClick={() => setPlaying(p => !p)} title={playing ? 'Pausar (espaço)' : 'Reproduzir (espaço)'} className={`w-9 h-9 rounded-xl flex items-center justify-center ${ctrlBg}`}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
          <button onClick={() => go(1)} title="Próximo (→)" className={`w-9 h-9 rounded-xl flex items-center justify-center ${ctrlBg}`}><ChevronRight size={18} /></button>
          <button onClick={toggleFs} title="Tela cheia" className={`w-9 h-9 rounded-xl flex items-center justify-center ${ctrlBg}`}>{fs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          <button onClick={onClose} title="Sair (Esc)" className={`w-9 h-9 rounded-xl flex items-center justify-center ${ctrlBg}`}><X size={18} /></button>
        </div>
      </div>

      <div className="h-1 bg-black/10">
        <div key={`${idx}-${playing}`} className="h-full bg-indigo-500"
          style={playing ? { animation: `sshProg ${Math.max(3, intervalSec)}s linear forwards` } : { width: '0%' }} />
      </div>

      {/* Painel atual — key força remount por slide (aba inicial só vale no mount) */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 size={30} className="animate-spin text-indigo-500" /></div>}>
          <Painel key={slideKey(cur.s)} initialPainel={cur.s.tab} />
        </Suspense>
      </div>

      <div className={`flex items-center justify-center gap-2 py-2.5 ${isDark ? 'bg-black/30' : 'bg-white/80 border-t border-slate-200'}`}>
        {slides.map((r, i) => (
          <button key={i} onClick={() => setIdx(i)} title={slideLabel(r.s, r.def)}
            className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-indigo-500' : `w-2 ${isDark ? 'bg-white/25' : 'bg-slate-300'}`}`} />
        ))}
      </div>
      <style>{`@keyframes sshProg { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  )
}

// ── Página: Slide Show ────────────────────────────────────────────────────────
export default function PaineisSlideShow() {
  const { isDark } = useTheme()
  const { isAdmin, hasModule } = useAuth()
  const [cfg, setCfg] = useState<Cfg>(loadCfg)
  const [playing, setPlaying] = useState(() => new URLSearchParams(window.location.search).get('autoplay') === '1')
  const [adding, setAdding] = useState(false)

  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(cfg)) }, [cfg])

  const can = (k: string) => isAdmin || hasModule(k)
  const byKey: Record<string, PainelDef> = Object.fromEntries(PAINEIS.map(p => [p.key, p]))
  const resolved: Resolved[] = cfg.slides.map(s => ({ s, def: byKey[s.key] })).filter((r): r is Resolved => !!r.def && can(r.s.key))

  // Disponíveis p/ adicionar: painéis base + abas internas (que o usuário acessa)
  const addable: Slide[] = [
    ...PAINEIS.filter(p => can(p.key)).map(p => ({ key: p.key } as Slide)),
    ...SUBTABS.filter(t => can(t.key)),
  ]

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const card = isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'
  const soft = isDark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-slate-50 border-slate-200'

  const setInterval = (v: number) => setCfg(c => ({ ...c, intervalSec: Math.max(5, v || 5) }))
  const removeAt = (i: number) => setCfg(c => ({ ...c, slides: c.slides.filter((_, j) => j !== i) }))
  const addSlide = (s: Slide) => { setCfg(c => ({ ...c, slides: [...c.slides, s] })); setAdding(false) }

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-2xl font-extrabold flex items-center gap-2.5 ${txt}`}>
          <Presentation size={24} className="text-indigo-500" /> Slide Show
        </h1>
        <p className={`text-sm mt-1 ${muted}`}>Apresentações automáticas de painéis para TV / reunião de diretoria.</p>
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
        <div className={`p-5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-lg font-extrabold ${txt}`}>Painéis Estratégicos</p>
              <p className={`text-xs mt-0.5 ${muted}`}>Rotação automática dos painéis selecionados, em tela cheia.</p>
            </div>
            <button
              onClick={() => resolved.length > 0 && setPlaying(true)}
              disabled={resolved.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shrink-0"
            >
              <Play size={16} /> Iniciar apresentação
            </button>
          </div>

          <div className="mt-4">
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Painéis na rotação ({resolved.length})</p>
            <div className="flex flex-wrap items-center gap-2">
              {cfg.slides.map((s, i) => {
                const def = byKey[s.key]
                if (!def) return null
                const ok = can(s.key)
                return (
                  <span key={`${slideKey(s)}-${i}`} className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${soft} ${ok ? txt : 'opacity-50'}`}>
                    <span>{def.emoji}</span> {slideLabel(s, def)}
                    {!ok && <span className="text-[9px] text-amber-500">(sem acesso)</span>}
                    <button onClick={() => removeAt(i)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                  </span>
                )
              })}
              <div className="relative">
                <button onClick={() => setAdding(a => !a)} disabled={addable.length === 0}
                  className={`inline-flex items-center gap-1 rounded-xl border border-dashed px-2.5 py-1.5 text-xs font-semibold ${muted} ${isDark ? 'border-white/15 hover:bg-white/[0.04]' : 'border-slate-300 hover:bg-slate-50'} disabled:opacity-40`}>
                  <Plus size={13} /> Adicionar
                </button>
                {adding && addable.length > 0 && (
                  <div className={`absolute z-20 mt-1 min-w-[220px] max-h-[320px] overflow-auto rounded-xl border shadow-xl overflow-hidden ${card}`}>
                    {addable.map((s, i) => {
                      const def = byKey[s.key]
                      return (
                        <button key={`${slideKey(s)}-${i}`} onClick={() => addSlide(s)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs ${txt} ${isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'}`}>
                          <span>{def?.emoji}</span> {slideLabel(s, def)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Clock size={15} className={muted} />
            <span className={`text-xs font-semibold ${muted}`}>Tempo por painel:</span>
            <input type="number" min={5} value={cfg.intervalSec} onChange={e => setInterval(Number(e.target.value))}
              className={`w-20 text-sm rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
            <span className={`text-xs ${muted}`}>segundos</span>
          </div>
        </div>

        <div className={`px-5 py-4 flex items-start gap-3 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/60'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
            <Mail size={17} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${txt}`}>Envio automático à diretoria</p>
            <p className={`text-xs mt-0.5 ${muted}`}>
              Agendado para <b className={txt}>toda segunda-feira às 08h (horário de Brasília)</b>.
              Os painéis selecionados são exportados num PDF único e enviados por e-mail.
              <span className="block mt-1 text-amber-500 font-semibold">Pendente de ativação do envio no servidor.</span>
            </p>
          </div>
        </div>
      </div>

      {playing && resolved.length > 0 && (
        <SlideShowPlayer slides={resolved} intervalSec={cfg.intervalSec} onClose={() => setPlaying(false)} />
      )}
    </div>
  )
}
