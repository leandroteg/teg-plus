import { useState, useMemo } from 'react'
import {
  RefreshCcw, Plus, X, Loader2, AlertTriangle, Calendar, CheckCircle2, Circle, ChevronRight,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useRegistros, useCriarRegistro, useAtualizarRegistro,
  useAcoes, useCriarAcao, useAtualizarAcao,
} from '../../hooks/useSgi'
import {
  PDCA_STAGES, TIPO_REGISTRO_LABEL, ORIGEM_REGISTRO_LABEL, GRAVIDADE_CFG, STATUS_ACAO_LABEL,
} from '../../types/sgi'
import type {
  SgiRegistro, StatusPdca, TipoRegistro, OrigemRegistro, Gravidade,
} from '../../types/sgi'

const fmtDate = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—')

// ── Card do registro ──────────────────────────────────────────────────────────
function RegistroCard({ r, isDark, onClick }: { r: SgiRegistro; isDark: boolean; onClick: () => void }) {
  const g = GRAVIDADE_CFG[r.gravidade]
  const hoje = new Date().toISOString().split('T')[0]
  const atrasado = r.prazo && r.prazo < hoje && r.status_pdca !== 'encerrado'
  return (
    <button onClick={onClick} className={`w-full text-left rounded-xl border p-2.5 transition-all ${isDark ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]' : 'bg-white border-slate-200 hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.codigo || '—'}</span>
        {r.classificacao === 'nc' && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">NC</span>}
      </div>
      <p className={`text-xs font-semibold leading-tight mb-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>{r.titulo}</p>
      <div className="flex flex-wrap items-center gap-1">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${g.bg} ${g.text}`}>{g.label}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-white/[0.05] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{TIPO_REGISTRO_LABEL[r.tipo]}</span>
        {r.prazo && <span className={`text-[9px] flex items-center gap-0.5 ${atrasado ? 'text-red-500 font-bold' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><Calendar size={9} />{fmtDate(r.prazo)}</span>}
      </div>
    </button>
  )
}

// ── Modal de detalhe (avança PDCA + ações) ────────────────────────────────────
function RegistroModal({ registro, onClose, isDark }: { registro: SgiRegistro; onClose: () => void; isDark: boolean }) {
  const atualizar = useAtualizarRegistro()
  const { data: acoes = [] } = useAcoes({ origem_id: registro.id })
  const criarAcao = useCriarAcao()
  const atualizarAcao = useAtualizarAcao()
  const [novaAcao, setNovaAcao] = useState('')
  const [novaPrazo, setNovaPrazo] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const cardBg = isDark ? 'bg-white/[0.04]' : 'bg-slate-50'
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const g = GRAVIDADE_CFG[registro.gravidade]
  const stageIdx = PDCA_STAGES.findIndex(s => s.key === registro.status_pdca)

  const setStatus = (s: StatusPdca) => atualizar.mutate({ id: registro.id, status_pdca: s, ...(s === 'encerrado' ? { encerrado_em: new Date().toISOString() } : {}) })
  const setClassif = (c: 'nc' | 'registro' | 'dispensado') => atualizar.mutate({ id: registro.id, classificacao: c, ...(c === 'nc' && registro.status_pdca === 'pendente' ? { status_pdca: 'analise_causa' as StatusPdca } : {}) })

  const addAcao = async () => {
    if (!novaAcao.trim()) return
    await criarAcao.mutateAsync({ origem_tipo: 'registro', origem_id: registro.id, titulo: novaAcao.trim(), prazo: novaPrazo || undefined, status: 'aberta' })
    setNovaAcao(''); setNovaPrazo('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <div className="flex items-center gap-2 min-w-0">
            <RefreshCcw size={18} className="text-amber-500 shrink-0" />
            <h3 className={`text-base font-bold truncate ${txt}`}>{registro.codigo ? `${registro.codigo} · ` : ''}{registro.titulo}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Stepper PDCA */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Fluxo PDCA</p>
            <div className="flex flex-wrap gap-1.5">
              {PDCA_STAGES.map((s, i) => (
                <button key={s.key} disabled={atualizar.isPending} onClick={() => setStatus(s.key)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-all ${
                    i === stageIdx ? `${s.bar} text-white` : i < stageIdx ? (isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-200 text-slate-600') : (isDark ? 'bg-white/[0.03] text-slate-500' : 'bg-slate-50 text-slate-400')
                  }`}>
                  {i + 1}. {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Classificação */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Triagem / Classificação</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs mb-3">
              <div><p className={muted}>Tipo</p><p className={`font-semibold ${txt}`}>{TIPO_REGISTRO_LABEL[registro.tipo]}</p></div>
              <div><p className={muted}>Origem</p><p className={`font-semibold ${txt}`}>{ORIGEM_REGISTRO_LABEL[registro.origem]}</p></div>
              <div><p className={muted}>Gravidade</p><span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${g.bg} ${g.text}`}><span className={`w-1.5 h-1.5 rounded-full ${g.dot}`} />{g.label}</span></div>
              <div><p className={muted}>Área</p><p className={`font-semibold ${txt}`}>{registro.area_processo || '—'}</p></div>
            </div>
            <div className="flex gap-1.5">
              {([['nc', 'É Não Conformidade'], ['registro', 'Só registro'], ['dispensado', 'Dispensar']] as const).map(([c, lbl]) => (
                <button key={c} onClick={() => setClassif(c)} disabled={atualizar.isPending}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${
                    registro.classificacao === c
                      ? c === 'nc' ? 'bg-red-500 text-white border-red-500' : 'bg-slate-600 text-white border-slate-600'
                      : isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>{lbl}</button>
              ))}
            </div>
          </div>

          {registro.descricao && (
            <div className={`rounded-xl p-4 ${cardBg}`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Descrição</p>
              <p className={`text-xs ${txt}`}>{registro.descricao}</p>
            </div>
          )}

          {/* Ações (backbone sgi_acoes) */}
          <div className={`rounded-xl p-4 ${cardBg}`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Plano de Ação ({acoes.length})</p>
            <div className="space-y-2 mb-3">
              {acoes.length === 0 && <p className={`text-xs ${muted}`}>Nenhuma ação ainda.</p>}
              {acoes.map(a => {
                const sa = STATUS_ACAO_LABEL[a.status]
                const done = a.status === 'concluida'
                return (
                  <div key={a.id} className={`flex items-center gap-2 rounded-lg p-2 ${isDark ? 'bg-white/[0.03]' : 'bg-white border border-slate-100'}`}>
                    <button onClick={() => atualizarAcao.mutate({ id: a.id, status: done ? 'aberta' : 'concluida', concluida_em: done ? null : new Date().toISOString() })} className="shrink-0">
                      {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-slate-400" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-medium truncate ${done ? 'line-through ' + muted : txt}`}>{a.titulo}</p>
                      {a.prazo && <p className={`text-[10px] ${muted}`}>Prazo {fmtDate(a.prazo)}</p>}
                    </div>
                    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${sa.bg} ${sa.text}`}>{sa.label}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2">
              <input value={novaAcao} onChange={e => setNovaAcao(e.target.value)} placeholder="Nova ação corretiva..."
                className={`flex-1 text-xs rounded-lg px-2.5 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200'}`} />
              <input type="date" value={novaPrazo} onChange={e => setNovaPrazo(e.target.value)}
                className={`w-32 text-xs rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200'}`} />
              <button onClick={addAcao} disabled={criarAcao.isPending || !novaAcao.trim()} className="px-2.5 rounded-lg bg-violet-600 text-white disabled:opacity-50">
                {criarAcao.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className={`flex-1 py-3 rounded-xl border text-sm font-semibold transition-all ${isDark ? 'border-white/[0.06] text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Fechar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal nova anomalia (categorização inicial) ───────────────────────────────
function NovaAnomaliaModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const criar = useCriarRegistro()
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<TipoRegistro>('anomalia')
  const [origem, setOrigem] = useState<OrigemRegistro>('campo')
  const [gravidade, setGravidade] = useState<Gravidade>('media')
  const [area, setArea] = useState('')
  const [descricao, setDescricao] = useState('')

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full text-sm rounded-xl px-3 py-2 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-amber-500' : 'bg-white border-slate-200 text-slate-800 focus:border-amber-400'}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    await criar.mutateAsync({ titulo: titulo.trim(), tipo, origem, gravidade, area_processo: area || undefined, descricao: descricao || undefined, status_pdca: 'pendente', classificacao: 'pendente' })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>Nova Anomalia / Falha</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que aconteceu?" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoRegistro)} className={inputCls}>
                {Object.entries(TIPO_REGISTRO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Origem</label>
              <select value={origem} onChange={e => setOrigem(e.target.value as OrigemRegistro)} className={inputCls}>
                {Object.entries(ORIGEM_REGISTRO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Gravidade</label>
              <select value={gravidade} onChange={e => setGravidade(e.target.value as Gravidade)} className={inputCls}>
                {Object.entries(GRAVIDADE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Área / Processo</label>
              <input value={area} onChange={e => setArea(e.target.value)} placeholder="Ex.: Campo / LT" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Descrição</label>
            <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes / evidências..." className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={criar.isPending || !titulo.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {criar.isPending && <Loader2 size={14} className="animate-spin" />} Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main (kanban PDCA) ─────────────────────────────────────────────────────────
export default function SgiMelhoriaContinua() {
  const { isDark } = useTheme()
  const { data: registros = [], isLoading } = useRegistros()
  const [detail, setDetail] = useState<SgiRegistro | null>(null)
  const [showNovo, setShowNovo] = useState(false)

  const porStatus = useMemo(() => {
    const m: Record<string, SgiRegistro[]> = {}
    PDCA_STAGES.forEach(s => { m[s.key] = [] })
    registros.forEach(r => { (m[r.status_pdca] ||= []).push(r) })
    return m
  }, [registros])

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-amber-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <RefreshCcw size={22} className="text-amber-500" /> Melhoria Contínua
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Anomalias, não conformidades e ações corretivas (PDCA)</p>
        </div>
        <button onClick={() => setShowNovo(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors shrink-0">
          <Plus size={14} /> Nova Anomalia
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
        {PDCA_STAGES.map(s => (
          <div key={s.key} className={`shrink-0 w-[230px] rounded-2xl border ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-slate-50/60 border-slate-200'}`}>
            <div className={`flex items-center justify-between gap-2 px-3 py-2.5 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{s.label}</span>
              </span>
              <span className={`text-[10px] font-bold rounded-full min-w-[20px] text-center px-1.5 py-0.5 ${isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-200/80 text-slate-500'}`}>{porStatus[s.key].length}</span>
            </div>
            <div className="p-2 space-y-2 min-h-[80px] max-h-[calc(100vh-260px)] overflow-y-auto">
              {porStatus[s.key].map(r => <RegistroCard key={r.id} r={r} isDark={isDark} onClick={() => setDetail(r)} />)}
              {porStatus[s.key].length === 0 && <p className={`text-[10px] text-center py-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>—</p>}
            </div>
          </div>
        ))}
      </div>

      {detail && <RegistroModal registro={detail} onClose={() => setDetail(null)} isDark={isDark} />}
      {showNovo && <NovaAnomaliaModal onClose={() => setShowNovo(false)} isDark={isDark} />}
    </div>
  )
}
