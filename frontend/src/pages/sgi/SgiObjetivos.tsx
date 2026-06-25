import { useState, useMemo } from 'react'
import {
  Target, Plus, X, Loader2, TrendingUp, TrendingDown, CheckCircle2, Circle, Send,
  Pencil, Trash2, Search, LayoutList, LayoutGrid, AlertTriangle,
} from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  useObjetivos, useCriarObjetivo, useCriarMeta, useLancarCheckin,
  useAtualizarObjetivo, useAtualizarMeta, useRemoverObjetivo, useRemoverMeta,
  useAcoes, useCriarAcao, useAtualizarAcao, useCriarRegistro,
} from '../../hooks/useSgi'
import { FAROL_CFG, STATUS_ACAO_LABEL } from '../../types/sgi'
import type { SgiObjetivo, SgiMeta, SgiCheckin, SgiAcao, DirecaoMeta, Farol } from '../../types/sgi'

type MetaFull = SgiMeta & { checkins: SgiCheckin[] }
type ObjFull = SgiObjetivo & { metas: MetaFull[] }

const fmtDate = (d?: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—')
const ultimoCheckin = (m: MetaFull): SgiCheckin | null =>
  m.checkins?.length ? [...m.checkins].sort((a, b) => (b.competencia || '').localeCompare(a.competencia || ''))[0] : null
const alvoLabel = (obj: { direcao: DirecaoMeta; unidade?: string | null }, alvo?: number | null) =>
  `${obj.direcao === 'menor_melhor' ? '≤' : '≥'} ${alvo ?? '—'}${obj.unidade ? ` ${obj.unidade}` : ''}`

// ── Abas (padrão Gestao/Padronizacao) ─────────────────────────────────────────
type TabKey = 'anuais' | 'trimestrais' | 'plano' | 'checkin' | 'revisao'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'anuais',      label: 'Metas Anuais' },
  { key: 'trimestrais', label: 'Metas Trimestrais' },
  { key: 'plano',       label: 'Plano de Ação' },
  { key: 'checkin',     label: 'Check-in Mensal' },
  { key: 'revisao',     label: 'Revisão' },
]
type AccentSet = { bg: string; bgActive: string; text: string; textActive: string; badge: string; border: string }
const TAB_ACCENT: Record<TabKey, AccentSet> = {
  anuais:      { bg:'bg-emerald-50', bgActive:'bg-emerald-100', text:'text-emerald-500', textActive:'text-emerald-800', badge:'bg-emerald-200/80 text-emerald-700', border:'border-emerald-200' },
  trimestrais: { bg:'bg-teal-50',    bgActive:'bg-teal-100',    text:'text-teal-500',    textActive:'text-teal-800',    badge:'bg-teal-200/80 text-teal-700',       border:'border-teal-200' },
  plano:       { bg:'bg-violet-50',  bgActive:'bg-violet-100',  text:'text-violet-500',  textActive:'text-violet-800',  badge:'bg-violet-200/80 text-violet-700',   border:'border-violet-200' },
  checkin:     { bg:'bg-sky-50',     bgActive:'bg-sky-100',     text:'text-sky-500',     textActive:'text-sky-800',     badge:'bg-sky-200/80 text-sky-700',         border:'border-sky-200' },
  revisao:     { bg:'bg-amber-50',   bgActive:'bg-amber-100',   text:'text-amber-500',   textActive:'text-amber-800',   badge:'bg-amber-200/80 text-amber-700',     border:'border-amber-200' },
}
const TAB_ACCENT_DARK: Record<TabKey, AccentSet> = {
  anuais:      { bg:'bg-emerald-500/5', bgActive:'bg-emerald-500/15', text:'text-emerald-400', textActive:'text-emerald-200', badge:'bg-emerald-500/15 text-emerald-300', border:'border-emerald-500/20' },
  trimestrais: { bg:'bg-teal-500/5',    bgActive:'bg-teal-500/15',    text:'text-teal-400',    textActive:'text-teal-200',    badge:'bg-teal-500/15 text-teal-300',       border:'border-teal-500/20' },
  plano:       { bg:'bg-violet-500/5',  bgActive:'bg-violet-500/15',  text:'text-violet-400',  textActive:'text-violet-200',  badge:'bg-violet-500/15 text-violet-300',   border:'border-violet-500/20' },
  checkin:     { bg:'bg-sky-500/5',     bgActive:'bg-sky-500/15',     text:'text-sky-400',     textActive:'text-sky-200',     badge:'bg-sky-500/15 text-sky-300',         border:'border-sky-500/20' },
  revisao:     { bg:'bg-amber-500/5',   bgActive:'bg-amber-500/15',   text:'text-amber-400',   textActive:'text-amber-200',   badge:'bg-amber-500/15 text-amber-300',     border:'border-amber-500/20' },
}

// ── Modal Novo / Editar Objetivo (+ meta anual) ───────────────────────────────
function ObjetivoModal({ edit, onClose, isDark }: { edit?: ObjFull; onClose: () => void; isDark: boolean }) {
  const criarObj = useCriarObjetivo()
  const criarMeta = useCriarMeta()
  const atualizarObj = useAtualizarObjetivo()
  const atualizarMeta = useAtualizarMeta()
  const anoAtual = edit?.ano ?? new Date().getFullYear()
  const metaAnual = edit?.metas.find(m => m.periodo === 'anual')
  const [titulo, setTitulo] = useState(edit?.titulo ?? '')
  const [area, setArea] = useState(edit?.area_processo ?? '')
  const [indicador, setIndicador] = useState(edit?.indicador ?? '')
  const [unidade, setUnidade] = useState(edit?.unidade ?? '')
  const [direcao, setDirecao] = useState<DirecaoMeta>(edit?.direcao ?? 'maior_melhor')
  const [alvo, setAlvo] = useState(metaAnual?.alvo != null ? String(metaAnual.alvo) : '')
  const [salvando, setSalvando] = useState(false)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full text-sm rounded-xl px-3 py-2 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white placeholder-slate-500 focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-400'}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) return
    setSalvando(true)
    try {
      const fields = { titulo: titulo.trim(), area_processo: area || undefined, indicador: indicador || undefined, unidade: unidade || undefined, direcao }
      if (edit) {
        await atualizarObj.mutateAsync({ id: edit.id, ...fields })
        if (metaAnual) await atualizarMeta.mutateAsync({ id: metaAnual.id, alvo: alvo ? Number(alvo) : null })
        else await criarMeta.mutateAsync({ objetivo_id: edit.id, periodo: 'anual', ano: anoAtual, alvo: alvo ? Number(alvo) : undefined })
      } else {
        const obj = await criarObj.mutateAsync({ ...fields, ano: anoAtual, status: 'ativo' })
        await criarMeta.mutateAsync({ objetivo_id: obj.id, periodo: 'anual', ano: anoAtual, alvo: alvo ? Number(alvo) : undefined })
      }
      onClose()
    } finally { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold ${txt}`}>{edit ? 'Editar Objetivo' : `Novo Objetivo ${anoAtual}`}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Objetivo</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Reduzir taxa de frequência de acidentes" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Indicador</label>
              <input value={indicador} onChange={e => setIndicador(e.target.value)} placeholder="Ex.: TF" className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Unidade</label>
              <input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Ex.: %, nº" className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Direção</label>
              <select value={direcao} onChange={e => setDirecao(e.target.value as DirecaoMeta)} className={inputCls}>
                <option value="maior_melhor">Maior é melhor</option>
                <option value="menor_melhor">Menor é melhor</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Alvo anual</label>
              <input type="number" step="any" value={alvo} onChange={e => setAlvo(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={`block text-xs font-semibold mb-1 ${muted}`}>Área / Processo</label>
            <input value={area} onChange={e => setArea(e.target.value)} placeholder="Ex.: QSMS" className={inputCls} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Cancelar</button>
            <button type="submit" disabled={salvando || !titulo.trim()} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {salvando && <Loader2 size={14} className="animate-spin" />} {edit ? 'Salvar' : 'Criar Objetivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de confirmação de exclusão ──────────────────────────────────────────
function ConfirmDelModal({ label, pending, onConfirm, onClose, isDark }: { label: string; pending: boolean; onConfirm: () => void; onClose: () => void; isDark: boolean }) {
  const txt = isDark ? 'text-white' : 'text-slate-800'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className={`w-full max-w-sm rounded-2xl p-5 ${isDark ? 'bg-[#1e293b] border border-white/[0.06]' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2"><AlertTriangle size={20} className="text-red-500" /><p className={`text-base font-bold ${txt}`}>Remover?</p></div>
        <p className={`text-sm mb-4 ${muted}`}>{label} Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`px-3 py-2 rounded-lg text-sm font-semibold ${isDark ? 'bg-white/[0.06] text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
          <button onClick={onConfirm} disabled={pending} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
            {pending && <Loader2 size={14} className="animate-spin" />} Remover
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Check-in ────────────────────────────────────────────────────────────
function CheckinModal({ obj, meta, onClose, isDark }: { obj: ObjFull; meta: MetaFull; onClose: () => void; isDark: boolean }) {
  const lancar = useLancarCheckin()
  const mesAtual = new Date().toISOString().slice(0, 7)
  const [competencia, setCompetencia] = useState(mesAtual)
  const [realizado, setRealizado] = useState('')
  const [resultado, setResultado] = useState<{ farol?: string; registro_criado?: string | null } | null>(null)

  const bg = isDark ? 'bg-[#1e293b]' : 'bg-white'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputCls = `w-full text-sm rounded-xl px-3 py-2 border outline-none ${isDark ? 'bg-white/[0.05] border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-400'}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (realizado === '') return
    const r = await lancar.mutateAsync({ metaId: meta.id, competencia, realizado: Number(realizado) })
    setResultado(r)
  }
  const historico = [...(meta.checkins || [])].sort((a, b) => (b.competencia || '').localeCompare(a.competencia || ''))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${bg}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10 ${isDark ? 'border-white/[0.06] bg-[#1e293b]' : 'border-slate-100 bg-white'} rounded-t-2xl`}>
          <h3 className={`text-base font-bold truncate ${txt}`}>Check-in · {obj.titulo}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className={`text-xs ${muted}`}>{meta.periodo === 'anual' ? 'Meta anual' : `Trim. ${meta.trimestre}`} · alvo <b className={txt}>{alvoLabel(obj, meta.alvo)}</b> · {obj.direcao === 'maior_melhor' ? 'maior é melhor' : 'menor é melhor'}</p>
          <form onSubmit={submit} className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Competência</label>
              <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${muted}`}>Realizado</label>
              <input type="number" step="any" value={realizado} onChange={e => setRealizado(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <button type="submit" disabled={lancar.isPending || realizado === ''} className="col-span-2 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {lancar.isPending && <Loader2 size={14} className="animate-spin" />} Lançar Check-in
            </button>
          </form>
          {resultado && (
            <div className={`rounded-xl p-3 text-xs ${FAROL_CFG[(resultado.farol as Farol) || 'cinza'].bg} ${FAROL_CFG[(resultado.farol as Farol) || 'cinza'].text}`}>
              Farol: <b>{FAROL_CFG[(resultado.farol as Farol) || 'cinza'].label}</b>
              {resultado.registro_criado && <span className="block mt-1">⚠ Meta no vermelho — abriu registro de melhoria automaticamente.</span>}
            </div>
          )}
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Histórico</p>
            {historico.length === 0 ? <p className={`text-xs ${muted}`}>Sem check-ins ainda.</p> : (
              <div className="space-y-1.5">
                {historico.map(c => {
                  const f = FAROL_CFG[(c.farol as Farol) || 'cinza']
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className={muted}>{c.competencia}</span>
                      <span className={txt}>{c.realizado ?? '—'}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.bg} ${f.text}`}><span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />{f.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card de objetivo (gestão de metas: criar / editar / remover) ──────────────
function ObjetivoCard({ obj, periodo, isDark, txt, muted, card, onEdit, onDeleteObj, onDeleteMeta }: {
  obj: ObjFull; periodo: 'anual' | 'trimestral'; isDark: boolean; txt: string; muted: string; card: string
  onEdit: (o: ObjFull) => void; onDeleteObj: (o: ObjFull) => void; onDeleteMeta: (o: ObjFull, m: MetaFull) => void
}) {
  const criarMeta = useCriarMeta()
  const metas = obj.metas.filter(m => m.periodo === periodo).sort((a, b) => (a.trimestre || 0) - (b.trimestre || 0))
  const [addTri, setAddTri] = useState('1')
  const [addDesc, setAddDesc] = useState('')
  const [addPrazo, setAddPrazo] = useState('')
  const iconBtn = `p-1.5 rounded-lg ${isDark ? 'hover:bg-white/[0.08] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`

  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${card}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className={`text-sm font-bold ${txt}`}>{obj.titulo}</p>
          <p className={`text-[11px] flex flex-wrap items-center gap-x-1.5 ${muted}`}>
            <span>{obj.ano} · {obj.area_processo || '—'} · {obj.indicador || 'indicador'}{obj.unidade ? ` (${obj.unidade})` : ''}</span>
            <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-500">
              {obj.direcao === 'maior_melhor' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {obj.direcao === 'maior_melhor' ? 'maior é melhor' : 'menor é melhor'}
            </span>
          </p>
          {obj.descricao && <p className={`text-[11px] mt-1 leading-snug ${muted}`}>{obj.descricao}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onEdit(obj)} title="Editar objetivo" className={iconBtn}><Pencil size={14} /></button>
          <button onClick={() => onDeleteObj(obj)} title="Remover objetivo" className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-red-500/15 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="space-y-2">
        {metas.length === 0 && <p className={`text-xs ${muted}`}>Sem metas {periodo === 'anual' ? 'anuais' : 'trimestrais'}.</p>}
        {metas.map(m => (
          <div key={m.id} className={`flex items-start justify-between gap-2 rounded-xl p-3 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>{m.periodo === 'anual' ? 'Meta anual' : `Trim. ${m.trimestre}`}</p>
              {m.descricao
                ? <p className={`text-xs font-medium leading-snug ${txt}`}>{m.descricao}</p>
                : <p className={`text-2xl font-extrabold leading-tight ${txt}`}>{alvoLabel(obj, m.alvo)}</p>}
            </div>
            {periodo === 'trimestral' && (
              <button onClick={() => onDeleteMeta(obj, m)} title="Remover meta" className={`p-1.5 rounded-lg shrink-0 ${isDark ? 'hover:bg-red-500/15 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
      {periodo === 'trimestral' && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <select value={addTri} onChange={e => setAddTri(e.target.value)} className={`text-xs rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200'}`}>
            {[1, 2, 3, 4].map(t => <option key={t} value={t}>T{t}</option>)}
          </select>
          <input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Resultado-chave (KR)..."
            className={`flex-1 min-w-[140px] text-xs rounded-lg px-2.5 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200'}`} />
          <input type="date" value={addPrazo} onChange={e => setAddPrazo(e.target.value)}
            className={`w-32 text-xs rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200'}`} />
          <button onClick={() => { if (!addDesc.trim()) return; criarMeta.mutate({ objetivo_id: obj.id, periodo: 'trimestral', trimestre: Number(addTri), ano: obj.ano, descricao: addDesc.trim(), prazo: addPrazo || undefined }); setAddDesc(''); setAddPrazo('') }}
            disabled={criarMeta.isPending || !addDesc.trim()} className="px-2.5 rounded-lg bg-teal-600 text-white text-xs disabled:opacity-50"><Plus size={13} /></button>
        </div>
      )}
    </div>
  )
}

// ── Plano de Ação por meta trimestral ─────────────────────────────────────────
function PlanoAcaoMeta({ obj, meta, acoes, isDark, txt, muted, card }: {
  obj: ObjFull; meta: MetaFull; acoes: SgiAcao[]; isDark: boolean; txt: string; muted: string; card: string
}) {
  const criarAcao = useCriarAcao()
  const atualizarAcao = useAtualizarAcao()
  const [nova, setNova] = useState('')
  const [prazo, setPrazo] = useState('')
  const mine = acoes.filter(a => a.origem_tipo === 'meta' && a.origem_id === meta.id)
  const add = async () => {
    if (!nova.trim()) return
    await criarAcao.mutateAsync({ origem_tipo: 'meta', origem_id: meta.id, titulo: nova.trim(), prazo: prazo || undefined, status: 'aberta' })
    setNova(''); setPrazo('')
  }
  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${card}`}>
      <p className={`text-sm font-bold ${txt}`}>{obj.titulo}</p>
      <p className={`text-[11px] mb-2.5 ${muted}`}>{meta.periodo === 'anual' ? 'Meta anual' : `Trim. ${meta.trimestre}`} · alvo {alvoLabel(obj, meta.alvo)}</p>
      <div className="space-y-1.5 mb-2">
        {mine.length === 0 && <p className={`text-xs ${muted}`}>Nenhuma ação planejada.</p>}
        {mine.map(a => {
          const sa = STATUS_ACAO_LABEL[a.status]
          const done = a.status === 'concluida'
          return (
            <div key={a.id} className={`flex items-center gap-2 rounded-lg p-2 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
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
      <div className="flex gap-1.5">
        <input value={nova} onChange={e => setNova(e.target.value)} placeholder="Ação para atingir a meta..."
          className={`flex-1 text-xs rounded-lg px-2.5 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white placeholder-slate-500' : 'bg-white border-slate-200'}`} />
        <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)}
          className={`w-32 text-xs rounded-lg px-2 py-1.5 border outline-none ${isDark ? 'bg-white/[0.04] border-white/10 text-white' : 'bg-white border-slate-200'}`} />
        <button onClick={add} disabled={criarAcao.isPending || !nova.trim()} className="px-2.5 rounded-lg bg-violet-600 text-white disabled:opacity-50">
          {criarAcao.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SgiObjetivos() {
  const { isDark } = useTheme()
  const { data: objetivos = [], isLoading } = useObjetivos()
  const { data: acoes = [] } = useAcoes()
  const criarRegistro = useCriarRegistro()
  const removerObjetivo = useRemoverObjetivo()
  const removerMeta = useRemoverMeta()
  const [tab, setTab] = useState<TabKey>('anuais')
  const [showNovo, setShowNovo] = useState(false)
  const [editObj, setEditObj] = useState<ObjFull | null>(null)
  const [delAlvo, setDelAlvo] = useState<{ tipo: 'objetivo' | 'meta'; id: string; label: string } | null>(null)
  const [checkin, setCheckin] = useState<{ obj: ObjFull; meta: MetaFull } | null>(null)
  const [enviados, setEnviados] = useState<Record<string, boolean>>({})

  // Filtros / visão (padrão Padronização) — aplicáveis a todas as abas
  const [busca, setBusca] = useState('')
  const [farolFilter, setFarolFilter] = useState('')
  const [view, setView] = useState<'table' | 'cards'>('table')

  const card = isDark ? 'bg-[#1e293b] border-white/[0.06]' : 'bg-white border-slate-200'
  const txt = isDark ? 'text-white' : 'text-slate-900'
  const muted = isDark ? 'text-slate-400' : 'text-slate-500'

  const todasMetas = useMemo(() => objetivos.flatMap(o => o.metas.map(m => ({ obj: o, meta: m }))), [objetivos])
  const metasTri = useMemo(() => objetivos.flatMap(o => o.metas.filter(m => m.periodo === 'trimestral').map(m => ({ obj: o, meta: m }))), [objetivos])

  const counts = useMemo(() => ({
    anuais: objetivos.filter(o => o.metas.some(m => m.periodo === 'anual')).length,
    trimestrais: objetivos.filter(o => o.metas.some(m => m.periodo === 'trimestral')).length,
    plano: metasTri.length,
    checkin: todasMetas.length,
    revisao: todasMetas.filter(({ meta }) => (meta.checkins?.length ?? 0) > 0).length,
  }), [objetivos, metasTri, todasMetas])

  // Filtragem
  const matchObj = (o: ObjFull) => { const q = busca.toLowerCase(); return [o.titulo, o.indicador, o.area_processo].some(v => v?.toLowerCase().includes(q)) }
  const objetivosFiltrados = useMemo(() => busca ? objetivos.filter(matchObj) : objetivos, [objetivos, busca])
  const metasTriFiltradas = useMemo(() => busca ? metasTri.filter(({ obj }) => matchObj(obj)) : metasTri, [metasTri, busca])
  const metasFiltradas = useMemo(() => {
    let items = todasMetas
    if (busca) { const q = busca.toLowerCase(); items = items.filter(({ obj, meta }) => [obj.titulo, obj.indicador, obj.area_processo, meta.periodo === 'anual' ? 'anual' : `trim ${meta.trimestre}`].some(v => v?.toLowerCase().includes(q))) }
    if (farolFilter) items = items.filter(({ meta }) => ((ultimoCheckin(meta)?.farol) || 'cinza') === farolFilter)
    return items
  }, [todasMetas, busca, farolFilter])

  const enviarMelhoria = async (obj: ObjFull, meta: MetaFull) => {
    const u = ultimoCheckin(meta)
    await criarRegistro.mutateAsync({
      tipo: 'oportunidade', origem: 'meta', gravidade: 'media',
      area_processo: obj.area_processo || undefined,
      titulo: `Revisão: ${obj.titulo} (${meta.periodo === 'anual' ? 'anual' : 'T' + meta.trimestre})`,
      descricao: `Enviado da revisão de metas. Último check-in: ${u?.competencia ?? '—'} → ${u?.realizado ?? '—'} (alvo ${meta.alvo ?? '—'}, farol ${u?.farol ?? '—'}).`,
      status_pdca: 'pendente', classificacao: 'pendente',
    })
    setEnviados(p => ({ ...p, [meta.id]: true }))
  }

  const confirmarRemocao = async () => {
    if (!delAlvo) return
    if (delAlvo.tipo === 'objetivo') await removerObjetivo.mutateAsync(delAlvo.id)
    else await removerMeta.mutateAsync(delAlvo.id)
    setDelAlvo(null)
  }

  if (isLoading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>

  const isCheckinView = tab === 'checkin' || tab === 'revisao'
  const metaLabel = (m: MetaFull) => (m.periodo === 'anual' ? 'Anual' : `Trim. ${m.trimestre}`)
  const inputBg = isDark ? 'bg-white/[0.04] border-white/[0.06] text-slate-200' : 'border-slate-200 bg-white text-slate-600'

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col h-full ${isDark ? 'bg-[#0f172a] border-white/[0.06]' : 'bg-white border-slate-200'}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-lg font-extrabold flex items-center gap-2 ${txt}`}>
            <Target size={18} className="text-emerald-500" /> Objetivos e Metas
          </h1>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Metas, plano de ação, check-in mensal e revisão</p>
        </div>
        <button onClick={() => setShowNovo(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shrink-0">
          <Plus size={14} /> Novo Objetivo
        </button>
      </div>

      {/* Abas */}
      <div className={`flex gap-1 p-1 pb-2 border-b overflow-x-auto hide-scrollbar ${isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-slate-50 border-slate-200'}`}>
        {TABS.map(t => {
          const count = counts[t.key]
          const isActive = tab === t.key
          const a = isDark ? TAB_ACCENT_DARK[t.key] : TAB_ACCENT[t.key]
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`min-w-fit md:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all border ${
                isActive ? `${a.bgActive} ${a.textActive} ${a.border} font-bold shadow-sm` : `${a.bg} ${a.text} font-medium border-transparent ${isDark ? '' : 'hover:bg-white hover:shadow-sm'}`
              }`}>
              {t.label}
              {count > 0 && <span className={`text-[10px] font-bold rounded-full min-w-[22px] px-1.5 py-0.5 ${isActive ? a.badge : isDark ? 'bg-white/[0.06] text-slate-500' : 'bg-slate-200/80 text-slate-500'}`}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Toolbar: busca (todas as abas) + filtro de farol e toggle lista/cards (check-in e revisão) */}
        {objetivos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar objetivo, indicador, área..."
                className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${inputBg}`} />
              {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"><X size={12} /></button>}
            </div>
            {isCheckinView && (
              <select value={farolFilter} onChange={e => setFarolFilter(e.target.value)} className={`rounded-lg border px-2 py-1.5 text-[11px] ${inputBg}`}>
                <option value="">Farol</option>
                {(Object.keys(FAROL_CFG) as Farol[]).map(k => <option key={k} value={k}>{FAROL_CFG[k].label}</option>)}
              </select>
            )}
            {isCheckinView && (
              <div className={`flex items-center rounded-lg border overflow-hidden ml-auto ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
                <button onClick={() => setView('table')} title="Lista" className={`p-1.5 ${view === 'table' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutList size={14} /></button>
                <button onClick={() => setView('cards')} title="Cards" className={`p-1.5 ${view === 'cards' ? isDark ? 'bg-white/[0.08] text-white' : 'bg-slate-100 text-slate-700' : isDark ? 'text-slate-500' : 'text-slate-400'}`}><LayoutGrid size={14} /></button>
              </div>
            )}
          </div>
        )}

        {objetivos.length === 0 ? (
          <div className={`flex flex-col items-center justify-center py-16 text-center gap-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            <Target size={40} className="mb-1 text-emerald-500/50" />
            <p className={`text-sm font-medium ${txt}`}>Nenhum objetivo cadastrado</p>
            <p className="text-xs">Crie o primeiro objetivo e defina a meta anual.</p>
          </div>
        ) : tab === 'anuais' || tab === 'trimestrais' ? (
          objetivosFiltrados.length === 0 ? (
            <p className={`text-xs ${muted}`}>Nenhum objetivo encontrado.</p>
          ) : (
            <div className="space-y-3">
              {objetivosFiltrados.map(obj => (
                <ObjetivoCard key={obj.id} obj={obj} periodo={tab === 'anuais' ? 'anual' : 'trimestral'} isDark={isDark} txt={txt} muted={muted} card={card}
                  onEdit={o => setEditObj(o)}
                  onDeleteObj={o => setDelAlvo({ tipo: 'objetivo', id: o.id, label: `O objetivo "${o.titulo}" e todas as suas metas/check-ins serão removidos.` })}
                  onDeleteMeta={(o, m) => setDelAlvo({ tipo: 'meta', id: m.id, label: `A meta ${m.periodo === 'anual' ? 'anual' : 'T' + m.trimestre} de "${o.titulo}" e seus check-ins serão removidos.` })} />
              ))}
            </div>
          )
        ) : tab === 'plano' ? (
          metasTriFiltradas.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-16 text-center gap-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
              <Target size={36} className="text-violet-500/50" />
              <p className={`text-sm font-medium ${txt}`}>Nenhuma meta trimestral</p>
              <p className="text-xs">Defina metas trimestrais na aba "Metas Trimestrais" para montar o plano de ação.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {metasTriFiltradas.map(({ obj, meta }) => (
                <PlanoAcaoMeta key={meta.id} obj={obj} meta={meta} acoes={acoes} isDark={isDark} txt={txt} muted={muted} card={card} />
              ))}
            </div>
          )
        ) : tab === 'checkin' ? (
          metasFiltradas.length === 0 ? (
            <p className={`text-xs ${muted}`}>Nenhuma meta encontrada.</p>
          ) : view === 'cards' ? (
            <div className="space-y-2">
              {metasFiltradas.map(({ obj, meta }) => {
                const u = ultimoCheckin(meta)
                const f = FAROL_CFG[(u?.farol as Farol) || 'cinza']
                return (
                  <div key={meta.id} className={`w-full rounded-xl border shadow-sm p-3 flex items-center justify-between gap-3 ${card}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${txt}`}>{obj.titulo}</p>
                      <p className={`text-[11px] mt-0.5 truncate ${muted}`}>{metaLabel(meta)} · {meta.descricao ?? `alvo ${alvoLabel(obj, meta.alvo)}`}{u ? ` · ${u.competencia}→${u.realizado ?? '—'}` : ''}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.bg} ${f.text}`}><span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />{f.label}</span>
                    <button onClick={() => setCheckin({ obj, meta })} className="shrink-0 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1.5"><CheckCircle2 size={13} /> Check-in</button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
              <table className="w-full text-xs">
                <thead>
                  <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                    <th className="text-left px-3 py-2 font-semibold">OBJETIVO</th>
                    <th className="text-left px-3 py-2 font-semibold">META</th>
                    <th className="text-right px-3 py-2 font-semibold">ALVO</th>
                    <th className="text-center px-3 py-2 font-semibold">FAROL</th>
                    <th className="text-right px-3 py-2 font-semibold">AÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {metasFiltradas.map(({ obj, meta }) => {
                    const u = ultimoCheckin(meta)
                    const f = FAROL_CFG[(u?.farol as Farol) || 'cinza']
                    return (
                      <tr key={meta.id} className={`${isDark ? 'border-b border-white/[0.04]' : 'border-b border-slate-100'}`}>
                        <td className={`px-3 py-2.5 font-semibold ${txt}`}>{obj.titulo}</td>
                        <td className={`px-3 py-2.5 ${muted}`}>{metaLabel(meta)}{meta.descricao ? ` · ${meta.descricao}` : ''}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${txt}`}>{alvoLabel(obj, meta.alvo)}</td>
                        <td className="px-3 py-2.5 text-center"><span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.bg} ${f.text}`}><span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />{f.label}</span></td>
                        <td className="px-3 py-2.5 text-right"><button onClick={() => setCheckin({ obj, meta })} className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-0.5"><CheckCircle2 size={12} /> Check-in</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Revisão */
          metasFiltradas.length === 0 ? (
            <p className={`text-xs ${muted}`}>Nenhuma meta encontrada.</p>
          ) : view === 'cards' ? (
            <div className="space-y-2">
              {metasFiltradas.map(({ obj, meta }) => {
                const u = ultimoCheckin(meta)
                const f = FAROL_CFG[(u?.farol as Farol) || 'cinza']
                const jaEnviado = enviados[meta.id]
                return (
                  <div key={meta.id} className={`w-full rounded-xl border shadow-sm p-3 flex items-center justify-between gap-3 ${card}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold truncate ${txt}`}>{obj.titulo}</p>
                      <p className={`text-[11px] mt-0.5 truncate ${muted}`}>{metaLabel(meta)} · {meta.descricao ?? `realizado ${u?.realizado ?? '—'} / alvo ${alvoLabel(obj, meta.alvo)}`}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.bg} ${f.text}`}><span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />{f.label}</span>
                    {jaEnviado ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CheckCircle2 size={13} /> Enviado</span>
                    ) : (
                      <button onClick={() => enviarMelhoria(obj, meta)} disabled={criarRegistro.isPending} className="shrink-0 px-3 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1.5"><Send size={13} /> Enviar p/ Melhoria</button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
              <table className="w-full text-xs">
                <thead>
                  <tr className={isDark ? 'bg-white/[0.02] text-slate-500' : 'bg-slate-50 text-slate-400'}>
                    <th className="text-left px-3 py-2 font-semibold">OBJETIVO</th>
                    <th className="text-left px-3 py-2 font-semibold">META</th>
                    <th className="text-right px-3 py-2 font-semibold">REALIZADO/ALVO</th>
                    <th className="text-center px-3 py-2 font-semibold">FAROL</th>
                    <th className="text-right px-3 py-2 font-semibold">REVISÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {metasFiltradas.map(({ obj, meta }) => {
                    const u = ultimoCheckin(meta)
                    const f = FAROL_CFG[(u?.farol as Farol) || 'cinza']
                    const jaEnviado = enviados[meta.id]
                    return (
                      <tr key={meta.id} className={`${isDark ? 'border-b border-white/[0.04]' : 'border-b border-slate-100'}`}>
                        <td className={`px-3 py-2.5 font-semibold ${txt}`}>{obj.titulo}</td>
                        <td className={`px-3 py-2.5 ${muted}`}>{metaLabel(meta)}{meta.descricao ? ` · ${meta.descricao}` : ''}</td>
                        <td className={`px-3 py-2.5 text-right ${muted}`}>{u?.realizado ?? '—'} / {meta.alvo ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center"><span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${f.bg} ${f.text}`}><span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />{f.label}</span></td>
                        <td className="px-3 py-2.5 text-right">
                          {jaEnviado ? (
                            <span className="text-[10px] font-semibold text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Enviado</span>
                          ) : (
                            <button onClick={() => enviarMelhoria(obj, meta)} disabled={criarRegistro.isPending}
                              className="text-[11px] font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1 disabled:opacity-50">
                              <Send size={12} /> Enviar p/ Melhoria
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {showNovo && <ObjetivoModal onClose={() => setShowNovo(false)} isDark={isDark} />}
      {editObj && <ObjetivoModal edit={editObj} onClose={() => setEditObj(null)} isDark={isDark} />}
      {delAlvo && <ConfirmDelModal label={delAlvo.label} pending={removerObjetivo.isPending || removerMeta.isPending} onConfirm={confirmarRemocao} onClose={() => setDelAlvo(null)} isDark={isDark} />}
      {checkin && <CheckinModal obj={checkin.obj} meta={checkin.meta} onClose={() => setCheckin(null)} isDark={isDark} />}
    </div>
  )
}
