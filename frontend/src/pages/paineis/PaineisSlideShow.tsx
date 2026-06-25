import { useState, useEffect, useRef, Suspense } from 'react'
import {
  Play, Pause, ChevronLeft, ChevronRight, X, Maximize2, Minimize2,
  Plus, Presentation, Mail, Loader2, Trash2, Clock,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { PAINEIS, type PainelDef } from './registry'

// Persistência local da configuração do slide show (intervalo + painéis).
// Quando o envio automático por e-mail for ligado no backend, a config migra p/ DB.
const LS_KEY = 'paineis_slideshow_v1'
const DEFAULT_KEYS = ['sgi', 'egp', 'rh']   // Gestão · Projetos · RH
const DEFAULT_INTERVAL = 20

type Cfg = { paineis: string[]; intervalSec: number }
function loadCfg(): Cfg {
  try {
    const r = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (r && Array.isArray(r.paineis) && r.paineis.length) return { paineis: r.paineis, intervalSec: Number(r.intervalSec) || DEFAULT_INTERVAL }
  } catch { /* ignore */ }
  return { paineis: DEFAULT_KEYS, intervalSec: DEFAULT_INTERVAL }
}

// ── Player em tela cheia ──────────────────────────────────────────────────────
function SlideShowPlayer({ slides, intervalSec, onClose }: { slides: PainelDef[]; intervalSec: number; onClose: () => void }) {
  const { isDark } = useTheme()
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [fs, setFs] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const n = slides.length
  const go = (d: number) => setIdx(i => (i + d + n) % n)

  // Auto-avanço
  useEffect(() => {
    if (!playing || n <= 1) return
    const t = setTimeout(() => setIdx(i => (i + 1) % n), Math.max(3, intervalSec) * 1000)
    return () => clearTimeout(t)
  }, [playing, idx, intervalSec, n])

  // Teclado
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
  const bg = isDark ? 'bg-[#0b1220]' : 'bg-slate-50'
  const ctrlBg = isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'

  return (
    <div ref={rootRef} className={`fixed inset-0 z-[100] flex flex-col ${bg}`}>
      {/* Top bar */}
      <div className={`flex items-center justify-between gap-3 px-5 py-3 ${isDark ? 'bg-black/30' : 'bg-white/80 border-b border-slate-200'} backdrop-blur`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">{cur.emoji}</span>
          <div className="min-w-0">
            <p className={`text-base font-extrabold leading-tight truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{cur.label}</p>
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

      {/* Barra de progresso (reinicia a cada slide) */}
      <div className="h-1 bg-black/10">
        <div key={`${idx}-${playing}`} className="h-full bg-indigo-500"
          style={playing ? { animation: `sshProg ${Math.max(3, intervalSec)}s linear forwards` } : { width: '0%' }} />
      </div>

      {/* Painel atual */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 size={30} className="animate-spin text-indigo-500" /></div>}>
          <cur.Painel />
        </Suspense>
      </div>

      {/* Pontos de navegação */}
      <div className={`flex items-center justify-center gap-2 py-2.5 ${isDark ? 'bg-black/30' : 'bg-white/80 border-t border-slate-200'}`}>
        {slides.map((s, i) => (
          <button key={s.key} onClick={() => setIdx(i)} title={s.label}
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
  // Autoplay já no 1º render quando aberto via link direto (?autoplay=1) — sem depender de efeito/timing.
  const [playing, setPlaying] = useState(() => new URLSearchParams(window.location.search).get('autoplay') === '1')
  const [adding, setAdding] = useState(false)

  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(cfg)) }, [cfg])

  const can = (k: string) => isAdmin || hasModule(k)
  const byKey: Record<string, PainelDef> = Object.fromEntries(PAINEIS.map(p => [p.key, p]))
  const slides = cfg.paineis.map(k => byKey[k]).filter(Boolean).filter(p => can(p.key))
  const disponiveis = PAINEIS.filter(p => can(p.key) && !cfg.paineis.includes(p.key))

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const card = isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'
  const soft = isDark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-slate-50 border-slate-200'

  const setInterval = (v: number) => setCfg(c => ({ ...c, intervalSec: Math.max(5, v || 5) }))
  const removePainel = (k: string) => setCfg(c => ({ ...c, paineis: c.paineis.filter(x => x !== k) }))
  const addPainel = (k: string) => { setCfg(c => ({ ...c, paineis: [...c.paineis, k] })); setAdding(false) }

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-2xl font-extrabold flex items-center gap-2.5 ${txt}`}>
          <Presentation size={24} className="text-indigo-500" /> Slide Show
        </h1>
        <p className={`text-sm mt-1 ${muted}`}>Apresentações automáticas de painéis para TV / reunião de diretoria.</p>
      </div>

      {/* Item: Painéis Estratégicos */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
        <div className={`p-5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-lg font-extrabold ${txt}`}>Painéis Estratégicos</p>
              <p className={`text-xs mt-0.5 ${muted}`}>Rotação automática dos painéis selecionados, em tela cheia.</p>
            </div>
            <button
              onClick={() => slides.length > 0 && setPlaying(true)}
              disabled={slides.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 shrink-0"
            >
              <Play size={16} /> Iniciar apresentação
            </button>
          </div>

          {/* Painéis na rotação */}
          <div className="mt-4">
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Painéis na rotação ({slides.length})</p>
            <div className="flex flex-wrap items-center gap-2">
              {cfg.paineis.map(k => {
                const p = byKey[k]
                if (!p) return null
                const ok = can(k)
                return (
                  <span key={k} className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${soft} ${ok ? txt : 'opacity-50'}`}>
                    <span>{p.emoji}</span> {p.label}
                    {!ok && <span className="text-[9px] text-amber-500">(sem acesso)</span>}
                    <button onClick={() => removePainel(k)} className="text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                  </span>
                )
              })}
              <div className="relative">
                <button onClick={() => setAdding(a => !a)} disabled={disponiveis.length === 0}
                  className={`inline-flex items-center gap-1 rounded-xl border border-dashed px-2.5 py-1.5 text-xs font-semibold ${muted} ${isDark ? 'border-white/15 hover:bg-white/[0.04]' : 'border-slate-300 hover:bg-slate-50'} disabled:opacity-40`}>
                  <Plus size={13} /> Adicionar
                </button>
                {adding && disponiveis.length > 0 && (
                  <div className={`absolute z-20 mt-1 min-w-[200px] rounded-xl border shadow-xl overflow-hidden ${card}`}>
                    {disponiveis.map(p => (
                      <button key={p.key} onClick={() => addPainel(p.key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs ${txt} ${isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-50'}`}>
                        <span>{p.emoji}</span> {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Intervalo */}
          <div className="mt-4 flex items-center gap-2">
            <Clock size={15} className={muted} />
            <span className={`text-xs font-semibold ${muted}`}>Tempo por painel:</span>
            <input type="number" min={5} value={cfg.intervalSec} onChange={e => setInterval(Number(e.target.value))}
              className={`w-20 text-sm rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
            <span className={`text-xs ${muted}`}>segundos</span>
          </div>
        </div>

        {/* Envio automático (agendamento) */}
        <div className={`px-5 py-4 flex items-start gap-3 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/60'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
            <Mail size={17} />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${txt}`}>Envio automático à diretoria</p>
            <p className={`text-xs mt-0.5 ${muted}`}>
              Agendado para <b className={txt}>toda segunda-feira às 08h (horário de Brasília)</b>.
              O resumo dos painéis (Gestão · Projetos · RH) será enviado por e-mail.
              <span className="block mt-1 text-amber-500 font-semibold">Pendente de ativação do envio no servidor.</span>
            </p>
          </div>
        </div>
      </div>

      {playing && slides.length > 0 && (
        <SlideShowPlayer slides={slides} intervalSec={cfg.intervalSec} onClose={() => setPlaying(false)} />
      )}
    </div>
  )
}
