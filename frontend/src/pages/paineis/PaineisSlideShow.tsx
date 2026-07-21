import { useState, useEffect, useRef, Suspense, type ComponentType } from 'react'
import {
  Play, Pause, ChevronLeft, ChevronRight, X, Maximize2, Minimize2,
  Plus, Presentation, Mail, Loader2, Trash2, Clock, Pencil, ArrowUp, ArrowDown, Copy, Check,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { PAINEIS, type PainelDef } from './registry'
import { useSlideShows, useCriarSlideShow, useAtualizarSlideShow, useRemoverSlideShow, useDefinirEmailDiretoria, type SlideShow, type SlideItem } from '../../hooks/usePaineisSlideshows'
// (useAtualizarSlideShow é usado no editor)

const DEFAULT_INTERVAL = 20
const LS_KEY_LEGADO = 'paineis_slideshow_v2' // config antiga (localStorage) — semeia o 1º slide show

const DEFAULT_SLIDES: SlideItem[] = [
  { key: 'sgi' },
  { key: 'egp' },
  { key: 'egp', tab: 'faturamento', label: 'EGP · Projetos · Faturamento' },
  { key: 'egp', tab: 'medicao', label: 'EGP · Projetos · Medição' },
  { key: 'rh' },
  { key: 'patrimonial' },
]

const byKey: Record<string, PainelDef> = Object.fromEntries(PAINEIS.map(p => [p.key, p]))
const slideKey = (s: SlideItem) => `${s.key}${s.tab ? ':' + s.tab : ''}`
const subLabelOf = (def: PainelDef | undefined, tab?: string) => def?.subPaineis?.find(x => x.tab === tab)?.label
const slideLabel = (s: SlideItem) => {
  const def = byKey[s.key]
  if (s.label) return s.label
  if (!def) return s.key
  const sub = subLabelOf(def, s.tab)
  return sub ? `${def.label} · ${sub}` : def.label
}

type Resolved = { s: SlideItem; def: PainelDef }

// ── Player em tela cheia ──────────────────────────────────────────────────────
function SlideShowPlayer({ nome, slides, intervalSec, onClose }: { nome: string; slides: Resolved[]; intervalSec: number; onClose: () => void }) {
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
  const label = slideLabel(cur.s)
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
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Painel {idx + 1} de {n} · {nome}</p>
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

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 size={30} className="animate-spin text-indigo-500" /></div>}>
          <Painel key={slideKey(cur.s)} initialPainel={cur.s.tab} />
        </Suspense>
      </div>

      <div className={`flex items-center justify-center gap-2 py-2.5 ${isDark ? 'bg-black/30' : 'bg-white/80 border-t border-slate-200'}`}>
        {slides.map((r, i) => (
          <button key={i} onClick={() => setIdx(i)} title={slideLabel(r.s)}
            className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-indigo-500' : `w-2 ${isDark ? 'bg-white/25' : 'bg-slate-300'}`}`} />
        ))}
      </div>
      <style>{`@keyframes sshProg { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  )
}

// ── Editor de um slide show (modal) ───────────────────────────────────────────
function SlideShowEditor({ show, can, isDark, onClose }: { show: SlideShow; can: (k: string) => boolean; isDark: boolean; onClose: () => void }) {
  const atualizar = useAtualizarSlideShow()
  const [nome, setNome] = useState(show.nome)
  const [intervalo, setIntervalo] = useState(show.intervalo_sec)
  const [slides, setSlides] = useState<SlideItem[]>(show.slides)
  const [addKey, setAddKey] = useState('')
  const [addTab, setAddTab] = useState('')

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const panel = isDark ? 'bg-[#0f172a] border-white/[0.08]' : 'bg-white border-slate-200'
  const row = isDark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
  const inputCls = `text-sm rounded-lg px-2.5 py-1.5 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`

  const modulosDisp = PAINEIS.filter(p => can(p.key))
  const defAdd = addKey ? byKey[addKey] : undefined
  const move = (i: number, d: number) => setSlides(s => {
    const j = i + d; if (j < 0 || j >= s.length) return s
    const c = [...s];[c[i], c[j]] = [c[j], c[i]]; return c
  })
  const remove = (i: number) => setSlides(s => s.filter((_, j) => j !== i))
  const add = () => {
    if (!addKey) return
    const def = byKey[addKey]
    const sub = addTab ? def?.subPaineis?.find(x => x.tab === addTab) : undefined
    const item: SlideItem = { key: addKey, tab: addTab || undefined, label: sub ? `${def?.label} · ${sub.label}` : def?.label }
    setSlides(s => [...s, item]); setAddTab('')
  }
  const salvar = async () => {
    await atualizar.mutateAsync({ id: show.id, nome: nome.trim() || 'Slide show', intervalo_sec: Math.max(5, intervalo || 5), slides })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className={`w-full max-w-lg my-6 rounded-2xl border shadow-2xl ${panel}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between gap-2 px-5 py-4 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <p className={`text-base font-extrabold flex items-center gap-2 ${txt}`}><Pencil size={16} className="text-indigo-500" /> Editar slide show</p>
          <button onClick={onClose} className={`p-1 rounded-lg ${muted} hover:bg-slate-500/10`}><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[180px]">
              <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${muted}`}>Nome</span>
              <input value={nome} onChange={e => setNome(e.target.value)} className={`w-full ${inputCls}`} />
            </label>
            <label>
              <span className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${muted}`}>Seg./painel</span>
              <input type="number" min={5} value={intervalo} onChange={e => setIntervalo(Number(e.target.value))} className={`w-24 ${inputCls}`} />
            </label>
          </div>

          {/* Slides na ordem */}
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Slides ({slides.length}) · use ↑↓ p/ reordenar</p>
            <div className="space-y-1.5">
              {slides.length === 0 && <p className={`text-xs ${muted}`}>Nenhum slide ainda. Adicione abaixo.</p>}
              {slides.map((s, i) => {
                const def = byKey[s.key]
                return (
                  <div key={`${slideKey(s)}-${i}`} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${row}`}>
                    <span className={`text-[10px] font-mono ${muted}`}>{i + 1}</span>
                    <span className="text-base shrink-0">{def?.emoji ?? '❔'}</span>
                    <span className={`flex-1 min-w-0 text-xs font-semibold truncate ${def ? txt : 'text-amber-500'}`}>{slideLabel(s)}{!def && ' (módulo desconhecido)'}</span>
                    <button onClick={() => move(i, -1)} disabled={i === 0} className={`p-1 rounded ${muted} hover:text-indigo-500 disabled:opacity-30`}><ArrowUp size={13} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === slides.length - 1} className={`p-1 rounded ${muted} hover:text-indigo-500 disabled:opacity-30`}><ArrowDown size={13} /></button>
                    <button onClick={() => remove(i)} className="p-1 rounded text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Adicionar slide: módulo → sub-painel (se houver) */}
          <div className={`rounded-xl border p-3 ${row}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Adicionar slide</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={addKey} onChange={e => { setAddKey(e.target.value); setAddTab('') }} className={inputCls}>
                <option value="">Módulo…</option>
                {modulosDisp.map(p => <option key={p.key} value={p.key}>{p.emoji} {p.label}</option>)}
              </select>
              {defAdd?.subPaineis && defAdd.subPaineis.length > 0 && (
                <select value={addTab} onChange={e => setAddTab(e.target.value)} className={inputCls}>
                  <option value="">Painel inteiro</option>
                  {defAdd.subPaineis.map(sp => <option key={sp.tab} value={sp.tab}>{sp.label}</option>)}
                </select>
              )}
              <button onClick={add} disabled={!addKey} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-40">
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {defAdd && (!defAdd.subPaineis || defAdd.subPaineis.length === 0) && <p className={`text-[10px] mt-1.5 ${muted}`}>Este módulo não tem sub-painéis — entra como painel único.</p>}
          </div>
        </div>

        <div className={`flex items-center justify-end gap-2 px-5 py-4 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
          <button onClick={onClose} className={`px-3 py-2 rounded-lg text-sm font-semibold ${isDark ? 'text-slate-300 hover:bg-white/[0.06]' : 'text-slate-600 hover:bg-slate-100'}`}>Cancelar</button>
          <button onClick={salvar} disabled={atualizar.isPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
            {atualizar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página: Slide Shows ───────────────────────────────────────────────────────
export default function PaineisSlideShow() {
  const { isDark } = useTheme()
  const { isAdmin, hasModule, perfil } = useAuth()
  const { data: shows = [], isLoading } = useSlideShows()
  const criar = useCriarSlideShow()
  const remover = useRemoverSlideShow()
  const definirEmail = useDefinirEmailDiretoria()

  const [playing, setPlaying] = useState<SlideShow | null>(null)
  const [editing, setEditing] = useState<SlideShow | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [enviarPara, setEnviarPara] = useState('leandro.mallet@teguniao.com.br')
  const [enviando, setEnviando] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const seededRef = useRef(false)

  const WEBHOOK_ENVIAR = 'https://teg-agents-n8n.nmmcas.easypanel.host/webhook/paineis-enviar-agora'
  const enviarAgora = async () => {
    setEnviando('sending')
    try {
      const r = await fetch(WEBHOOK_ENVIAR, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ para: enviarPara.trim() }) })
      setEnviando(r.ok ? 'sent' : 'error')
    } catch { setEnviando('error') }
    setTimeout(() => setEnviando('idle'), 8000)
  }

  const can = (k: string) => isAdmin || hasModule(k)

  // Semeia o 1º slide show a partir da config antiga (localStorage) ou do padrão.
  useEffect(() => {
    if (isLoading || shows.length > 0 || seededRef.current || criar.isPending) return
    seededRef.current = true
    let slides = DEFAULT_SLIDES
    try {
      const r = JSON.parse(localStorage.getItem(LS_KEY_LEGADO) || 'null')
      if (r && Array.isArray(r.slides) && r.slides.length) slides = r.slides
    } catch { /* ignore */ }
    criar.mutate({ nome: 'Painéis Estratégicos', intervalo_sec: DEFAULT_INTERVAL, slides, criado_por_nome: perfil?.nome ?? null })
  }, [isLoading, shows.length])

  const resolve = (show: SlideShow): Resolved[] =>
    show.slides.map(s => ({ s, def: byKey[s.key] })).filter((r): r is Resolved => !!r.def && can(r.s.key))

  const criarNovo = () => {
    const nome = novoNome.trim(); if (!nome) return
    criar.mutate({ nome, intervalo_sec: DEFAULT_INTERVAL, slides: [], criado_por_nome: perfil?.nome ?? null })
    setNovoNome('')
  }
  const duplicar = (s: SlideShow) => criar.mutate({ nome: `${s.nome} (cópia)`, intervalo_sec: s.intervalo_sec, slides: s.slides, criado_por_nome: perfil?.nome ?? null })

  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const card = isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'
  const inputCls = `text-sm rounded-lg px-2.5 py-1.5 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`

  return (
    <div className="space-y-5">
      <div>
        <h1 className={`text-2xl font-extrabold flex items-center gap-2.5 ${txt}`}>
          <Presentation size={24} className="text-indigo-500" /> Slide Shows
        </h1>
        <p className={`text-sm mt-1 ${muted}`}>Apresentações automáticas de painéis para TV / reunião de diretoria. Crie quantos quiser.</p>
      </div>

      {/* Criar novo */}
      <div className={`rounded-2xl border shadow-sm p-4 ${card}`}>
        <div className="flex flex-wrap items-center gap-2">
          <input value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') criarNovo() }}
            placeholder="Nome do novo slide show (ex.: Reunião Diretoria)" className={`flex-1 min-w-[220px] ${inputCls}`} />
          <button onClick={criarNovo} disabled={!novoNome.trim() || criar.isPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
            <Plus size={16} /> Novo slide show
          </button>
        </div>
      </div>

      {/* Lista de slide shows */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 size={26} className="animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {shows.map(s => {
            const res = resolve(s)
            const semAcesso = s.slides.length - res.length
            return (
              <div key={s.id} className={`rounded-2xl border shadow-sm p-4 ${card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-base font-extrabold truncate ${txt}`}>{s.nome}</p>
                    <p className={`text-xs mt-0.5 ${muted}`}>{s.slides.length} slide{s.slides.length !== 1 ? 's' : ''} · {s.intervalo_sec}s cada{semAcesso > 0 ? ` · ${semAcesso} sem acesso` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditing(s)} title="Editar" className={`w-8 h-8 rounded-lg flex items-center justify-center ${muted} ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-100'}`}><Pencil size={15} /></button>
                    <button onClick={() => duplicar(s)} title="Duplicar" className={`w-8 h-8 rounded-lg flex items-center justify-center ${muted} ${isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-slate-100'}`}><Copy size={15} /></button>
                    <button onClick={() => { if (confirm(`Excluir o slide show "${s.nome}"?`)) remover.mutate(s.id) }} title="Excluir" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10"><Trash2 size={15} /></button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.slides.map((sl, i) => {
                    const def = byKey[sl.key]
                    return <span key={`${slideKey(sl)}-${i}`} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${isDark ? 'bg-white/[0.05] text-slate-300' : 'bg-slate-100 text-slate-600'} ${can(sl.key) ? '' : 'opacity-50'}`}><span>{def?.emoji ?? '❔'}</span>{slideLabel(sl)}</span>
                  })}
                  {s.slides.length === 0 && <span className={`text-xs ${muted}`}>Sem slides — clique em editar.</span>}
                </div>

                <button onClick={() => res.length > 0 && setPlaying(s)} disabled={res.length === 0}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                  <Play size={16} /> Iniciar apresentação
                </button>

                {/* Qual slide show é enviado à diretoria (dia 20) — exclusivo */}
                {s.enviar_diretoria ? (
                  <div className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                    <Mail size={14} /> Este é o enviado à diretoria (dia 20)
                  </div>
                ) : (
                  <button onClick={() => definirEmail.mutate(s.id)} disabled={definirEmail.isPending}
                    className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border ${isDark ? 'border-white/10 text-slate-300 hover:bg-white/[0.04]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'} disabled:opacity-50`}>
                    <Mail size={13} /> Usar este no e-mail da diretoria
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Envio automático à diretoria */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${card}`}>
        <div className={`px-5 py-4 flex items-start gap-3 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/60'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
            <Mail size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${txt}`}>Envio automático à diretoria</p>
            <p className={`text-xs mt-0.5 ${muted}`}>Todo <b className={txt}>dia 20, às 08h (Brasília)</b>, o slide show <b className={txt}>{shows.find(s => s.enviar_diretoria)?.nome ?? '— (nenhum marcado)'}</b> é exportado num PDF único (screenshot real de cada painel) e enviado para <b className={txt}>diretoria@teguniao.com.br</b>. Marque qual slide show enviar no botão de cada card acima.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input type="email" value={enviarPara} onChange={e => setEnviarPara(e.target.value)} placeholder="destinatario@teguniao.com.br"
                className={`text-xs rounded-lg px-2.5 py-1.5 border outline-none w-full sm:w-72 ${isDark ? 'bg-white/[0.05] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`} />
              <button onClick={enviarAgora} disabled={enviando === 'sending'} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 shrink-0">
                {enviando === 'sending' ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Enviar agora
              </button>
              {enviando === 'sent' && <span className="text-[11px] font-semibold text-emerald-500">✓ Enviando — chega em ~2 min</span>}
              {enviando === 'error' && <span className="text-[11px] font-semibold text-red-500">Falhou — tente de novo</span>}
            </div>
            <p className={`text-[10px] mt-1.5 ${muted}`}>Sempre com cópia para <b>leandro.mallet@teguniao.com.br</b></p>
          </div>
        </div>
      </div>

      {playing && resolve(playing).length > 0 && (
        <SlideShowPlayer nome={playing.nome} slides={resolve(playing)} intervalSec={playing.intervalo_sec} onClose={() => setPlaying(null)} />
      )}
      {editing && (
        <SlideShowEditor show={editing} can={can} isDark={isDark} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
